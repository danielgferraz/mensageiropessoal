// Estado por conversa, notas internas, CRM, sugestões da IA e auditoria — banco isolado "mensageiro".
// Conexão via MENSAGEIRO_DATABASE_URL (role mensageiro_app, menor privilégio). Sem URL: recursos desligados (503).
// Modo SOMENTE SUGESTÃO: este módulo nunca envia mensagens.

import { createPgMenuStore } from './menus-store.mjs';

const ACTORS = new Set(['ia', 'humano']);
const MODES = new Set(['suggestion', 'human']);
const JID_RE = /^[0-9A-Za-z._:-]{3,80}@(s\.whatsapp\.net|g\.us|lid|broadcast)$/;

export const validJid = (jid) => typeof jid === 'string' && JID_RE.test(jid);

export async function createStateDb(url, { poolFactory } = {}) {
  if (!url && !poolFactory) return null;
  let pool;
  if (poolFactory) pool = poolFactory();
  else {
    const { default: pg } = await import('pg');
    pool = new pg.Pool({ connectionString: url, max: 4, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 });
    pool.on('error', (err) => console.error('[state-db pool]', err.message));
  }

  const q = (sql, params) => pool.query(sql, params);
  async function tx(fn) {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const r = await fn((s, p) => client.query(s, p)); await client.query('COMMIT'); return r; }
    catch (err) { await client.query('ROLLBACK').catch(() => {}); throw err; }
    finally { client.release(); }
  }
  const audit = (run, actor, action, jid, before, after) =>
    run('INSERT INTO audit (actor, action, jid, before, after) VALUES ($1,$2,$3,$4,$5)',
      [actor, action, jid ?? null, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after)]);

  // A coluna auto_reply vem da migração 003. Sem ela, a resposta automática fica indisponível (tudo segue só sugestão).
  let autoCol = { value: false, at: 0 };
  const autoReplyAvailable = async () => {
    if (autoCol.value || Date.now() - autoCol.at < 30000) return autoCol.value;
    const r = await q("SELECT 1 FROM information_schema.columns WHERE table_schema='mensageiro' AND table_name='conversations' AND column_name='auto_reply'").catch(() => ({ rows: [] }));
    autoCol = { value: r.rows.length > 0, at: Date.now() };
    return autoCol.value;
  };
  // Menus (migração 005): sem as tabelas, as rotas /menus respondem 503 e o resto do app segue normal
  let menusCache = { value: false, at: 0 };
  const menusAvailable = async () => {
    if (menusCache.value || Date.now() - menusCache.at < 30000) return menusCache.value;
    const r = await q("SELECT 1 FROM information_schema.tables WHERE table_schema='mensageiro' AND table_name='menu_sessions'").catch(() => ({ rows: [] }));
    menusCache = { value: r.rows.length > 0, at: Date.now() };
    return menusCache.value;
  };
  const menus = createPgMenuStore({ q, tx: (fn) => tx(fn) });
  const mapConv = (r, jid) => r ? {
    jid: r.jid, aiEnabled: r.ai_enabled, mode: r.mode, autoReply: r.auto_reply === true, takenOverAt: r.taken_over_at, lastAiReplyAt: r.last_ai_reply_at,
    lastHumanReplyAt: r.last_human_reply_at, updatedAt: r.updated_at,
  } : { jid, aiEnabled: false, mode: 'suggestion', autoReply: false, takenOverAt: null, lastAiReplyAt: null, lastHumanReplyAt: null, updatedAt: null };
  const mapNote = (r) => ({ id: String(r.id), jid: r.jid, author: r.author, text: r.text, createdAt: r.created_at });
  const mapSug = (r) => ({ id: String(r.id), jid: r.jid, kind: r.kind, payload: r.payload, status: r.status, createdAt: r.created_at, resolvedAt: r.resolved_at });
  const mapCrm = (r) => r ? { jid: r.jid, stage: r.stage, updatedBy: r.updated_by, updatedAt: r.updated_at } : null;

  return {
    async health() { const r = await q('SELECT max(version) v FROM schema_migrations'); return { ok: true, migration: r.rows[0]?.v || null }; },

    autoReplyAvailable,
    menus,
    menusAvailable,

    async getConversation(jid) {
      const r = await q('SELECT * FROM conversations WHERE jid=$1', [jid]);
      return mapConv(r.rows[0], jid);
    },

    async getState(jid) {
      const [conv, crm, notes, sugs, auth] = await Promise.all([
        q('SELECT * FROM conversations WHERE jid=$1', [jid]),
        q('SELECT * FROM crm_stages WHERE jid=$1', [jid]),
        q('SELECT * FROM notes WHERE jid=$1 ORDER BY created_at DESC LIMIT 200', [jid]),
        q("SELECT * FROM ai_suggestions WHERE jid=$1 AND status='pending' ORDER BY created_at DESC LIMIT 20", [jid]),
        q('SELECT message_id, author FROM message_authorship WHERE jid=$1 ORDER BY created_at DESC LIMIT 500', [jid]),
      ]);
      return {
        conversation: mapConv(conv.rows[0], jid), crm: mapCrm(crm.rows[0]), notes: notes.rows.map(mapNote),
        suggestions: sugs.rows.map(mapSug), authorship: Object.fromEntries(auth.rows.map((r) => [r.message_id, r.author])),
      };
    },

    async updateConversation(jid, patch, actor = 'humano') {
      if (!ACTORS.has(actor)) throw new Error('actor inválido');
      const hasAuto = await autoReplyAvailable();
      if (patch.autoReply === true && !hasAuto) throw Object.assign(new Error('Resposta automática indisponível: a migração 003 ainda não foi aplicada no banco.'), { statusCode: 409 });
      return tx(async (run) => {
        const cur = (await run('SELECT * FROM conversations WHERE jid=$1 FOR UPDATE', [jid])).rows[0];
        const before = mapConv(cur, jid);
        const next = { ...before };
        if (typeof patch.aiEnabled === 'boolean') next.aiEnabled = patch.aiEnabled;
        if (patch.mode !== undefined) {
          if (!MODES.has(patch.mode)) throw Object.assign(new Error('mode inválido'), { statusCode: 400 });
          if (patch.mode !== before.mode) next.takenOverAt = patch.mode === 'human' ? new Date() : null;
          next.mode = patch.mode;
        }
        if (typeof patch.autoReply === 'boolean') next.autoReply = patch.autoReply;
        if (next.autoReply && !(next.aiEnabled && next.mode === 'suggestion')) {
          // Desligar a IA ou assumir a conversa sempre volta para "só sugestão"; ligar o automático exige IA ligada e sem humano assumindo
          if (patch.autoReply === true) throw Object.assign(new Error('Ligue as sugestões da IA e devolva a conversa para a IA antes de ativar a resposta automática.'), { statusCode: 400 });
          next.autoReply = false;
        }
        const r = hasAuto
          ? await run(`INSERT INTO conversations (jid, ai_enabled, mode, taken_over_at, auto_reply) VALUES ($1,$2,$3,$4,$5)
              ON CONFLICT (jid) DO UPDATE SET ai_enabled=EXCLUDED.ai_enabled, mode=EXCLUDED.mode, taken_over_at=EXCLUDED.taken_over_at, auto_reply=EXCLUDED.auto_reply, updated_at=now()
              RETURNING *`, [jid, next.aiEnabled, next.mode, next.takenOverAt, next.autoReply])
          : await run(`INSERT INTO conversations (jid, ai_enabled, mode, taken_over_at) VALUES ($1,$2,$3,$4)
              ON CONFLICT (jid) DO UPDATE SET ai_enabled=EXCLUDED.ai_enabled, mode=EXCLUDED.mode, taken_over_at=EXCLUDED.taken_over_at, updated_at=now()
              RETURNING *`, [jid, next.aiEnabled, next.mode, next.takenOverAt]);
        const after = mapConv(r.rows[0], jid);
        await audit(run, actor, 'conversation.update', jid, { aiEnabled: before.aiEnabled, mode: before.mode, autoReply: before.autoReply }, { aiEnabled: after.aiEnabled, mode: after.mode, autoReply: after.autoReply });
        return after;
      });
    },

    // Pausa automática da resposta automática (humano respondeu, etc.). Retorna true se estava ligada.
    async pauseAutoReply(jid, reason, actor = 'humano') {
      if (!ACTORS.has(actor)) throw new Error('actor inválido');
      if (!(await autoReplyAvailable())) return false;
      return tx(async (run) => {
        const r = await run('UPDATE conversations SET auto_reply=false, updated_at=now() WHERE jid=$1 AND auto_reply=true RETURNING jid', [jid]);
        if (!r.rows.length) return false;
        await audit(run, actor, 'autoreply.paused', jid, { autoReply: true }, { autoReply: false, reason });
        return true;
      });
    },

    async addNote(jid, author, text) {
      if (!ACTORS.has(author)) throw new Error('author inválido');
      return tx(async (run) => {
        const r = await run('INSERT INTO notes (jid, author, text) VALUES ($1,$2,$3) RETURNING *', [jid, author, text]);
        await audit(run, author, 'note.create', jid, null, { id: String(r.rows[0].id), length: text.length });
        return mapNote(r.rows[0]);
      });
    },

    async deleteNote(id, actor = 'humano') {
      return tx(async (run) => {
        const r = await run('DELETE FROM notes WHERE id=$1 RETURNING *', [id]);
        if (!r.rows[0]) return false;
        await audit(run, actor, 'note.delete', r.rows[0].jid, { id: String(id), author: r.rows[0].author }, null);
        return true;
      });
    },

    async setCrmStage(jid, stage, actor = 'humano') {
      if (!ACTORS.has(actor)) throw new Error('actor inválido');
      return tx(async (run) => {
        const cur = mapCrm((await run('SELECT * FROM crm_stages WHERE jid=$1 FOR UPDATE', [jid])).rows[0]);
        const r = await run(`INSERT INTO crm_stages (jid, stage, updated_by) VALUES ($1,$2,$3)
          ON CONFLICT (jid) DO UPDATE SET stage=EXCLUDED.stage, updated_by=EXCLUDED.updated_by, updated_at=now() RETURNING *`, [jid, stage, actor]);
        await audit(run, actor, 'crm.stage', jid, cur ? { stage: cur.stage, updatedBy: cur.updatedBy } : null, { stage });
        return mapCrm(r.rows[0]);
      });
    },

    // A IA nunca altera o estágio: registra uma sugestão; se o estágio atual foi definido por humano, sinaliza.
    async suggestCrmStage(jid, stage, reason) {
      return tx(async (run) => {
        const cur = mapCrm((await run('SELECT * FROM crm_stages WHERE jid=$1', [jid])).rows[0]);
        const payload = { stage, reason: reason || null, currentStage: cur?.stage ?? null, manualStage: cur?.updatedBy === 'humano' };
        const r = await run("INSERT INTO ai_suggestions (jid, kind, payload) VALUES ($1,'crm_stage',$2) RETURNING *", [jid, JSON.stringify(payload)]);
        await audit(run, 'ia', 'suggestion.crm_stage', jid, null, { id: String(r.rows[0].id), ...payload });
        return mapSug(r.rows[0]);
      });
    },

    // Uma sugestão de resposta pendente por conversa: a nova substitui (descarta) as anteriores.
    // meta.sourceMessageId = id da mensagem do cliente que originou o rascunho; meta.auto = gerado pelo webhook.
    async recordReplySuggestion(jid, draft, meta = {}) {
      return tx(async (run) => {
        const old = await run("UPDATE ai_suggestions SET status='dismissed', resolved_at=now() WHERE jid=$1 AND kind='reply' AND status='pending' RETURNING id", [jid]);
        if (old.rows.length) await audit(run, 'ia', 'suggestion.superseded', jid, { ids: old.rows.map((r) => String(r.id)) }, { reason: 'new_suggestion' });
        const payload = { draft, ...(meta.sourceMessageId ? { sourceMessageId: String(meta.sourceMessageId).slice(0, 200) } : {}), ...(meta.auto ? { auto: true } : {}) };
        const r = await run("INSERT INTO ai_suggestions (jid, kind, payload) VALUES ($1,'reply',$2) RETURNING *", [jid, JSON.stringify(payload)]);
        await run('INSERT INTO conversations (jid) VALUES ($1) ON CONFLICT (jid) DO NOTHING', [jid]);
        await audit(run, 'ia', meta.auto ? 'suggestion.reply.auto' : 'suggestion.reply', jid, null,
          { id: String(r.rows[0].id), length: draft.length, ...(meta.sourceMessageId ? { sourceMessageId: payload.sourceMessageId } : {}) });
        return mapSug(r.rows[0]);
      });
    },

    // Descarta rascunhos pendentes que ficaram velhos (chegou mensagem nova ou um humano respondeu). Retorna quantos.
    async dismissPendingReplies(jid, reason, actor = 'ia') {
      if (!ACTORS.has(actor)) throw new Error('actor inválido');
      return tx(async (run) => {
        const r = await run("UPDATE ai_suggestions SET status='dismissed', resolved_at=now() WHERE jid=$1 AND kind='reply' AND status='pending' RETURNING id", [jid]);
        if (r.rows.length) await audit(run, actor, 'suggestion.superseded', jid, { ids: r.rows.map((x) => String(x.id)) }, { reason });
        return r.rows.length;
      });
    },

    async resolveSuggestion(id, decision) {
      if (!['accepted', 'dismissed'].includes(decision)) throw Object.assign(new Error('decisão inválida'), { statusCode: 400 });
      return tx(async (run) => {
        const r = await run("UPDATE ai_suggestions SET status=$2, resolved_at=now() WHERE id=$1 AND status='pending' RETURNING *", [id, decision]);
        const s = r.rows[0];
        if (!s) return null;
        let crm = null;
        if (decision === 'accepted' && s.kind === 'crm_stage') {
          // aceito por humano: o estágio passa a valer como decisão humana
          const c = await run(`INSERT INTO crm_stages (jid, stage, updated_by) VALUES ($1,$2,'humano')
            ON CONFLICT (jid) DO UPDATE SET stage=EXCLUDED.stage, updated_by='humano', updated_at=now() RETURNING *`, [s.jid, s.payload.stage]);
          crm = mapCrm(c.rows[0]);
        }
        await audit(run, 'humano', `suggestion.${decision}`, s.jid, { id: String(s.id), kind: s.kind }, crm ? { stage: crm.stage } : null);
        return { suggestion: mapSug(s), crm };
      });
    },

    // Registro de autoria de mensagem enviada pelo Mensageiro (texto vindo de sugestão da IA = 'ia')
    async recordSent(jid, messageId, author) {
      if (!ACTORS.has(author)) throw new Error('author inválido');
      return tx(async (run) => {
        if (messageId) await run('INSERT INTO message_authorship (message_id, jid, author) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [messageId, jid, author]);
        const col = author === 'ia' ? 'last_ai_reply_at' : 'last_human_reply_at';
        await run(`INSERT INTO conversations (jid, ${col}) VALUES ($1, now()) ON CONFLICT (jid) DO UPDATE SET ${col}=now(), updated_at=now()`, [jid]);
        await audit(run, author, 'message.sent', jid, null, { messageId: messageId || null });
        // Resposta humana feita por fora do rascunho: o rascunho pendente ficou velho.
        if (author === 'humano') {
          const r = await run("UPDATE ai_suggestions SET status='dismissed', resolved_at=now() WHERE jid=$1 AND kind='reply' AND status='pending' RETURNING id", [jid]);
          if (r.rows.length) await audit(run, 'humano', 'suggestion.superseded', jid, { ids: r.rows.map((x) => String(x.id)) }, { reason: 'human_replied' });
        }
      });
    },

    async listAudit(jid, limit = 50) {
      const r = jid ? await q('SELECT * FROM audit WHERE jid=$1 ORDER BY at DESC LIMIT $2', [jid, limit])
        : await q('SELECT * FROM audit ORDER BY at DESC LIMIT $1', [limit]);
      return r.rows.map((a) => ({ id: String(a.id), at: a.at, actor: a.actor, action: a.action, jid: a.jid, before: a.before, after: a.after }));
    },

    end: () => pool.end(),
  };
}
