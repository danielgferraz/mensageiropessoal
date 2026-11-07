import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPgMenuStore } from './menus-store.mjs';
import { createStateDb } from './state-db.mjs';

function fake(handler) {
  const log = [];
  const run = async (sql, params) => { const s = sql.replace(/\s+/g, ' ').trim(); log.push({ sql: s, params }); return handler(s, params) || { rows: [] }; };
  return { log, q: run, tx: async (fn) => { log.push({ sql: 'BEGIN' }); const r = await fn(run); log.push({ sql: 'COMMIT' }); return r; } };
}

test('replaceItems saves the whole ordered list in one transaction: updates by id, inserts new, deletes the ones that left', async () => {
  const f = fake((sql) => {
    if (/^SELECT id FROM menu_items/.test(sql)) return { rows: [{ id: '1' }, { id: '2' }, { id: '3' }] };
    if (/^INSERT INTO menu_items/.test(sql)) return { rows: [{ id: '9' }] };
    if (/^SELECT \* FROM menu_items/.test(sql)) return { rows: [{ id: '2', position: 1, label: 'B', aliases: [], actions: [], active: true }] };
  });
  const store = createPgMenuStore(f);
  const items = await store.replaceItems(5, [
    { id: 2, position: 1, label: 'B', aliases: ['b'], actions: [{ type: 'reply', text: 'x' }], active: true },
    { id: null, position: 2, label: 'Novo', aliases: [], actions: [{ type: 'reply', text: 'y' }], active: true },
    { id: 777, position: 3, label: 'Id de outro menu', aliases: [], actions: [{ type: 'reply', text: 'z' }], active: true },
  ]);
  const sqls = f.log.map((l) => l.sql);
  assert.equal(sqls[0], 'BEGIN'); assert.equal(sqls.at(-1), 'COMMIT');
  assert.ok(sqls.some((s) => /^UPDATE menu_items SET position=\$3/.test(s) && /WHERE id=\$1 AND menu_id=\$2/.test(s)), 'existing ids are updated (sessions keep working)');
  assert.equal(sqls.filter((s) => /^INSERT INTO menu_items/.test(s)).length, 2, 'new item and a foreign id become inserts, never an update of another menu');
  const deleted = f.log.filter((l) => /^DELETE FROM menu_items/.test(l.sql)).map((l) => l.params[0]);
  assert.deepEqual(deleted.sort(), [1, 3], 'items that left the list are removed');
  assert.deepEqual(items.map((i) => i.id), [2]);
  assert.equal(JSON.parse(f.log.find((l) => /^UPDATE menu_items SET position/.test(l.sql)).params[5])[0].text, 'x', 'actions are stored as JSON');
});

test('sessions and contact data use upserts scoped by jid; the goto graph can replace one menu', async () => {
  const f = fake((sql) => (/^SELECT menu_id, actions FROM menu_items/.test(sql) ? { rows: [{ menu_id: '1', actions: [{ type: 'goto', menu_id: 2 }] }, { menu_id: '2', actions: [] }, { menu_id: '3', actions: [{ type: 'goto', menu_id: 1 }] }] } : undefined));
  const store = createPgMenuStore(f);
  await store.saveSession({ jid: 'j', menu_id: 1, awaiting: 'choice', collected: { name: 'Ana' }, expires_at: '2026-01-01T00:00:00Z' });
  const save = f.log.at(-1);
  assert.match(save.sql, /^INSERT INTO menu_sessions .* ON CONFLICT \(jid\) DO UPDATE/);
  assert.equal(save.params[7], JSON.stringify({ name: 'Ana' }));
  await store.setContactData('j', 'email', 'a@b.co');
  assert.match(f.log.at(-1).sql, /^INSERT INTO contact_data .* ON CONFLICT \(jid, key\) DO UPDATE/);
  await store.deleteSession('j');
  assert.deepEqual(f.log.at(-1).params, ['j']);
  const g = await store.gotoGraph({ menuId: 1, items: [{ actions: [{ type: 'goto', menu_id: 3 }] }] });
  assert.deepEqual([...g.entries()].map(([k, v]) => [k, v]).sort(), [[1, [3]], [2, []], [3, [1]]], 'the candidate version of menu 1 replaces the stored one');
});

test('menus are available only when the 005 tables exist (capability is detected, never assumed)', async () => {
  let has = false;
  const log = [];
  const pool = { query: async (sql) => { log.push(sql); return /information_schema\.tables/.test(sql) ? { rows: has ? [{ x: 1 }] : [] } : { rows: [] }; }, connect: async () => ({ query: async () => ({ rows: [] }), release() {} }), end: async () => {}, on() {} };
  const db = await createStateDb('x', { poolFactory: () => pool });
  assert.equal(await db.menusAvailable(), false);
  assert.equal(typeof db.menus.getMenu, 'function');
  has = true;
  assert.equal(await db.menusAvailable(), false, 'negative result is cached for a short time');
});
