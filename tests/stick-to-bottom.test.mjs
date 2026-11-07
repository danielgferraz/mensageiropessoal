import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distanceFromBottom, isNearBottom, countUnseenIncoming, unseenLabel, NEAR_BOTTOM_PX } from '../src/lib/stick-to-bottom.ts';

const box = (scrollTop, scrollHeight = 2000, clientHeight = 500) => ({ scrollTop, scrollHeight, clientHeight });

test('near-bottom uses a small tolerance', () => {
  assert.equal(NEAR_BOTTOM_PX, 100);
  assert.equal(distanceFromBottom(box(1500)), 0);
  assert.equal(isNearBottom(box(1500)), true);
  assert.equal(isNearBottom(box(1401)), true, '99px away still counts as the end');
  assert.equal(isNearBottom(box(1399)), false, '101px away is reading history');
  assert.equal(isNearBottom(box(0, 400, 500)), true, 'a short chat is always at the end');
});

test('counts only incoming entries after the last seen one', () => {
  const entries = [
    { id: 'a', incoming: true }, { id: 'b', incoming: false }, { id: 'c', incoming: true }, { id: 'd', incoming: true }, { id: 'n', incoming: false },
  ];
  assert.equal(countUnseenIncoming(entries, 'b'), 2, 'notes and own messages are not announced');
  assert.equal(countUnseenIncoming(entries, 'n'), 0);
  assert.equal(countUnseenIncoming(entries, null), 0);
  assert.equal(countUnseenIncoming(entries, 'sumiu'), 0, 'unknown marker (filter/other chat) never raises a false alert');
  assert.equal(countUnseenIncoming([], 'a'), 0);
});

test('label is singular/plural in pt-BR', () => {
  assert.equal(unseenLabel(1), '1 nova mensagem');
  assert.equal(unseenLabel(3), '3 novas mensagens');
});
