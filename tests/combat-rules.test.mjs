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
  resolver.processUnit = (_model, unit) => { calls.push(unit.id); return false; };
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

test('bomb and aoe tags detonate around the attacker for full damage', () => {
  const bomber = createBattleUnit({ id: 1, type: 'bomber', row: 2, column: 2 });
  const target = createBattleUnit({ id: 2, team: TEAM.ENEMY, row: 2, column: 3 });
  const besideAttacker = createBattleUnit({ id: 3, team: TEAM.ENEMY, row: 1, column: 2 });
  const diagonalEnemy = createBattleUnit({ id: 4, team: TEAM.ENEMY, row: 1, column: 3 });
  const model = withUnits(bomber, target, besideAttacker, diagonalEnemy);
  model.processUnit(bomber, 150, 100);
  assert.equal(hasUnitTag(UNIT_TYPES.bomber, UNIT_TAG.BOMB), true);
  assert.equal(hasUnitTag(UNIT_TYPES.bomber, UNIT_TAG.AOE), true);
  assert.equal(target.hp, UNIT_TYPES.grunt.hp - UNIT_TYPES.bomber.attack);
  assert.equal(besideAttacker.hp, UNIT_TYPES.grunt.hp - UNIT_TYPES.bomber.attack);
  assert.equal(diagonalEnemy.hp, UNIT_TYPES.grunt.hp - UNIT_TYPES.bomber.attack);
  assert.equal(bomber.alive, false);
  assert.equal(model.combatEvents.filter((event) => event.type === COMBAT_EVENT.UNIT_DETONATED).length, 1);
  assert.equal(model.combatEvents.filter((event) => event.type === COMBAT_EVENT.SPLASH_HIT).length, 3);
  assert.equal(model.combatEvents.some((event) => event.type === COMBAT_EVENT.UNIT_ATTACKED), false);
});

test('detonation events use the unit animated position instead of its movement destination', () => {
  const firefly = createBattleUnit({
    id: 1,
    type: 'firefly',
    row: 2,
    column: 3,
    overrides: { previousRow: 2, previousColumn: 2, animationStartedAt: 100, animationDuration: 200 },
  });
  const target = createBattleUnit({ id: 2, team: TEAM.ENEMY, row: 2, column: 4 });
  const model = withUnits(firefly, target);
  model.processUnit(firefly, 150, 100);
  const event = model.combatEvents.find((candidate) => candidate.type === COMBAT_EVENT.UNIT_DETONATED);
  assert.equal(event.unit.row, 2);
  assert.equal(event.unit.column, 2.5);
});

test('units can occupy the end column and target the line behind the grid', () => {
  const unit = createBattleUnit({ id: 1, row: 2, column: GAME_CONFIG.columns - 1 });
  const model = withUnits(unit);
  assert.equal(model.units.some((candidate) => candidate.type === 'wall' && candidate.lineObjective), false);
  assert.equal(model.moveUnit(unit, 100, 100), false);
  assert.equal(unit.breached, false);
  assert.equal(model.tryCombatAction(unit, UNIT_TYPES.grunt, 100, 100), true);
  assert.equal(model.enemyLineHp, GAME_CONFIG.baseHp - UNIT_TYPES.grunt.attack);
  assert.equal(model.combatEvents.at(-1).type, COMBAT_EVENT.UNIT_ATTACKED);
  assert.equal(model.combatEvents.at(-1).target.lineObjective, true);
});

test('bomb units detonate against virtual line targets', () => {
  const bomber = createBattleUnit({ id: 1, type: 'bomber', row: 2, column: GAME_CONFIG.columns - 1 });
  const model = withUnits(bomber);
  model.processUnit(bomber, 100, 100);
  assert.equal(model.enemyLineHp, GAME_CONFIG.baseHp - UNIT_TYPES.bomber.attack);
  assert.equal(bomber.alive, false);
  assert.equal(model.combatEvents.some((event) => event.type === COMBAT_EVENT.SPLASH_HIT && event.target.lineObjective), true);
  assert.equal(model.combatEvents.some((event) => event.type === COMBAT_EVENT.UNIT_DETONATED), true);
});

test('flying units do not move onto aircraft or friendly ground units', () => {
  const flyer = createBattleUnit({ id: 1, type: 'flyer', row: 2, column: 4 });
  const friendlyGround = createBattleUnit({ id: 2, team: TEAM.PLAYER, row: 2, column: 5 });
  let model = withUnits(flyer, friendlyGround);
  assert.equal(model.moveUnit(flyer, 100, 100), false);
  assert.deepEqual({ row: flyer.row, column: flyer.column }, { row: 2, column: 4 });

  const leadFlyer = createBattleUnit({ id: 3, type: 'midge', row: 3, column: 5 });
  flyer.row = 3;
  flyer.column = 4;
  model = withUnits(flyer, leadFlyer);
  assert.equal(model.moveUnit(flyer, 100, 100), false);
  assert.deepEqual({ row: flyer.row, column: flyer.column }, { row: 3, column: 4 });

  const enemyGround = createBattleUnit({ id: 4, team: TEAM.ENEMY, row: 4, column: 5 });
  flyer.row = 4;
  flyer.column = 4;
  model = withUnits(flyer, enemyGround);
  assert.equal(model.moveUnit(flyer, 100, 100), true);
  assert.deepEqual({ row: flyer.row, column: flyer.column }, { row: 4, column: 5 });
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

test('barricade thorns reflect melee damage back to attackers', () => {
  const attacker = createBattleUnit({ id: 1, row: 2, column: 6 });
  const barricade = createBattleUnit({ id: 2, team: TEAM.ENEMY, type: 'tollbooth', row: 2, column: 7 });
  const model = withUnits(attacker, barricade);
  model.attackUnit(attacker, barricade, [barricade], 100, 100);
  assert.equal(hasUnitTag(UNIT_TYPES.tollbooth, UNIT_TAG.THORNS), true);
  assert.equal(barricade.hp, UNIT_TYPES.tollbooth.hp - UNIT_TYPES.grunt.attack);
  assert.equal(attacker.hp, UNIT_TYPES.grunt.hp - Math.ceil(UNIT_TYPES.grunt.attack * UNIT_TYPES.tollbooth.thorns.reflectRatio));
});

test('factories produce cheap melee units into the lane ahead', () => {
  const factory = createBattleUnit({ id: 1, team: TEAM.ENEMY, type: 'factory', row: 2, column: 10 });
  const model = withUnits(factory);
  model.nextUnitId = 2;
  assert.equal(hasUnitTag(UNIT_TYPES.factory, UNIT_TAG.FACTORY), true);
  assert.equal(model.processUnit(factory, 100, 100), true);
  const produced = model.units.find((unit) => unit.id === 2);
  assert.ok(produced, 'factory did not create a unit');
  assert.equal(produced.type, UNIT_TYPES.factory.production.type);
  assert.equal(UNIT_TYPES[produced.type].role, 'melee');
  assert.deepEqual({ row: produced.row, column: produced.column, team: produced.team }, { row: 2, column: 9, team: TEAM.ENEMY });
  assert.equal(model.occupantAt(2, 9), produced);
});

test('stationary units never move', () => {
  const structure = createBattleUnit({ id: 1, team: TEAM.ENEMY, type: 'tollbooth', row: 2, column: 10 });
  const model = withUnits(structure);
  assert.equal(model.moveUnit(structure, 100, 100), false);
  assert.deepEqual({ row: structure.row, column: structure.column }, { row: 2, column: 10 });
});

test('simultaneous line breach and mutual annihilation resolve as defeats', () => {
  const model = new GameModel();
  model.playerLineHp = 0;
  model.enemyLineHp = 0;
  let result = model.determineResult();
  assert.equal(result.cssClass, RESULT_TYPE.ENEMY_WIN);
  assert.equal(result.playerWon, false);
  model.playerLineHp = GAME_CONFIG.baseHp;
  model.enemyLineHp = GAME_CONFIG.baseHp;
  model.units = [
    createBattleUnit({ id: 1, overrides: { alive: false } }),
    createBattleUnit({ id: 2, team: TEAM.ENEMY, overrides: { alive: false } }),
  ];
  result = model.determineResult();
  assert.equal(result.cssClass, RESULT_TYPE.ENEMY_WIN);
  assert.equal(result.playerWon, false);
});
