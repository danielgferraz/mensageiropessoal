import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chatIdentity, formatPhone, canonicalizeKeys, cleanJid, phoneOf } from '../src/lib/jids.ts';
import { parseChats, normalizeMessage, parseMessages } from '../src/lib/evolution.ts';

const PN = '5511999990001@s.whatsapp.net';
const LID = '100000000000001@lid';
const PIC = 'https://example.test/same-photo.jpg';
const lidRow = (extra = {}) => ({
  remoteJid: LID, pushName: null, profilePicUrl: PIC, unreadCount: 2,
  lastMessage: { key: { id: 'A', remoteJid: LID, remoteJidAlt: PN, fromMe: false }, pushName: 'Contato Teste', message: { conversation: 'oi' }, messageTimestamp: 1700000100 },
  ...extra,
});
const pnRow = (extra = {}) => ({
  remoteJid: PN, pushName: null, profilePicUrl: PIC, unreadCount: 1,
  lastMessage: { key: { id: 'B', remoteJid: PN, fromMe: true }, message: { conversation: 'resposta' }, messageTimestamp: 1700000200 },
  ...extra,
});

test('phone and lid rows of the same contact collapse into one conversation keyed by the phone', () => {
  const { conversations } = parseChats([lidRow(), pnRow()]);
  assert.equal(conversations.length, 1);
  const [chat] = conversations;
  assert.equal(chat.id, PN);
  assert.deepEqual(chat.aliases, [LID]);
  assert.equal(chat.unreadCount, 3);
  assert.equal(chat.lastMessage.text, 'resposta');
  assert.equal(chat.name, '+55 11 99999-0001');
  assert.equal(chat.pushName, 'Contato Teste');
  assert.deepEqual(chat.participants, [PN]);
});

test('a lid row alone resolves to the phone declared in remoteJidAlt', () => {
  const { conversations } = parseChats([lidRow()]);
  assert.equal(conversations.length, 1);
  assert.equal(conversations[0].id, PN);
  assert.equal(conversations[0].phone, '5511999990001');
});

test('a lid without any known phone stays isolated and is never merged by name or photo', () => {
  const orphan = { remoteJid: '100000000000009@lid', profilePicUrl: PIC, lastMessage: { key: { id: 'C', remoteJid: '100000000000009@lid', fromMe: false }, pushName: 'Contato Teste', message: { conversation: 'x' }, messageTimestamp: 1 } };
  const { conversations } = parseChats([pnRow(), orphan]);
  assert.equal(conversations.length, 2);
  const lone = conversations.find(c => c.id === orphan.remoteJid);
  assert.equal(lone.phone, undefined);
  assert.equal(lone.name, 'Contato Teste');
  assert.equal(parseChats([{ remoteJid: '100000000000008@lid' }]).conversations[0].name, 'Número não identificado');
});

test('a lid-only row inherits the phone another row declares as its alias', () => {
  const noAlt = { remoteJid: LID, lastMessage: { key: { id: 'D', remoteJid: LID, fromMe: false }, message: { conversation: 'oi' }, messageTimestamp: 5 } };
  const phoneRow = { remoteJid: PN, lastMessage: { key: { id: 'E', remoteJid: LID, remoteJidAlt: PN, fromMe: false }, message: { conversation: 'ok' }, messageTimestamp: 6 } };
  const { conversations } = parseChats([noAlt, phoneRow]);
  assert.equal(conversations.length, 1);
  assert.equal(conversations[0].id, PN);
});

test('groups are untouched, device suffixes are stripped and non-chat JIDs are dropped', () => {
  assert.deepEqual(chatIdentity({ remoteJid: '120363000000000000@g.us' }), { id: '120363000000000000@g.us', aliases: [] });
  assert.equal(cleanJid('5511999990001:12@s.whatsapp.net'), PN);
  assert.equal(chatIdentity({ remoteJid: 'status@broadcast' }), null);
  assert.equal(phoneOf(LID), undefined);
});

test('messages stored under either jid are accepted for the canonical conversation', () => {
  const fromLid = { key: { id: 'M1', remoteJid: LID, fromMe: false }, message: { conversation: 'a' }, messageTimestamp: 1 };
  assert.equal(normalizeMessage(fromLid, PN), null);
  assert.equal(normalizeMessage(fromLid, PN, [LID]).conversationId, PN);
  const parsed = parseMessages({ messages: { records: [fromLid], pages: 1 } }, PN, [LID]);
  assert.equal(parsed.records.length, 1);
});

test('phone numbers are formatted like WhatsApp for unsaved chats', () => {
  assert.equal(formatPhone('5515997407121'), '+55 15 99740-7121');
  assert.equal(formatPhone('551533334444'), '+55 15 3333-4444');
  assert.equal(formatPhone('14155550100'), '+14155550100');
  assert.equal(formatPhone(''), '');
});

test('local data keyed by an alias migrates to the canonical id without losing entries', () => {
  const stages = { [LID]: 'novo', other: 'x' };
  const moved = canonicalizeKeys(stages, { [LID]: PN });
  assert.deepEqual(moved, { [PN]: 'novo', other: 'x' });
  assert.equal(canonicalizeKeys(moved, { [LID]: PN }), moved);
  const labels = canonicalizeKeys({ [LID]: ['a'], [PN]: ['b'] }, { [LID]: PN }, (a, b) => [...a, ...b]);
  assert.deepEqual(labels, { [PN]: ['a', 'b'] });
});
