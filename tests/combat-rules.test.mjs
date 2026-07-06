import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG, TEAM, UNIT_TYPES } from '../src/data/gameConfig.js';
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

  model.spatialIndex.move(enemy, enemy.row, enemy.column);
  enemy.column = 3;
  model.spatialIndex = new SpatialIndex(model.units);
  model.refreshStealth();
  assert.equal(infiltrator.stealthed, false);
  assert.equal(model.canTarget(enemy, infiltrator, UNIT_TYPES.grunt), true);
});

test('healers restore the nearest damaged ally and emit a semantic event', () => {
  const healer = createBattleUnit({ id: 1, type: 'healer', row: 2, column: 2 });
  const ally = createBattleUnit({ id: 2, type: 'tank', row: 3, column: 3, overrides: { hp: 50 } });
  const model = withUnits(healer, ally);

  assert.equal(model.tryCombatAction(healer, UNIT_TYPES.healer, 100, 100), true);
  assert.equal(ally.hp, 62);
  assert.equal(model.combatEvents.at(-1).type, COMBAT_EVENT.UNIT_HEALED);
  assert.equal(model.combatEvents.at(-1).amount, 12);
});

test('detonation damages adjacent enemies, spares distant enemies, and destroys the attacker', () => {
  const bomber = createBattleUnit({ id: 1, type: 'bomber', row: 2, column: 2 });
  const target = createBattleUnit({ id: 2, team: TEAM.ENEMY, row: 2, column: 3 });
  const adjacent = createBattleUnit({ id: 3, team: TEAM.ENEMY, row: 1, column: 3 });
  const distant = createBattleUnit({ id: 4, team: TEAM.ENEMY, row: 0, column: 5 });
  const model = withUnits(bomber, target, adjacent, distant);

  model.attackUnit(bomber, target, [target, adjacent, distant], 100, 100);

  assert.equal(target.hp, UNIT_TYPES.grunt.hp - UNIT_TYPES.bomber.attack);
  assert.equal(adjacent.hp, UNIT_TYPES.grunt.hp - Math.round(UNIT_TYPES.bomber.attack * 0.55));
  assert.equal(distant.hp, UNIT_TYPES.grunt.hp);
  assert.equal(bomber.alive, false);
  assert.deepEqual(model.combatEvents.map((event) => event.type), [
    COMBAT_EVENT.UNIT_ATTACKED,
    COMBAT_EVENT.SPLASH_HIT,
    COMBAT_EVENT.UNIT_DETONATED,
  ]);
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

test('sideways movers take an open adjacent lane when blocked', () => {
  const mover = createBattleUnit({ id: 1, type: 'sidestepper', row: 2, column: 0 });
  const blocker = createBattleUnit({ id: 2, row: 2, column: 1 });
  const model = withUnits(mover, blocker);

  assert.equal(model.moveUnit(mover, 100, 100), true);
  assert.deepEqual({ row: mover.row, column: mover.column }, { row: 1, column: 1 });
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
