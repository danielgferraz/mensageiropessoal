// Persistência dos menus: PostgreSQL (banco isolado "mensageiro", migração 005) e memória (testes/QA).
// Mesma interface nos dois: listMenus, getMenu, createMenu, updateMenu, deleteMenu, replaceItems, gotoGraph,
// getSession, saveSession, deleteSession, setContactData, getContactData.
import { gotoTargets } from './menus.mjs';

const num = (v) => (v == null ? v : Number(v));
const mapItem = (r) => ({ id: num(r.id), position: r.position, label: r.label, aliases: r.aliases || [], actions: r.actions || [], active: r.active });
const mapMenu = (r, items = []) => ({ id: num(r.id), name: r.name, description: r.description, footer: r.footer, render_mode: r.render_mode, active: r.active,
  created_at: r.created_at, updated_at: r.updated_at, ...(r.item_count !== undefined ? { item_count: num(r.item_count) } : {}), items });
const mapSession = (r) => r && ({ jid: r.jid, menu_id: num(r.menu_id), item_id: num(r.item_id), step: r.step, awaiting: r.awaiting, field: r.field, attempts: r.attempts,
  collected: r.collected || {}, mode_used: r.mode_used, started_by: r.started_by, expires_at: r.expires_at instanceof Date ? r.expires_at.toISOString() : r.expires_at });

export function createPgMenuStore({ q, tx }) {
  return {
    async listMenus() {
      const r = await q(`SELECT m.*, (SELECT count(*) FROM menu_items i WHERE i.menu_id=m.id AND i.active) AS item_count FROM menus m ORDER BY lower(m.name)`);
      return r.rows.map((row) => mapMenu(row));
    },
    async getMenu(id) {
      const m = (await q('SELECT * FROM menus WHERE id=$1', [id])).rows[0];
      if (!m) return null;
      const items = (await q('SELECT * FROM menu_items WHERE menu_id=$1 ORDER BY position', [id])).rows.map(mapItem);
      return mapMenu(m, items);
    },
    async createMenu(v) {
      const r = await q('INSERT INTO menus (name, description, footer, render_mode, active) VALUES ($1,$2,$3,$4,$5) RETURNING *', [v.name, v.description, v.footer, v.render_mode, v.active]);
      return mapMenu(r.rows[0]);
    },
    async updateMenu(id, v) {
      const r = await q('UPDATE menus SET name=$2, description=$3, footer=$4, render_mode=$5, active=$6, updated_at=now() WHERE id=$1 RETURNING *', [id, v.name, v.description, v.footer, v.render_mode, v.active]);
      return r.rows[0] ? mapMenu(r.rows[0]) : null;
    },
    async deleteMenu(id) { return (await q('DELETE FROM menus WHERE id=$1 RETURNING id', [id])).rows.length > 0; },
    // Salva a lista inteira e ordenada: atualiza por id (mantém sessões em andamento), insere os novos e remove os que saíram
    async replaceItems(menuId, items) {
      return tx(async (run) => {
        const existing = new Set((await run('SELECT id FROM menu_items WHERE menu_id=$1', [menuId])).rows.map((r) => Number(r.id)));
        const keep = new Set();
        for (const it of items) {
          if (it.id && existing.has(it.id)) {
            keep.add(it.id);
            await run('UPDATE menu_items SET position=$3, label=$4, aliases=$5, actions=$6, active=$7 WHERE id=$1 AND menu_id=$2', [it.id, menuId, it.position, it.label, it.aliases, JSON.stringify(it.actions), it.active]);
          } else {
            const r = await run('INSERT INTO menu_items (menu_id, position, label, aliases, actions, active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [menuId, it.position, it.label, it.aliases, JSON.stringify(it.actions), it.active]);
            keep.add(Number(r.rows[0].id));
          }
        }
        for (const id of existing) if (!keep.has(id)) await run('DELETE FROM menu_items WHERE id=$1 AND menu_id=$2', [id, menuId]);
        await run('UPDATE menus SET updated_at=now() WHERE id=$1', [menuId]);
        return (await run('SELECT * FROM menu_items WHERE menu_id=$1 ORDER BY position', [menuId])).rows.map(mapItem);
      });
    },
    async gotoGraph(replace) {
      const rows = (await q('SELECT menu_id, actions FROM menu_items')).rows;
      const g = new Map();
      for (const r of rows) { const id = Number(r.menu_id); if (replace?.menuId === id) continue; g.set(id, [...(g.get(id) || []), ...gotoTargets([{ actions: r.actions || [] }])]); }
      if (replace) g.set(replace.menuId, gotoTargets(replace.items));
      return g;
    },
    async getSession(jid) { return mapSession((await q('SELECT * FROM menu_sessions WHERE jid=$1', [jid])).rows[0]); },
    async saveSession(s) {
      await q(`INSERT INTO menu_sessions (jid, menu_id, item_id, step, awaiting, field, attempts, collected, mode_used, started_by, expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (jid) DO UPDATE SET menu_id=EXCLUDED.menu_id, item_id=EXCLUDED.item_id, step=EXCLUDED.step, awaiting=EXCLUDED.awaiting, field=EXCLUDED.field,
          attempts=EXCLUDED.attempts, collected=EXCLUDED.collected, mode_used=EXCLUDED.mode_used, started_by=EXCLUDED.started_by, expires_at=EXCLUDED.expires_at`,
      [s.jid, s.menu_id, s.item_id ?? null, s.step ?? 0, s.awaiting, s.field ?? null, s.attempts ?? 0, JSON.stringify(s.collected || {}), s.mode_used || 'text', s.started_by ?? null, s.expires_at]);
    },
    async deleteSession(jid) { await q('DELETE FROM menu_sessions WHERE jid=$1', [jid]); },
    async setContactData(jid, key, value) {
      await q('INSERT INTO contact_data (jid, key, value) VALUES ($1,$2,$3) ON CONFLICT (jid, key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()', [jid, key, value]);
    },
    async getContactData(jid) { return Object.fromEntries((await q('SELECT key, value FROM contact_data WHERE jid=$1', [jid])).rows.map((r) => [r.key, r.value])); },
  };
}

export function createMemoryMenuStore() {
  const menus = new Map(); const items = new Map(); const sessions = new Map(); const data = new Map();
  let menuSeq = 1, itemSeq = 1;
  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const full = (m) => ({ ...m, items: [...(items.get(m.id) || [])].sort((a, b) => a.position - b.position) });
  return {
    async listMenus() { return [...menus.values()].map((m) => ({ ...clone(m), item_count: (items.get(m.id) || []).filter((i) => i.active).length, items: [] })).sort((a, b) => a.name.localeCompare(b.name)); },
    async getMenu(id) { const m = menus.get(Number(id)); return m ? clone(full(m)) : null; },
    async createMenu(v) { const m = { id: menuSeq++, ...v, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; menus.set(m.id, m); items.set(m.id, []); return clone({ ...m, items: [] }); },
    async updateMenu(id, v) { const m = menus.get(Number(id)); if (!m) return null; Object.assign(m, v, { updated_at: new Date().toISOString() }); return clone(full(m)); },
    async deleteMenu(id) { for (const [jid, s] of sessions) if (s.menu_id === Number(id)) sessions.delete(jid); items.delete(Number(id)); return menus.delete(Number(id)); },
    async replaceItems(menuId, list) {
      const old = new Map((items.get(Number(menuId)) || []).map((i) => [i.id, i]));
      const next = list.map((it) => (it.id && old.has(it.id) ? { ...it } : { ...it, id: itemSeq++ }));
      items.set(Number(menuId), clone(next));
      return clone(next.sort((a, b) => a.position - b.position));
    },
    async gotoGraph(replace) {
      const g = new Map();
      for (const [id, list] of items) if (replace?.menuId !== id) g.set(id, gotoTargets(list));
      if (replace) g.set(replace.menuId, gotoTargets(replace.items));
      return g;
    },
    async getSession(jid) { return clone(sessions.get(jid)) || null; },
    async saveSession(s) { sessions.set(s.jid, clone({ item_id: null, step: 0, field: null, attempts: 0, collected: {}, ...s })); },
    async deleteSession(jid) { sessions.delete(jid); },
    async setContactData(jid, key, value) { data.set(`${jid}|${key}`, value); },
    async getContactData(jid) { return Object.fromEntries([...data].filter(([k]) => k.startsWith(`${jid}|`)).map(([k, v]) => [k.split('|')[1], v])); },
    _sessions: sessions,
  };
}
