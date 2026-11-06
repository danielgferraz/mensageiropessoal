import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FALLBACK_AVATAR, parseInstances, selectInstance, messageText,
  normalizeMessage, parseMessages, mergeMessages, parseChats,
} from '../src/lib/evolution.ts';

const JID = '5511000000000@s.whatsapp.net';
const GROUP_JID = '120363000000000000@g.us';
const row = (id, seconds, extra = {}) => ({
  key: { id, remoteJid: JID, fromMe: false },
  pushName: 'Contato de teste', message: { conversation: `Texto ${id}` },
  messageTimestamp: seconds, status: 'SERVER_ACK', ...extra,
});

test('WA connected is selected automatically before another connected instance', () => {
  const instances = parseInstances([
    { name: 'Other', connectionStatus: 'open' },
    { instance: { instanceName: 'WA', status: 'open', token: 'fixture-ignored' } },
  ]);
  assert.equal(selectInstance(instances).name, 'WA');
  assert.ok(!JSON.stringify(instances).includes('fixture-ignored'));
});

test('closed WA is not selected and no connected instance yields undefined', () => {
  assert.equal(selectInstance([{ name: 'WA', connectionStatus: 'close' }, { name: 'Other', connectionStatus: 'open' }]).name, 'Other');
  assert.equal(selectInstance([{ name: 'WA', connectionStatus: 'connecting' }]), undefined);
  assert.throws(() => parseInstances({ error: 'upstream failed' }), /inválida/);
});

test('direct, extended, wrapped and media text are rendered without HTML processing', () => {
  const literal = '<script>alert("fixture")</script>';
  assert.equal(messageText({ message: { conversation: literal } }), literal);
  assert.equal(messageText({ message: { extendedTextMessage: { text: 'extended' } } }), 'extended');
  assert.equal(messageText({ message: { ephemeralMessage: { message: { conversation: 'temporary' } } } }), 'temporary');
  assert.equal(messageText({ message: { viewOnceMessage: { message: { imageMessage: { caption: 'caption' } } } } }), 'caption');
  assert.equal(messageText({ message: { audioMessage: {} } }), '🎵 Áudio');
  assert.equal(messageText({ message: { documentMessage: { fileName: 'fixture.pdf' } } }), '📎 fixture.pdf');
});

test('message status reflects upstream acknowledgements without invented delivery', () => {
  for (const [status, expected] of [['PENDING', 'pending'], ['SERVER_ACK', 'sent'], ['DELIVERY_ACK', 'delivered'], ['READ', 'read'], ['PLAYED', 'read'], ['ERROR', 'failed'], [0, 'failed'], [1, 'pending'], [2, 'sent'], [3, 'delivered'], [4, 'read'], [5, 'read']]) {
    assert.equal(normalizeMessage(row('fixture', 1700000000, { status }), JID).status, expected);
  }
  assert.equal(normalizeMessage(row('fixture', 1700000000, { status: 'PENDING', MessageUpdate: [{ status: 'READ' }] }), JID).status, 'read');
});

test('normalization separates sender identity and rejects a different chat or missing key', () => {
  const mine = normalizeMessage(row('mine', 1700000000, { key: { id: 'mine', remoteJid: JID, fromMe: true } }), JID);
  assert.equal(mine.senderId, 'me');
  const group = normalizeMessage(row('group', 1700000000, { key: { id: 'group', remoteJid: GROUP_JID, participant: JID } }), GROUP_JID);
  assert.equal(group.senderId, JID);
  assert.equal(group.conversationId, GROUP_JID);
  assert.equal(normalizeMessage(row('other', 1700000000), GROUP_JID), null);
  assert.equal(normalizeMessage({}, JID), null);
});

test('timestamp formats include numeric, string, protobuf low and ISO fallback', () => {
  for (const value of [1700000000, '1700000000', { low: 1700000000 }]) {
    const normalized = normalizeMessage(row('timestamp', value), JID);
    assert.equal(normalized.sentAt, 1700000000);
    assert.match(normalized.timestamp, /^\d{2}:\d{2}$/);
  }
  assert.equal(normalizeMessage(row('iso', undefined, { createdAt: '2023-11-14T22:13:20.000Z' }), JID).sentAt, 1700000000);
});

test('paginated messages keep page count and filter unrelated records', () => {
  const result = parseMessages({ messages: { records: [row('ok', 1700000000), row('other', 1700000001, { key: { id: 'other', remoteJid: GROUP_JID } })], pages: 4 } }, JID);
  assert.equal(result.pages, 4);
  assert.deepEqual(result.records.map(message => message.id), ['ok']);
  assert.equal(parseMessages([row('array', 1700000000)], JID).records[0].id, 'array');
  assert.equal(parseMessages({ records: [], pages: 0 }, JID).pages, 1);
  assert.throws(() => parseMessages({ error: 'upstream failed' }, JID), /inválida/);
});

test('message merge deduplicates repeated polls, orders history and refreshes status', () => {
  const older = normalizeMessage(row('older', 1700000000), JID);
  const newer = normalizeMessage(row('newer', 1700000100), JID);
  const read = { ...newer, status: 'read' };
  const result = mergeMessages([newer], [read, older, read]);
  assert.deepEqual(result.map(message => message.id), ['older', 'newer']);
  assert.equal(result[1].status, 'read');
  assert.equal(mergeMessages(result, [read]).length, 2);
  assert.equal(result[0].text, 'Texto older');
});

test('chat parser filters non-chat JIDs, retains groups/lids and uses safe avatars', () => {
  const result = parseChats([
    { remoteJid: 'status@broadcast', name: 'Excluded' },
    { remoteJid: JID, name: 'Contato real de teste', profilePicUrl: 'javascript:fixture', unreadCount: 2, lastMessage: row('last', 1700000000) },
    { remoteJid: GROUP_JID, subject: 'Grupo de teste', profilePicUrl: 'https://example.test/avatar.png' },
    { remoteJid: '123456789@lid', pushName: 'Identificador de teste' },
  ]);
  assert.equal(result.conversations.length, 3);
  assert.equal(result.contacts, undefined);
  const direct = result.conversations.find(item => item.id === JID);
  assert.equal(direct.avatar, FALLBACK_AVATAR);
  assert.equal(direct.name, '+5511000000000');
  assert.equal(direct.phone, '5511000000000');
  const group = result.conversations.find(item => item.id === GROUP_JID);
  assert.equal(group.isGroup, true);
  assert.equal(group.name, 'Grupo de teste');
  assert.equal(group.avatar, 'https://example.test/avatar.png');
  assert.equal(result.conversations.find(item => item.id === JID).unreadCount, 2);
});

test('chat ordering uses latest timestamps and rejects malformed response envelopes', () => {
  const result = parseChats({ chats: [
    { remoteJid: JID, lastMessage: row('earlier', 1700000000) },
    { remoteJid: GROUP_JID, lastMessage: row('later', 1700000200, { key: { id: 'later', remoteJid: GROUP_JID } }) },
  ] });
  assert.equal(result.conversations[0].id, GROUP_JID);
  assert.equal(result.conversations[0].lastMessage.text, 'Texto later');
  assert.throws(() => parseChats({ error: 'upstream failed' }), /inválida/);
});


test('a stale poll cannot downgrade delivery or read status', () => {
  const read = { id: 'id', status: 'read', sentAt: 10 };
  assert.equal(mergeMessages([read], [{ ...read, status: 'pending' }])[0].status, 'read');
});
