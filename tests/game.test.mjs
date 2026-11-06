import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { answerCountry, archive, attemptMistakes, newGame, readProfile, roundMistakes, STORAGE_KEY } from '../src/game.ts';

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
});

function profile() {
  return { version: 2, mistakes: [], history: [], sound: false, theme: 'dusk',
    active: { ...newGame(), order: ['634', '356', '392'] } };
}
function readSaved(saved) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem(key) { assert.equal(key, STORAGE_KEY); return JSON.stringify(saved); },
  } });
  return readProfile();
}

test('a wrong guess records the requested country, not the country clicked', () => {
  const first = answerCountry(profile(), '356');
  const second = answerCountry(first, '392');
  assert.deepEqual(second.mistakes, ['634']);
  assert.deepEqual(roundMistakes(second.active), ['634']);
  assert.equal(second.active.misses, 2);
});

test('first-try answers are excluded; retries and reveals remain practice targets', () => {
  let p = answerCountry(profile(), '634');
  assert.deepEqual(p.mistakes, []);
  p = answerCountry(p, '392');
  p = answerCountry(p, '356');
  for (let i = 0; i < 3; i++) p = answerCountry(p, '643');
  // Russia is outside this focused round, so it must not count as a guess.
  assert.equal(p.active.misses, 0);
  assert.deepEqual(p.mistakes, ['356']);
  const full = { ...profile(), active: { ...newGame(), order: ['634', '356', '392', '643'] } };
  let assisted = full;
  for (let i = 0; i < 3; i++) assisted = answerCountry(assisted, '356');
  assisted = answerCountry(assisted, '634');
  assert.equal(assisted.active.answers[0].assisted, true);
  assert.deepEqual(assisted.mistakes, ['634']);
});

test('archiving an unfinished target retains the mistake after reload', () => {
  const p = answerCountry(profile(), '356');
  const history = archive(p, p.active);
  assert.equal(history[0].answers.length, 0);
  assert.deepEqual(attemptMistakes(history[0]), ['634']);
  const restored = readSaved({ ...p, mistakes: [], history, active: newGame() });
  assert.deepEqual(restored.mistakes, ['634']);
});

test('legacy saves recover retries and reveals without losing the current quiz', () => {
  const current = { ...profile().active, misses: 1, guesses: 1, started: true };
  const saved = { version: 1, known: ['634', '356'], active: current, sound: false, theme: 'dusk', history: [{
    id: 'old-round', date: 1, total: 3, guesses: 7, elapsed: 20, complete: true,
    answers: [{ id: '634', misses: 0, assisted: false }, { id: '356', misses: 1, assisted: false }, { id: '392', misses: 3, assisted: true }],
  }] };
  const restored = readSaved(saved);
  assert.equal(restored.version, 2);
  assert.deepEqual(restored.mistakes, ['356', '392', '634']);
  assert.deepEqual(restored.active, current);
  assert.deepEqual(restored.history, saved.history);
  assert.equal(restored.sound, false);
  assert.equal(restored.theme, 'dusk');
});

test('legacy known-country practice is replaced with a mistakes-only round', () => {
  const saved = { ...profile(), version: 1, known: ['356', '392'],
    active: { ...newGame('practice', ['356', '392']), order: ['356', '392'] },
    history: [{ id: 'missed-qatar', date: 1, total: 1, guesses: 2, elapsed: 3, complete: true,
      answers: [{ id: '634', misses: 1, assisted: false }] }],
  };
  const restored = readSaved(saved);
  assert.equal(restored.active.mode, 'practice');
  assert.deepEqual(restored.active.order, ['634']);
  assert.deepEqual(restored.mistakes, ['634']);
  assert.notEqual(restored.active.id, saved.active.id);
});

test('a perfect old attempt supplies no mistake practice', () => {
  const saved = { ...profile(), version: 1, known: ['634'],
    active: newGame('practice', ['634']),
    history: [{ id: 'perfect', date: 1, total: 1, guesses: 1, elapsed: 3, complete: true,
      answers: [{ id: '634', misses: 0, assisted: false }] }],
  };
  const restored = readSaved(saved);
  assert.deepEqual(restored.mistakes, []);
  assert.equal(restored.active.mode, 'quiz');
  assert.deepEqual(attemptMistakes(restored.history[0]), []);
});
