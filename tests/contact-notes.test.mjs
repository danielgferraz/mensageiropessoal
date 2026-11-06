import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_NOTE_LENGTH, createContactNote, editContactNote, noteTimestamp, formatNoteDate,
  readContactNotes, writeContactNotes, buildChatTimeline,
} from '../src/lib/contact-notes.ts';

const CONTACT = '5511000000000@s.whatsapp.net';
const OTHER = '5522000000000@s.whatsapp.net';
const AUTHOR = { id: 'admin-fixture', name: 'Administrador de teste' };
const note = (id, createdAt, extra = {}) => ({ id, contactId: CONTACT, text: 'Nota interna de teste', createdAt, ...extra });
const message = (id, seconds, text = 'Mensagem de teste') => ({
  id, conversationId: CONTACT, senderId: CONTACT, senderName: 'Contato de teste',
  text, timestamp: '10:00', sentAt: seconds, status: 'delivered',
});

test('new note has a unique identity, trimmed content, original author and ISO timestamp', () => {
  const before = Date.now();
  const first = createContactNote(CONTACT, '  Contexto interno  ', { ...AUTHOR, name: '  Administrador de teste  ' });
  const second = createContactNote(CONTACT, 'Outra nota', AUTHOR);
  const after = Date.now();
  assert.match(first.id, /^note-[\da-f-]{36}$/i);
  assert.notEqual(first.id, second.id);
  assert.equal(first.contactId, CONTACT);
  assert.equal(first.text, 'Contexto interno');
  assert.equal(first.authorId, AUTHOR.id);
  assert.equal(first.authorName, AUTHOR.name);
  assert.equal(first.createdAt, new Date(first.createdAt).toISOString());
  assert.ok(Date.parse(first.createdAt) >= before && Date.parse(first.createdAt) <= after);
  assert.equal(first.updatedAt, undefined);
});

test('blank content, excessive length and missing contact/author are rejected', () => {
  for (const text of ['', ' \n\t ', 'x'.repeat(MAX_NOTE_LENGTH + 1)]) {
    assert.throws(() => createContactNote(CONTACT, text, AUTHOR));
  }
  assert.equal(createContactNote(CONTACT, 'x'.repeat(MAX_NOTE_LENGTH), AUTHOR).text.length, MAX_NOTE_LENGTH);
  assert.throws(() => createContactNote('', 'Nota', AUTHOR), /identificado/);
  assert.throws(() => createContactNote(CONTACT, 'Nota', { id: '', name: 'Autor' }), /identificado/);
  assert.throws(() => createContactNote(CONTACT, 'Nota', { id: 'admin-fixture', name: '  ' }), /identificado/);
});

test('editing preserves original author, contact, creation date and chronology without mutating original', () => {
  const original = note('note-original', '2020-01-01T10:00:00.000Z', { authorId: 'original-admin', authorName: 'Autor original' });
  const before = structuredClone(original);
  const edited = editContactNote(original, '  Conteúdo revisado  ');
  assert.deepEqual(original, before);
  assert.equal(edited.id, original.id);
  assert.equal(edited.contactId, original.contactId);
  assert.equal(edited.createdAt, original.createdAt);
  assert.equal(edited.authorId, original.authorId);
  assert.equal(edited.authorName, original.authorName);
  assert.equal(edited.text, 'Conteúdo revisado');
  assert.equal(edited.updatedAt, new Date(edited.updatedAt).toISOString());
  const timeline = buildChatTimeline([message('later', Date.parse('2020-01-01T10:01:00.000Z') / 1000)], [edited], CONTACT);
  assert.deepEqual(timeline.map(entry => entry.kind), ['note', 'message']);
  assert.throws(() => editContactNote(original, ' \t '));
  assert.throws(() => editContactNote(original, 'x'.repeat(MAX_NOTE_LENGTH + 1)));
});

test('legacy notes preserve unknown author rather than attributing them to current admin', () => {
  const legacy = note('note-legacy', '05/11/2025, 13:05');
  const storage = { getItem: () => JSON.stringify([legacy]) };
  const [loaded] = readContactNotes(storage, 'notes');
  assert.deepEqual(loaded, legacy);
  assert.equal(loaded.authorId, undefined);
  assert.equal(loaded.authorName, undefined);
  const edited = editContactNote(loaded, 'Nota antiga revisada');
  assert.equal(edited.authorId, undefined);
  assert.equal(edited.authorName, undefined);
  assert.equal(edited.createdAt, legacy.createdAt);
});

test('timestamps support ISO, Brazilian legacy date/time and legacy ID fallback', () => {
  const iso = '2025-11-05T13:05:00.000Z';
  assert.equal(noteTimestamp(note('iso', iso)), Date.parse(iso));
  for (const legacy of ['05/11/2025, 13:05', '05/11/2025 13:05', '05/11/2025 às 13:05']) {
    assert.equal(noteTimestamp(note('legacy', legacy)), new Date(2025, 10, 5, 13, 5).getTime());
  }
  assert.equal(noteTimestamp(note('legacy', '05/11/2025')), new Date(2025, 10, 5).getTime());
  assert.equal(noteTimestamp(note('note-1730800000000-custom', 'unknown legacy date')), 1730800000000);
  assert.equal(noteTimestamp(note('no-time', '')), 0);
  assert.equal(noteTimestamp(note('no-time', '2025-99-99T99:99:99Z')), 0);
});

test('formatted dates retain legacy labels and mark missing or invalid ISO dates', () => {
  assert.equal(formatNoteDate('05/11/2025, 13:05'), '05/11/2025, 13:05');
  assert.equal(formatNoteDate(''), 'Data não registrada');
  assert.equal(formatNoteDate('2025-99-99T99:99:99Z'), 'Data não registrada');
  const formatted = formatNoteDate('2025-11-05T13:05:00.000Z');
  assert.match(formatted, /\d{2}\/\d{2}\/\d{4}/);
  assert.match(formatted, /\d{2}:\d{2}/);
});

test('chat timeline interleaves messages and contact notes by creation time', () => {
  const start = Date.parse('2025-11-05T10:00:00.000Z');
  const notes = [note('note-after', new Date(start + 180000).toISOString()), note('note-middle', new Date(start + 60000).toISOString())];
  const messages = [message('message-two', (start + 120000) / 1000), message('message-one', start / 1000)];
  const beforeMessages = structuredClone(messages);
  const beforeNotes = structuredClone(notes);
  const timeline = buildChatTimeline(messages, notes, CONTACT);
  assert.deepEqual(timeline.map(entry => [entry.kind, entry.kind === 'message' ? entry.message.id : entry.note.id]), [
    ['message', 'message-one'], ['note', 'note-middle'], ['message', 'message-two'], ['note', 'note-after'],
  ]);
  assert.deepEqual(messages, beforeMessages);
  assert.deepEqual(notes, beforeNotes);
});

test('contact isolation prevents notes of another contact or unspecified contact entering chat', () => {
  const notes = [note('mine', '2025-11-05T10:00:00.000Z'), note('other', '2025-11-05T10:01:00.000Z', { contactId: OTHER })];
  assert.deepEqual(buildChatTimeline([], notes, CONTACT).map(entry => entry.id), ['mine']);
  assert.deepEqual(buildChatTimeline([], notes, OTHER).map(entry => entry.id), ['other']);
  assert.deepEqual(buildChatTimeline([], notes), []);
  assert.deepEqual(buildChatTimeline([], notes, 'unrelated-contact'), []);
});

test('timeline discriminator never turns an internal note into a WhatsApp message', () => {
  const sameId = 'collision-fixture';
  const result = buildChatTimeline([message(sameId, 1700000000)], [note(sameId, '2025-11-05T10:00:00.000Z')], CONTACT);
  assert.equal(new Set(result.map(entry => entry.id)).size, 2);
  for (const entry of result) {
    if (entry.kind === 'note') {
      assert.equal(entry.note.contactId, CONTACT);
      assert.equal('message' in entry, false);
    } else {
      assert.equal(entry.kind, 'message');
      assert.equal(entry.message.conversationId, CONTACT);
      assert.equal('note' in entry, false);
    }
  }
  assert.deepEqual(result, buildChatTimeline([message(sameId, 1700000000)], [note(sameId, '2025-11-05T10:00:00.000Z')], CONTACT));
});

test('search filters message text, media captions and notes without mixing contacts', () => {
  const messages = [message('matching-message', 1700000000, 'AÇÃO combinada'), { ...message('matching-caption', 1700000001, undefined), text: undefined, media: { type: 'image', url: 'fixture', caption: 'Ação na foto' } }, message('nonmatching', 1700000002, 'Outro assunto')];
  const notes = [note('matching-note', '2025-11-05T10:00:00.000Z', { text: 'Detalhe da ação' }), note('nonmatching-note', '2025-11-05T10:00:00.000Z', { text: 'Outro contexto' }), note('foreign-note', '2025-11-05T10:00:00.000Z', { text: 'AÇÃO', contactId: OTHER })];
  const result = buildChatTimeline(messages, notes, CONTACT, '  ação  ');
  assert.deepEqual(result.map(entry => entry.id), ['message-matching-message', 'message-matching-caption', 'matching-note']);
});

test('storage round-trip preserves authored and legacy notes without extra writes on read', () => {
  const data = new Map();
  let writes = 0;
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { writes++; data.set(key, value); } };
  const notes = [createContactNote(CONTACT, 'Nota real de teste', AUTHOR), note('legacy', '05/11/2025, 13:05')];
  assert.deepEqual(readContactNotes(storage, 'missing'), []);
  writeContactNotes(storage, 'notes', notes);
  assert.equal(writes, 1);
  assert.deepEqual(readContactNotes(storage, 'notes'), notes);
  assert.equal(writes, 1);
});

test('malformed stored notes raise an error and leave the original value untouched', () => {
  for (const raw of ['{invalid', 'null', '{}', '[null]', '[{"id":"invalid"}]', JSON.stringify([note('valid', '2025-11-05T10:00:00.000Z'), { id: 'invalid' }])]) {
    let writes = 0;
    const storage = { getItem: () => raw, setItem: () => { writes++; } };
    assert.throws(() => readContactNotes(storage, 'notes'));
    assert.equal(writes, 0);
    assert.equal(storage.getItem('notes'), raw);
  }
});

test('invalid optional author/date metadata is rejected before it can crash rendering', () => {
  for (const extra of [{ authorName: {} }, { authorId: {} }, { updatedAt: {} }]) {
    const raw = JSON.stringify([note('malformed', '2025-11-05T10:00:00.000Z', extra)]);
    const storage = { getItem: () => raw };
    assert.throws(() => readContactNotes(storage, 'notes'), /inválido/);
    assert.equal(storage.getItem('notes'), raw);
  }
});

test('write failures are surfaced and existing note storage remains available', () => {
  const raw = JSON.stringify([note('preserved', '2025-11-05T10:00:00.000Z')]);
  const storage = { getItem: () => raw, setItem: () => { throw new Error('QuotaExceededError'); } };
  assert.throws(() => writeContactNotes(storage, 'notes', []), /Não foi possível salvar neste navegador/);
  assert.equal(storage.getItem('notes'), raw);
  assert.equal(readContactNotes(storage, 'notes')[0].id, 'preserved');
  assert.throws(() => readContactNotes({ getItem() { throw new Error('SecurityError'); } }, 'notes'), /SecurityError/);
});
