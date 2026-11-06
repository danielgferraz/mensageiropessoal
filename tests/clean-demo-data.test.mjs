import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanDemoData } from '../src/lib/clean-demo-data.ts';

function makeStorage(values = {}) {
  const data = new Map(Object.entries(values).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
  return {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    clear() { data.clear(); },
    snapshot() { return Object.fromEntries(data); },
  };
}
const read = (storage, key, fallback = []) => JSON.parse(storage.getItem(key) ?? JSON.stringify(fallback));

test('removes seeded contacts/conversations while preserving manually created IDs and real JIDs', () => {
  const contact = { id: 'c-1794000000000', name: 'Contato criado pelo usuário' };
  const real = { id: '5511000000000@s.whatsapp.net', name: 'Contato real de teste' };
  const conversation = { id: 'conv-1794000000000', name: 'Conversa criada pelo usuário' };
  const storage = makeStorage({
    wa_clone_contacts: [{ id: 'c1', name: 'Ana Carolina' }, { id: 'c6', name: 'Rafael Santos' }, { id: 'c-antigravity' }, contact, real],
    wa_clone_conversations: [{ id: 'conv-1' }, { id: 'conv-group-2' }, conversation, { id: real.id }],
  });
  cleanDemoData(storage);
  assert.deepEqual(read(storage, 'wa_clone_contacts'), [contact, real]);
  assert.deepEqual(read(storage, 'wa_clone_conversations'), [conversation, { id: real.id }]);
});

test('removes only synthetic message IDs and preserves user messages even in old demo conversations', () => {
  const typed = { id: 'msg-1794000000000-user', text: 'Texto escrito pelo usuário' };
  const copilot = { id: '53f9afdd-cae0-44f3-920c-b3efe15fa70a', text: 'Resposta real do CLI' };
  const real = { id: '3EB0FIXTURE', text: 'Mensagem real de teste' };
  const storage = makeStorage({ wa_clone_messages: {
    'conv-1': [{ id: 'm1-1' }, { id: 'm1-5' }, typed],
    'conv-antigravity': [{ id: 'msg-agy-1' }, copilot],
    '5511000000000@s.whatsapp.net': [real],
  } });
  cleanDemoData(storage);
  const messages = read(storage, 'wa_clone_messages', {});
  assert.deepEqual(messages['conv-1'], [typed]);
  assert.deepEqual(messages['conv-antigravity'], [copilot]);
  assert.deepEqual(messages['5511000000000@s.whatsapp.net'], [real]);
});

test('cleans demo notes, logs and connection without deleting user entries', () => {
  const note = { id: 'note-1794000000000', contactId: 'c1', text: 'Nota manual preservada' };
  const log = { id: 'log-1794000000000', action: 'message_sent' };
  const connection = { id: 'conn-1794000000000', name: 'Conexão do usuário' };
  const storage = makeStorage({
    wa_clone_contact_notes: [{ id: 'note-init-1' }, { id: 'note-init-2' }, note],
    wa_clone_event_logs: [{ id: 'log-init-1' }, log],
    wa_clone_evolution_connections: [{ id: 'conn-demo-1' }, connection],
  });
  cleanDemoData(storage);
  assert.deepEqual(read(storage, 'wa_clone_contact_notes'), [note]);
  assert.deepEqual(read(storage, 'wa_clone_event_logs'), [log]);
  assert.deepEqual(read(storage, 'wa_clone_evolution_connections'), [connection]);
});

test('removes seeded pipeline assignments and contact tags while preserving real assignments', () => {
  const storage = makeStorage({
    wa_clone_crm_stages: { c1: 'em-negociacao', c6: 'em-contato', 'c-1794000000000': 'fechado', '5511000000000@s.whatsapp.net': 'novo' },
    wa_clone_contact_labels: { c1: ['lbl-cliente', 'lbl-urgente'], c3: ['lbl-trabalho'], '5511000000000@s.whatsapp.net': ['lbl-real'] },
  });
  cleanDemoData(storage);
  assert.deepEqual(read(storage, 'wa_clone_crm_stages', {}), { 'c-1794000000000': 'fechado', '5511000000000@s.whatsapp.net': 'novo' });
  assert.deepEqual(read(storage, 'wa_clone_contact_labels', {}), { '5511000000000@s.whatsapp.net': ['lbl-real'] });
});

test('preserves authentication, custom labels/replies, pipeline configuration and UI preferences', () => {
  const initial = {
    mensageiro_admin_session: '{"access_token":"fixture-not-real"}',
    'sb-fixture-auth-token': '{"access_token":"fixture-not-real"}',
    wa_clone_labels: [{ id: 'lbl-user', name: 'Etiqueta manual' }],
    wa_clone_quick_replies: [{ id: 'qr-user', text: 'Resposta editada pelo usuário' }],
    wa_clone_crm_stage_list: [{ id: 'stage-user', label: 'Etapa manual' }],
    wa_clone_rail_open: '0',
    theme: 'amoled',
  };
  const storage = makeStorage(initial);
  const before = storage.snapshot();
  cleanDemoData(storage);
  for (const [key, value] of Object.entries(before)) assert.equal(storage.getItem(key), value);
});

test('malformed legacy values are preserved and cleanup remains idempotent', () => {
  const storage = makeStorage({ wa_clone_contacts: '{invalid', wa_clone_messages: 'null', wa_clone_contact_notes: [{ id: 'note-init-1' }, { id: 'manual' }] });
  assert.doesNotThrow(() => cleanDemoData(storage));
  const once = storage.snapshot();
  cleanDemoData(storage);
  assert.deepEqual(storage.snapshot(), once);
  assert.equal(storage.getItem('wa_clone_contacts'), '{invalid');
  assert.equal(storage.getItem('wa_clone_messages'), 'null');
});

test('resets only untouched demo profile and preserves user edits', () => {
  const demo = { name: '', phone: '+55 11 98765-4321', avatar: 'https://img.usecurling.com/ppl/medium?gender=male&seed=88', about: 'Disponível para trocar ideias no WhatsApp Clone!' };
  const untouched = makeStorage({ wa_clone_user: demo });
  cleanDemoData(untouched);
  assert.deepEqual(read(untouched, 'wa_clone_user', {}), { name: '', avatar: '/mensageiro/icon-512.svg', about: '' });
  for (const edited of [{ ...demo, name: 'Nome escolhido' }, { ...demo, phone: '+55 11 99999-0000' }, { ...demo, avatar: '/custom-avatar.png' }, { ...demo, about: 'Recado pessoal' }]) {
    const storage = makeStorage({ wa_clone_user: edited });
    cleanDemoData(storage);
    assert.deepEqual(read(storage, 'wa_clone_user', {}), edited);
  }
});

test('unavailable or read-only storage does not prevent startup or request deletion', () => {
  const unavailable = { getItem() { throw new Error('Storage blocked'); }, setItem() { throw new Error('Storage blocked'); }, removeItem() { assert.fail('No broad deletion allowed'); } };
  assert.doesNotThrow(() => cleanDemoData(unavailable));
  const storage = makeStorage({ wa_clone_contact_notes: [{ id: 'note-init-1' }, { id: 'manual-note', text: 'Preserved' }] });
  const before = storage.snapshot();
  storage.setItem = () => { throw new Error('Storage read-only'); };
  assert.doesNotThrow(() => cleanDemoData(storage));
  assert.deepEqual(storage.snapshot(), before);
});
