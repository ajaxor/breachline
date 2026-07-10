import test from 'node:test';
import assert from 'node:assert/strict';

import { MODE, TEAM, UNIT_TYPES } from '../src/data/gameConfig.js';
import { COMBAT_EVENT } from '../src/data/gameTypes.js';
import { GameModel } from '../src/model/GameModel.js';
import { SpatialIndex } from '../src/model/SpatialIndex.js';
import { createBattleUnit } from './helpers/createBattleUnit.mjs';

function prepareModel(units, random = () => 0.5) {
  const model = new GameModel({ random, now: () => 0 });
  model.mode = MODE.BATTLE;
  model.units = units;
  model.spatialIndex = new SpatialIndex(units);
  return model;
}

test('non-swivel ranged units use sideways targets only when forward movement is blocked', () => {
  const sniper = createBattleUnit({ id: 1, team: TEAM.PLAYER, type: 'sniper', row: 2, column: 2 });
  const blocker = createBattleUnit({ id: 2, team: TEAM.PLAYER, type: 'grunt', row: 2, column: 3 });
  const sideTarget = createBattleUnit({ id: 3, team: TEAM.ENEMY, type: 'grunt', row: 4, column: 2 });
  const blockedModel = prepareModel([sniper, blocker, sideTarget]);

  assert.equal(blockedModel.actionResolver.buildTargetPlan(blockedModel, blockedModel.units).get(sniper.id), sideTarget.id);

  const unblockedSniper = createBattleUnit({ id: 4, team: TEAM.PLAYER, type: 'sniper', row: 2, column: 2 });
  const unblockedSideTarget = createBattleUnit({ id: 5, team: TEAM.ENEMY, type: 'grunt', row: 4, column: 2 });
  const unblockedModel = prepareModel([unblockedSniper, unblockedSideTarget]);

  assert.equal(unblockedModel.actionResolver.buildTargetPlan(unblockedModel, unblockedModel.units).get(unblockedSniper.id), null);
});

test('ground melee ignores flying units while ground ranged units can target them', () => {
  const model = new GameModel({ random: () => 0.5, now: () => 0 });
  const flyer = createBattleUnit({ id: 1, team: TEAM.ENEMY, type: 'flyer', row: 2, column: 3 });
  const grunt = createBattleUnit({ id: 2, team: TEAM.PLAYER, type: 'grunt', row: 2, column: 2 });
  const sniper = createBattleUnit({ id: 3, team: TEAM.PLAYER, type: 'sniper', row: 2, column: 1 });

  assert.equal(model.canTarget(grunt, flyer), false);
  assert.equal(model.canTarget(sniper, flyer), true);
});

test('flying units evade half of non-anti-air ground ranged attacks', () => {
  const sniper = createBattleUnit({ id: 1, team: TEAM.PLAYER, type: 'sniper', row: 2, column: 1 });
  const evadingFlyer = createBattleUnit({ id: 2, team: TEAM.ENEMY, type: 'flyer', row: 2, column: 3 });
  const evadeModel = prepareModel([sniper, evadingFlyer], () => 0.49);

  evadeModel.attackUnit(sniper, evadingFlyer, [], 0, 100);
  assert.equal(evadingFlyer.hp, UNIT_TYPES.flyer.hp);
  assert.equal(evadeModel.combatEvents.at(-1).type, COMBAT_EVENT.UNIT_ATTACKED);
  assert.equal(evadeModel.combatEvents.at(-1).damage, 0);
  assert.equal(evadeModel.combatEvents.at(-1).evaded, true);

  const hittingSniper = createBattleUnit({ id: 3, team: TEAM.PLAYER, type: 'sniper', row: 2, column: 1 });
  const hitFlyer = createBattleUnit({ id: 4, team: TEAM.ENEMY, type: 'flyer', row: 2, column: 3 });
  const hitModel = prepareModel([hittingSniper, hitFlyer], () => 0.5);

  hitModel.attackUnit(hittingSniper, hitFlyer, [], 0, 100);
  assert.equal(hitFlyer.hp, UNIT_TYPES.flyer.hp - UNIT_TYPES.sniper.attack);
});

test('anti-air attacks bypass flying evasion', () => {
  const gunner = createBattleUnit({ id: 1, team: TEAM.PLAYER, type: 'gunner', row: 2, column: 1 });
  const flyer = createBattleUnit({ id: 2, team: TEAM.ENEMY, type: 'flyer', row: 2, column: 2 });
  const model = prepareModel([gunner, flyer], () => 0);

  model.attackUnit(gunner, flyer, [], 0, 100);
  assert.equal(flyer.hp, UNIT_TYPES.flyer.hp - UNIT_TYPES.gunner.attack);
  assert.equal(model.combatEvents.at(-1).damage, UNIT_TYPES.gunner.attack);
});
