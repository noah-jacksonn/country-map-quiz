import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { nearestMarker } from '../src/map-interaction.ts';
import { answerCountry, newGame } from '../src/game.ts';

const { anchors } = JSON.parse(readFileSync(new URL('../src/data/map.json', import.meta.url), 'utf8'));

test('Bahrain and Qatar remain individually selectable when their hit areas overlap', () => {
  for (const [width, height, radius] of [[1366, 768, 10], [390, 844, 13]]) {
    const scale = Math.min(width / 1600, height / 1000) * 1.5;
    const markers = ['048', '634'].map(id => ({ id, x: anchors[id][0] * scale, y: anchors[id][1] * scale }));
    const [bahrain, qatar] = markers;
    assert.ok(Math.hypot(bahrain.x - qatar.x, bahrain.y - qatar.y) < radius);
    for (const order of [markers, [...markers].reverse()]) {
      assert.equal(nearestMarker(bahrain, order), '048');
      assert.equal(nearestMarker(qatar, order), '634');
      assert.equal(nearestMarker({ x: bahrain.x * 0.75 + qatar.x * 0.25, y: bahrain.y * 0.75 + qatar.y * 0.25 }, order), '048');
    }
  }
});

test('marker selection only considers the countries included in practice', () => {
  assert.equal(nearestMarker({ x: 10, y: 10 }, [{ id: '048', x: 20, y: 20 }]), '048');
  assert.equal(nearestMarker({ x: 10, y: 10 }, []), null);
});

test('a found tiny country remains protected from its neighboring marker', () => {
  const markers = ['048', '634'].map(id => ({ id, x: anchors[id][0], y: anchors[id][1] }));
  for (const found of markers) {
    let profile = { version: 2, mistakes: [], history: [], sound: false, theme: 'ocean',
      active: { ...newGame(), order: [found.id, '356', markers.find(marker => marker.id !== found.id).id] } };
    profile = answerCountry(profile, found.id);
    const resolved = nearestMarker(found, markers);
    assert.equal(resolved, found.id);
    assert.equal(answerCountry(profile, resolved), profile);
    assert.equal(profile.active.guesses, 1);
    assert.deepEqual(profile.mistakes, []);
  }
});
