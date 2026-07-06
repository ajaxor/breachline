import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG, UNIT_ROLE, UNIT_TAG, UNIT_TYPES } from '../src/data/gameConfig.js';
import { validateGameData } from '../src/data/validateGameData.js';

test('current game data passes validation', () => {
  assert.equal(validateGameData(), true);
});

test('all configured deployment columns are valid and disjoint', () => {
  const allColumns = [...GAME_CONFIG.playerZone, ...GAME_CONFIG.enemyZone];
  assert.equal(new Set(allColumns).size, allColumns.length);
  assert.ok(allColumns.every((column) => column >= 0 && column < GAME_CONFIG.columns));
});

test('unit registry keys and definitions agree', () => {
  for (const [key, type] of Object.entries(UNIT_TYPES)) {
    assert.equal(type.key, key);
  }
});

test('structures always receive stationary and AI-only tags', () => {
  const structures = Object.values(UNIT_TYPES).filter((type) => type.role === UNIT_ROLE.STRUCTURE);
  assert.ok(structures.length > 0);
  for (const structure of structures) {
    assert.ok(structure.tags.includes(UNIT_TAG.STATIONARY));
    assert.ok(structure.tags.includes(UNIT_TAG.AI_ONLY));
  }
});

test('flying units do not retain redundant ground movement tags', () => {
  const flying = Object.values(UNIT_TYPES).filter((type) => type.tags.includes(UNIT_TAG.FLYING));
  assert.ok(flying.length > 0);
  for (const type of flying) {
    assert.ok(!type.tags.includes(UNIT_TAG.FAST_ATTACK));
    assert.ok(!type.tags.includes(UNIT_TAG.CAN_MOVE_SIDEWAYS));
  }
});
