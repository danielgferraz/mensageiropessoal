import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStateDb } from './state-db.mjs';

// Pool falso: registra as consultas e responde conforme o texto do SQL.
function fakePool(handler) {
  const log = [];
  const run = async (sql, params) => { log.push({ sql: sql.replace(/\s+/g, ' ').trim(), params }); return handler(sql, params) || { rows: [] }; };
  return { log, pool: { query: run, connect: async () => ({ query: run, release() {} }), end: async () => {}, on() {} } };
}

test('recordReplySuggestion supersedes older pending replies and links the source message, all in one transaction', async () => {
  const { log, pool } = fakePool((sql) => {
    if (/^UPDATE ai_suggestions/.test(sql.trim())) return { rows: [{ id: 5 }] };
    if (/^INSERT INTO ai_suggestions/.test(sql.trim())) return { rows: [{ id: 6, jid: 'j', kind: 'reply', payload: {}, status: 'pending' }] };
  });
  const db = await createStateDb('x', { poolFactory: () => pool });
  const sug = await db.recordReplySuggestion('5511999990001@s.whatsapp.net', 'Olá!', { sourceMessageId: 'ABC', auto: true });
  assert.equal(sug.id, '6');
  const sqls = log.map((l) => l.sql);
  assert.equal(sqls[0], 'BEGIN');
  assert.equal(sqls.at(-1), 'COMMIT');
  const upd = sqls.findIndex((s) => /^UPDATE ai_suggestions SET status='dismissed'/.test(s));
  const ins = sqls.findIndex((s) => /^INSERT INTO ai_suggestions/.test(s));
  assert.ok(upd > 0 && upd < ins, 'old pending replies are dismissed before the new one is inserted');
  assert.match(sqls[upd], /kind='reply' AND status='pending'/);
  assert.deepEqual(JSON.parse(log[ins].params[1]), { draft: 'Olá!', sourceMessageId: 'ABC', auto: true });
  const audits = log.filter((l) => /^INSERT INTO audit/.test(l.sql));
  assert.deepEqual(audits.map((a) => a.params[1]), ['suggestion.superseded', 'suggestion.reply.auto']);
  assert.ok(!JSON.stringify(audits).includes('Olá!'), 'audit stores only the length, never the text');
});

test('dismissPendingReplies audits only when something was dismissed', async () => {
  let rows = [];
  const { log, pool } = fakePool((sql) => (/^UPDATE ai_suggestions/.test(sql.trim()) ? { rows } : undefined));
  const db = await createStateDb('x', { poolFactory: () => pool });
  assert.equal(await db.dismissPendingReplies('5511999990001@s.whatsapp.net', 'new_message'), 0);
  assert.equal(log.filter((l) => /^INSERT INTO audit/.test(l.sql)).length, 0);
  rows = [{ id: 1 }, { id: 2 }];
  assert.equal(await db.dismissPendingReplies('5511999990001@s.whatsapp.net', 'human_replied', 'humano'), 2);
  assert.equal(log.filter((l) => /^INSERT INTO audit/.test(l.sql)).length, 1);
  await assert.rejects(db.dismissPendingReplies('j', 'x', 'robo'));
});

test('a human-authored send discards a stale pending draft; an AI-authored send does not', async () => {
  const { log, pool } = fakePool((sql) => (/^UPDATE ai_suggestions/.test(sql.trim()) ? { rows: [{ id: 9 }] } : undefined));
  const db = await createStateDb('x', { poolFactory: () => pool });
  await db.recordSent('5511999990001@s.whatsapp.net', 'MSG1', 'humano');
  assert.ok(log.some((l) => /^UPDATE ai_suggestions SET status='dismissed'/.test(l.sql)));
  log.length = 0;
  await db.recordSent('5511999990001@s.whatsapp.net', 'MSG2', 'ia');
  assert.ok(!log.some((l) => /^UPDATE ai_suggestions/.test(l.sql)));
});
