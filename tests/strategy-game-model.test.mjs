import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG, ROLE_SHAPE, TEAM, UNIT_ROLE, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../src/data/gameConfig.js';
import { COMBAT_EVENT } from '../src/data/gameTypes.js';
import { GameModel } from '../src/model/GameModel.js';
import { SpatialIndex } from '../src/model/SpatialIndex.js';
import { StrategyGameModel } from '../src/model/StrategyGameModel.js';
import { createBattleUnit } from './helpers/createBattleUnit.mjs';

const createModel = () => new StrategyGameModel({ random: () => 0.5, now: () => 0 });

test('draft quantity is derived from budget and finite supply limits deployment', () => {
  const model = createModel();
  model.beginDrafts(1, 100);
  const choice = model.draftChoices[0];
  const expectedCount = Math.round(100 / choice.cost);
  assert.equal(choice.draftCount, expectedCount);
  assert.equal(model.chooseDraft(choice.key), true);
  assert.equal(model.supply[choice.key], expectedCount);

  model.setSelectedUnitType(choice.key);
  for (let row = 0; row < expectedCount; row += 1) assert.equal(model.togglePlacement(row, GAME_CONFIG.playerZone[0]), true);
  assert.equal(model.availableCount(choice.key), 0);
  assert.equal(model.togglePlacement(expectedCount, GAME_CONFIG.playerZone[0]), false);
});

test('launched units are permanently consumed and placement clears between missions', () => {
  const model = createModel();
  model.roster.grunt = true;
  model.supply.grunt = 3;
  model.setSelectedUnitType('grunt');
  model.togglePlacement(0, 0);
  model.togglePlacement(1, 0);
  assert.equal(model.startBattle(), true);
  assert.equal(model.supply.grunt, 1);
  model.finishBattle({ cssClass: 'player-win', text: 'test victory', playerWon: true });
  assert.equal(model.supply.grunt, 1);
  assert.equal(model.roster.grunt, true);
  model.returnToDeployment();
  assert.equal(model.placement.length, 0);
  assert.equal(model.supply.grunt, 1);
});

test('depleted unit types are removed from the roster after battle', () => {
  const model = createModel();
  model.roster.grunt = true;
  model.supply.grunt = 1;
  model.setSelectedUnitType('grunt');
  model.togglePlacement(0, 0);
  assert.equal(model.availableCount('grunt'), 0);
  assert.equal(model.startBattle(), true);
  model.finishBattle({ cssClass: 'enemy-win', text: 'test defeat', playerWon: false });
  assert.equal(model.roster.grunt, false);
  assert.equal(model.selectedUnitType, null);
});

test('reinforcement growth outpaces enemy budget growth', () => {
  const model = createModel();
  const enemyIncrease = model.campaign[1].enemyBudget - model.campaign[0].enemyBudget;
  const draftIncrease = model.campaign[1].draftBudget - model.campaign[0].draftBudget;
  assert.ok(draftIncrease > enemyIncrease);
});

test('unit roles determine the common icon silhouette', () => {
  for (const type of Object.values(UNIT_TYPES)) assert.equal(type.shape, ROLE_SHAPE[type.role]);
  assert.equal(UNIT_TYPES.grunt.shape, UNIT_TYPES.gunner.shape);
  assert.equal(UNIT_TYPES.sniper.shape, UNIT_TYPES.flak.shape);
  assert.equal(UNIT_TYPES.midge.shape, UNIT_TYPES.firefly.shape);
  assert.equal(UNIT_TYPES.grunt.role, UNIT_ROLE.MELEE);
  assert.equal(UNIT_TYPES.flak.role, UNIT_ROLE.RANGED);
});

test('flying unit definitions preserve their intended niches', () => {
  const flyingTypes = Object.values(UNIT_TYPES).filter((type) => hasUnitTag(type, UNIT_TAG.FLYING));
  assert.deepEqual(flyingTypes.map((type) => type.name), ['Midge', 'Wasp', 'Kite', 'Firefly']);
  assert.ok(flyingTypes.every((type) => type.hp < UNIT_TYPES.grunt.hp));
  assert.ok(flyingTypes.every((type) => type.shape === 'wing'));
  assert.ok(flyingTypes.every((type) => !hasUnitTag(type, UNIT_TAG.FAST_ATTACK)));
  assert.ok(flyingTypes.every((type) => !hasUnitTag(type, UNIT_TAG.CAN_MOVE_SIDEWAYS)));
  assert.ok(UNIT_TYPES.midge.cost < UNIT_TYPES.flyer.cost);
  assert.equal(UNIT_TYPES.kite.range, 4);
  assert.equal(hasUnitTag(UNIT_TYPES.firefly, UNIT_TAG.BOMB), true);
  assert.equal(hasUnitTag(UNIT_TYPES.firefly, UNIT_TAG.AOE), true);
});

test('only flying and anti-air units can target flying units', () => {
  const model = new GameModel({ random: () => 0.5, now: () => 0 });
  const flyingTarget = createBattleUnit({ id: 1, team: TEAM.ENEMY, type: 'flyer', row: 2, column: 2 });
  const rifleman = createBattleUnit({ id: 2, type: 'grunt', row: 2, column: 1 });
  const gunner = createBattleUnit({ id: 3, type: 'gunner', row: 2, column: 1 });
  const flak = createBattleUnit({ id: 4, type: 'flak', row: 1, column: 1 });
  const friendlyFlyer = createBattleUnit({ id: 5, type: 'midge', row: 2, column: 1 });
  assert.equal(model.canTarget(rifleman, flyingTarget), false);
  assert.equal(model.canTarget(gunner, flyingTarget), true);
  assert.equal(model.canTarget(flak, flyingTarget), true);
  assert.equal(model.canTarget(friendlyFlyer, flyingTarget), true);
  assert.equal(hasUnitTag('gunner', UNIT_TAG.ANTI_AIR), true);
  assert.equal(hasUnitTag('flak', UNIT_TAG.ANTI_AIR), true);
});

test('units cannot target enemies behind their direction of travel', () => {
  const model = new GameModel({ random: () => 0.5, now: () => 0 });
  const player = createBattleUnit({ id: 1, team: TEAM.PLAYER, type: 'gunner', row: 2, column: 4 });
  const enemyAhead = createBattleUnit({ id: 2, team: TEAM.ENEMY, type: 'grunt', row: 2, column: 5 });
  const enemyBehind = createBattleUnit({ id: 3, team: TEAM.ENEMY, type: 'grunt', row: 2, column: 3 });
  const enemy = createBattleUnit({ id: 4, team: TEAM.ENEMY, type: 'gunner', row: 2, column: 3 });
  const playerAhead = createBattleUnit({ id: 5, team: TEAM.PLAYER, type: 'grunt', row: 2, column: 2 });
  const playerBehind = createBattleUnit({ id: 6, team: TEAM.PLAYER, type: 'grunt', row: 2, column: 4 });
  assert.equal(model.canTarget(player, enemyAhead), true);
  assert.equal(model.canTarget(player, enemyBehind), false);
  assert.equal(model.canTarget(enemy, playerAhead), true);
  assert.equal(model.canTarget(enemy, playerBehind), false);
});

test('flying units overlap ground units and attack after moving', () => {
  const model = new GameModel({ random: () => 0.5, now: () => 0 });
  const flyer = createBattleUnit({ id: 1, type: 'flyer', row: 2, column: 0 });
  const allyBlocker = createBattleUnit({ id: 2, type: 'grunt', row: 2, column: 1 });
  const enemy = createBattleUnit({ id: 3, team: TEAM.ENEMY, type: 'grunt', row: 2, column: 2 });
  model.units = [flyer, allyBlocker, enemy];
  model.spatialIndex = new SpatialIndex(model.units);
  assert.equal(model.processUnit(flyer, 0, 100), true);
  assert.equal(flyer.column, 1);
  assert.equal(allyBlocker.column, flyer.column);
  assert.equal(enemy.hp, UNIT_TYPES.grunt.hp - UNIT_TYPES.flyer.attack);
});

test('targets are fixed at tick start so closing melee units do not attack mid-move', () => {
  const model = new GameModel({ random: () => 0.999, now: () => 0 });
  const player = createBattleUnit({ id: 1, team: TEAM.PLAYER, type: 'grunt', row: 2, column: 4 });
  const enemy = createBattleUnit({ id: 2, team: TEAM.ENEMY, type: 'grunt', row: 2, column: 6 });
  model.mode = 'battle';
  model.units = [player, enemy];
  model.spatialIndex = new SpatialIndex(model.units);
  model.tick();
  assert.equal(player.column, 5);
  assert.equal(enemy.column, 6);
  assert.equal(player.hp, UNIT_TYPES.grunt.hp);
  assert.equal(enemy.hp, UNIT_TYPES.grunt.hp);
});

test('bomb units detonate on themselves and deal full attack damage to adjacent enemies', () => {
  const model = new GameModel({ random: () => 0.5, now: () => 0 });
  const bomb = createBattleUnit({ id: 1, team: TEAM.PLAYER, type: 'bomber', row: 2, column: 4 });
  const frontEnemy = createBattleUnit({ id: 2, team: TEAM.ENEMY, type: 'tank', row: 2, column: 5 });
  const sideEnemy = createBattleUnit({ id: 3, team: TEAM.ENEMY, type: 'tank', row: 1, column: 4 });
  model.units = [bomb, frontEnemy, sideEnemy];
  model.spatialIndex = new SpatialIndex(model.units);
  assert.equal(model.processUnit(bomb, 0, 100), true);
  assert.equal(bomb.alive, false);
  assert.equal(frontEnemy.hp, UNIT_TYPES.tank.hp - UNIT_TYPES.bomber.attack);
  assert.equal(sideEnemy.hp, UNIT_TYPES.tank.hp - UNIT_TYPES.bomber.attack);
  const detonation = model.combatEvents.find((event) => event.type === COMBAT_EVENT.UNIT_DETONATED);
  assert.deepEqual({ row: detonation.unit.row, column: detonation.unit.column }, { row: 2, column: 4 });
  assert.equal(model.combatEvents.some((event) => event.type === COMBAT_EVENT.UNIT_ATTACKED), false);
});

test('destroyed bomb units still detonate', () => {
  const model = new GameModel({ random: () => 0.5, now: () => 0 });
  const attacker = createBattleUnit({ id: 1, team: TEAM.PLAYER, type: 'tank', row: 2, column: 4 });
  const bomb = createBattleUnit({ id: 2, team: TEAM.ENEMY, type: 'bomber', row: 2, column: 5 });
  bomb.hp = 1;
  model.units = [attacker, bomb];
  model.spatialIndex = new SpatialIndex(model.units);
  model.attackUnit(attacker, bomb, [bomb], 0, 100);
  assert.equal(bomb.alive, false);
  assert.equal(attacker.hp, UNIT_TYPES.tank.hp - UNIT_TYPES.bomber.attack);
  assert.equal(model.combatEvents.some((event) => event.type === COMBAT_EVENT.UNIT_DETONATED), true);
});