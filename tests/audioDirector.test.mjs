import assert from 'node:assert/strict';
import test from 'node:test';

import { EFFECT_TYPE } from '../src/data/gameTypes.js';
import { limitSimultaneousEffects } from '../src/frontend/AudioDirector.js';

test('simultaneous audio limiter caps a breach-sized burst and keeps high-impact cues', () => {
  const effects = [
    ...Array.from({ length: 12 }, (_, index) => ({ type: EFFECT_TYPE.DEATH, start: 100, unitId: index })),
    { type: EFFECT_TYPE.EXPLOSION, start: 100, intensity: 1.2 },
    { type: EFFECT_TYPE.RANGED, start: 100 },
  ];

  const limited = limitSimultaneousEffects(effects);

  assert.equal(limited.length, 4);
  assert.ok(limited.some((effect) => effect.type === EFFECT_TYPE.EXPLOSION));
  assert.ok(limited.some((effect) => effect.type === EFFECT_TYPE.RANGED));
  assert.equal(limited.filter((effect) => effect.type === EFFECT_TYPE.DEATH).length, 2);
});

test('simultaneous audio limiter preserves recurring cues that occur at different times', () => {
  const effects = Array.from({ length: 8 }, (_, index) => ({ type: EFFECT_TYPE.RANGED, start: index * 90 }));
  assert.deepEqual(limitSimultaneousEffects(effects), effects);
});

test('simultaneous audio limiter groups only effects inside the overlap window', () => {
  const effects = [
    { type: EFFECT_TYPE.DEATH, start: 0 },
    { type: EFFECT_TYPE.DEATH, start: 10 },
    { type: EFFECT_TYPE.DEATH, start: 20 },
    { type: EFFECT_TYPE.DEATH, start: 24 },
    { type: EFFECT_TYPE.DEATH, start: 25 },
  ];
  assert.equal(limitSimultaneousEffects(effects).length, 5);
});
