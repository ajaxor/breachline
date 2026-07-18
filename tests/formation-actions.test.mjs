import test from 'node:test';
import assert from 'node:assert/strict';
import { MODE, TEAM, UNIT_TYPES } from '../src/data/gameConfig.js';
import { COMBAT_EVENT } from '../src/data/gameTypes.js';
import { GameModel } from '../src/model/GameModel.js';
import { SpatialIndex } from '../src/model/SpatialIndex.js';
import { createBattleUnit } from './helpers/createBattleUnit.mjs';

function prepareBattleModel(units) {
  const model = new GameModel({ random: () => 0.5, now: () => 0 });
  model.mode = MODE.BATTLE;
  model.units = units;
  model.spatialIndex = new SpatialIndex(units);
  return model;
}

test('formation medics move and heal during the same tick', () => {
  const commander = createBattleUnit({ id: 1, team: TEAM.PLAYER, type: 'commander', row: 0, column: 0 });
  const medic = createBattleUnit({ id: 2, team: TEAM.PLAYER, type: 'healer', row: 1, column: 0 });
  const patient = createBattleUnit({ id: 3, team: TEAM.PLAYER, type: 'grunt', row: 2, column: 0 });
  patient.hp = patient.maxHp - 5;
  const model = prepareBattleModel([commander, medic, patient]);

  model.actionResolver.processQueue(model, model.units, 0, 100);

  assert.equal(commander.column, 1);
  assert.equal(medic.column, 1);
  assert.equal(patient.column, 1);
  assert.equal(patient.hp, Math.min(patient.maxHp, patient.maxHp - 5 + UNIT_TYPES.healer.healAmount));
  assert.ok(model.combatEvents.some((event) => event.type === COMBAT_EVENT.UNIT_HEALED && event.source.id === medic.id));
});

test('formation rams destroy walls and advance the whole formation', () => {
  const commander = createBattleUnit({ id: 1, team: TEAM.PLAYER, type: 'commander', row: 0, column: 0 });
  const ram = createBattleUnit({ id: 2, team: TEAM.PLAYER, type: 'ram', row: 1, column: 0 });
  const wall = createBattleUnit({ id: 3, team: TEAM.ENEMY, type: 'wall', row: 1, column: 1 });
  const model = prepareBattleModel([commander, ram, wall]);

  model.actionResolver.processQueue(model, model.units, 0, 100);

  assert.equal(wall.alive, false);
  assert.equal(commander.column, 1);
  assert.equal(ram.column, 1);
});
