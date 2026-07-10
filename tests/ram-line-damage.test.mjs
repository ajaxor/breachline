import test from 'node:test';
import assert from 'node:assert/strict';

import { GAME_CONFIG, UNIT_TYPES } from '../src/data/gameConfig.js';
import { GameModel } from '../src/model/GameModel.js';
import { SpatialIndex } from '../src/model/SpatialIndex.js';
import { createBattleUnit } from './helpers/createBattleUnit.mjs';

test('Ram wall crushing deals double damage to the enemy battle line', () => {
  const ram = createBattleUnit({ id: 1, type: 'ram', row: 2, column: GAME_CONFIG.columns - 1 });
  const model = new GameModel({ random: () => 0.5, now: () => 100 });
  model.units = [ram];
  model.spatialIndex = new SpatialIndex(model.units);

  assert.equal(model.tryCombatAction(ram, UNIT_TYPES.ram, 100, 100), true);
  assert.equal(model.enemyLineHp, GAME_CONFIG.baseHp - UNIT_TYPES.ram.attack * 2);
  assert.equal(model.combatEvents.at(-1).damage, UNIT_TYPES.ram.attack * 2);
});
