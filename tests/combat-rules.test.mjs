import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG, TEAM, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../src/data/gameConfig.js';
import { COMBAT_EVENT, RESULT_TYPE } from '../src/data/gameTypes.js';
import { CombatActionResolver } from '../src/model/CombatActionResolver.js';
import { GameModel } from '../src/model/GameModel.js';
import { SpatialIndex } from '../src/model/SpatialIndex.js';
import { createBattleUnit } from './helpers/createBattleUnit.mjs';

function withUnits(...units) {
  const model = new GameModel({ random: () => 0.5, now: () => 100 });
  model.units = units;
  model.spatialIndex = new SpatialIndex(units);
  return model;
}

test('action queue moves passing units behind units that can act', () => {
  const resolver = new CombatActionResolver();
  const first = { id: 1, alive: true };
  const second = { id: 2, alive: true };
  const calls = [];
  let firstAttempts = 0;
  resolver.processUnit = (_model, unit) => {
    calls.push(unit.id);
    if (unit.id === first.id && firstAttempts++ === 0) return false;
    return true;
  };

  resolver.processQueue({}, [first, second], 0, 100);
  assert.deepEqual(calls, [1, 2, 1]);
});

test('action queue stops after every remaining unit passes', () => {
  const resolver = new CombatActionResolver();
  const units = [{ id: 1, alive: true }, { id: 2, alive: true }];
  const calls = [];
  resolver.processUnit = (_model, unit) => {
    calls.push(unit.id);
    return false;
  };

  resolver.processQueue({}, units, 0, 100);
  assert.deepEqual(calls, [1, 2]);
});

test('stealth remains active at range and breaks when an enemy is adjacent', () => {
  const infiltrator = createBattleUnit({ id: 1, type: 'infiltrator', row: 2, column: 2 });
  const enemy = createBattleUnit({ id: 2, team: TEAM.ENEMY, row: 2, column: 5 });
  const model = withUnits(infiltrator, enemy);

  model.refreshStealth();
  assert.equal(infiltrator.stealthed, true);
  assert.equal(model.canTarget(enemy, infiltrator, UNIT_TYPES.sniper), false);

  enemy.column = 3;
  model.spatialIndex = new SpatialIndex(model.units);
  model.refreshStealth();
  assert.equal(infiltrator.stealthed, false);
  assert.equal(model.canTarget(enemy, infiltrator, UNIT_TYPES.grunt), true);
});

test('healers use the heal tag and restore the nearest damaged ally', () => {
  const healer = createBattleUnit({ id: 1, type: 'healer', row: 2, column: 2 });
  const ally = createBattleUnit({ id: 2, type: 'tank', row: 3, column: 3, overrides: { hp: 50 } });
  const model = withUnits(healer, ally);

  assert.equal(hasUnitTag(UNIT_TYPES.healer, UNIT_TAG.HEAL), true);
  assert.equal(model.tryCombatAction(healer, UNIT_TYPES.healer, 100, 100), true);
  assert.equal(ally.hp, 62);
  assert.equal(model.combatEvents.at(-1).type, COMBAT_EVENT.UNIT_HEALED);
  assert.equal(model.combatEvents.at(-1).amount, 12);
});

test('bomb and aoe tags splash around the target and destroy the attacker', () => {
  const bomber = createBattleUnit({ id: 1, type: 'bomber', row: 2, column: 2 });
  const target = createBattleUnit({ id: 2, team: TEAM.ENEMY, row: 2, column: 3 });
  const besideTarget = createBattleUnit({ id: 3, team: TEAM.ENEMY, row: 1, column: 3 });
  const besideAttackerOnly = createBattleUnit({ id: 4, team: TEAM.ENEMY, row: 1, column: 1 });
  const model = withUnits(bomber, target, besideTarget, besideAttackerOnly);

  model.attackUnit(bomber, target, [target, besideTarget, besideAttackerOnly], 100, 100);

  assert.equal(hasUnitTag(UNIT_TYPES.bomber, UNIT_TAG.BOMB), true);
  assert.equal(hasUnitTag(UNIT_TYPES.bomber, UNIT_TAG.AOE), true);
  assert.equal(target.hp, UNIT_TYPES.grunt.hp - UNIT_TYPES.bomber.attack);
  assert.equal(besideTarget.hp, UNIT_TYPES.grunt.hp - Math.round(UNIT_TYPES.bomber.attack * 0.55));
  assert.equal(besideAttackerOnly.hp, UNIT_TYPES.grunt.hp);
  assert.equal(bomber.alive, false);
  assert.deepEqual(model.combatEvents.map((event) => event.type), [
    COMBAT_EVENT.UNIT_ATTACKED,
    COMBAT_EVENT.SPLASH_HIT,
    COMBAT_EVENT.UNIT_DETONATED,
  ]);
});

test('death events use the unit animated position instead of its movement destination', () => {
  const firefly = createBattleUnit({
    id: 1,
    type: 'firefly',
    row: 2,
    column: 3,
    overrides: {
      previousRow: 2,
      previousColumn: 2,
      animationStartedAt: 100,
      animationDuration: 200,
    },
  });
  const target = createBattleUnit({ id: 2, team: TEAM.ENEMY, row: 2, column: 4 });
  const model = withUnits(firefly, target);

  model.attackUnit(firefly, target, [target], 150, 100);

  const event = model.combatEvents.find((candidate) => candidate.type === COMBAT_EVENT.UNIT_DETONATED);
  assert.equal(event.unit.row, 2);
  assert.equal(event.unit.column, 2.25);
});

test('units breach the edge and then damage the opposing base', () => {
  const unit = createBattleUnit({ id: 1, row: 2, column: GAME_CONFIG.columns - 1 });
  const model = withUnits(unit);

  assert.equal(model.moveUnit(unit, 100, 100), true);
  assert.equal(unit.breached, true);
  assert.equal(model.combatEvents.at(-1).type, COMBAT_EVENT.UNIT_BREACHED);

  model.attackBase(unit, 100, 100);
  assert.equal(model.enemyBaseHp, GAME_CONFIG.baseHp - UNIT_TYPES.grunt.attack);
  assert.equal(model.combatEvents.at(-1).type, COMBAT_EVENT.BASE_ATTACKED);
});

test('agile units dodge the first attack into an open adjacent lane', () => {
  const attacker = createBattleUnit({ id: 1, row: 2, column: 1 });
  const agile = createBattleUnit({ id: 2, team: TEAM.ENEMY, type: 'sidestepper', row: 2, column: 2 });
  const model = withUnits(attacker, agile);

  model.attackUnit(attacker, agile, [agile], 100, 100);

  assert.equal(hasUnitTag(UNIT_TYPES.sidestepper, UNIT_TAG.AGILE), true);
  assert.equal(agile.hp, UNIT_TYPES.sidestepper.hp);
  assert.deepEqual({ row: agile.row, column: agile.column }, { row: 3, column: 2 });
  assert.equal(agile.agileDodgeUsed, true);
  assert.equal(model.combatEvents.at(-1).type, COMBAT_EVENT.UNIT_DODGED);

  model.attackUnit(attacker, agile, [agile], 200, 100);
  assert.equal(agile.hp, UNIT_TYPES.sidestepper.hp - UNIT_TYPES.grunt.attack);
});

test('agile units consume their dodge when both adjacent lanes are blocked', () => {
  const attacker = createBattleUnit({ id: 1, row: 2, column: 1 });
  const agile = createBattleUnit({ id: 2, team: TEAM.ENEMY, type: 'sidestepper', row: 2, column: 2 });
  const upperBlocker = createBattleUnit({ id: 3, team: TEAM.ENEMY, row: 1, column: 2 });
  const lowerBlocker = createBattleUnit({ id: 4, team: TEAM.ENEMY, row: 3, column: 2 });
  const model = withUnits(attacker, agile, upperBlocker, lowerBlocker);

  model.attackUnit(attacker, agile, [agile, upperBlocker, lowerBlocker], 100, 100);

  assert.equal(agile.agileDodgeUsed, true);
  assert.equal(agile.hp, UNIT_TYPES.sidestepper.hp - UNIT_TYPES.grunt.attack);
  assert.deepEqual({ row: agile.row, column: agile.column }, { row: 2, column: 2 });
});

test('stationary units never move', () => {
  const structure = createBattleUnit({ id: 1, team: TEAM.ENEMY, type: 'tollbooth', row: 2, column: 10 });
  const model = withUnits(structure);

  assert.equal(model.moveUnit(structure, 100, 100), false);
  assert.deepEqual({ row: structure.row, column: structure.column }, { row: 2, column: 10 });
});

test('simultaneous base destruction and mutual annihilation resolve as draws', () => {
  const model = new GameModel();
  model.playerBaseHp = 0;
  model.enemyBaseHp = 0;
  assert.equal(model.determineResult().cssClass, RESULT_TYPE.DRAW);

  model.playerBaseHp = GAME_CONFIG.baseHp;
  model.enemyBaseHp = GAME_CONFIG.baseHp;
  model.units = [
    createBattleUnit({ id: 1, overrides: { alive: false } }),
    createBattleUnit({ id: 2, team: TEAM.ENEMY, overrides: { alive: false } }),
  ];
  assert.equal(model.determineResult().cssClass, RESULT_TYPE.DRAW);
});