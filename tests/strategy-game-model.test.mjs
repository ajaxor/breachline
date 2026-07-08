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
  assert.equal(UNIT_TYPES.grunt.shape, UNIT_TYPES.tank.shape);
  assert.equal(UNIT_TYPES.gunner.shape, UNIT_TYPES.sniper.shape);
  assert.equal(UNIT_TYPES.flak.shape, UNIT_TYPES.bomber.shape);
  assert.equal(UNIT_TYPES.grunt.role, UNIT_ROLE.MELEE);
  assert.equal(UNIT_TYPES.gunner.role, UNIT_ROLE.RANGED);
  assert.equal(UNIT_TYPES.flak.role, UNIT_ROLE.SPECIALIST);
  assert.equal(UNIT_TYPES.firefly.role, UNIT_ROLE.FLYING);
  assert.equal(UNIT_TYPES.wall.role, UNIT_ROLE.WALL);
  assert.equal(UNIT_TYPES.wall.shape, 'rectangle');
  assert.equal(UNIT_TYPES.sentry.role, UNIT_ROLE.STRUCTURE);
  assert.equal(UNIT_TYPES.sentry.shape, 'hex');
});

test('role definitions follow unit design constraints', () => {
  const types = Object.values(UNIT_TYPES);
  const meleeTypes = types.filter((type) => type.role === UNIT_ROLE.MELEE);
  const wallTypes = types.filter((type) => type.role === UNIT_ROLE.WALL);
  const structureTypes = types.filter((type) => type.role === UNIT_ROLE.STRUCTURE);
  const mobileTypes = types.filter((type) => type.role !== UNIT_ROLE.WALL && type.role !== UNIT_ROLE.STRUCTURE);
  const flyingTypes = types.filter((type) => hasUnitTag(type, UNIT_TAG.FLYING));
  const bombTypes = types.filter((type) => hasUnitTag(type, UNIT_TAG.BOMB));
  const maxMobileHp = Math.max(...mobileTypes.map((type) => type.hp));
  assert.ok(meleeTypes.every((type) => type.range === 1));
  assert.ok(wallTypes.every((type) => type.attack === 0));
  assert.ok(wallTypes.every((type) => hasUnitTag(type, UNIT_TAG.AI_ONLY)));
  assert.ok(structureTypes.every((type) => type.attack > 0));
  assert.ok(structureTypes.every((type) => hasUnitTag(type, UNIT_TAG.AI_ONLY)));
  assert.ok([...wallTypes, ...structureTypes].every((type) => type.hp > maxMobileHp));
  assert.ok(flyingTypes.every((type) => type.role === UNIT_ROLE.FLYING));
  assert.ok(bombTypes.every((type) => type.attack >= 35));
});

test('flying unit definitions preserve their intended niches', () => {
  const flyingTypes = Object.values(UNIT_TYPES).filter((type) => hasUnitTag(type, UNIT_TAG.FLYING));
  assert.deepEqual(flyingTypes.map((type) => type.name), ['Midge', 'Wasp', 'Kite', 'Firefly']);
  assert.ok(flyingTypes.every((type) => type.hp < UNIT_TYPES.grunt.hp));
  assert.ok(flyingTypes.every((type) => type.role === UNIT_ROLE.FLYING));
  assert.ok(flyingTypes.every((type) => type.shape === 'wing'));
  assert.ok(flyingTypes.every((type) => !hasUnitTag(type, UNIT_TAG.FAST_ATTACK)));
  assert.ok(flyingTypes.every((type) => !hasUnitTag(type, UNIT_TAG.AGILE)));
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

// Regression guard: units destroyed while SpatialIndex is mid-iteration must not remain targetable.
test('destroyed units are removed from the spatial index immediately', () => {
  const units = [
    createBattleUnit({ id: 1, row: 0, column: 0 }),
    createBattleUnit({ id: 2, row: 0, column: 1 }),
  ];
  const index = new SpatialIndex(units);
  index.remove(units[1]);
  assert.deepEqual(index.nearby(0, 0, 1), [units[0]]);
});

test('semantic combat events record the initial battle state and unit actions', () => {
  const model = new GameModel({ random: () => 0.5, now: () => 0 });
  assert.equal(model.setupBattle({ playerFormation: [{ row: 0, column: 0, type: 'grunt' }], enemyFormation: [{ row: 0, column: 1, type: 'grunt' }], missionLabel: 'Test Mission' }), true);
  assert.equal(model.combatEvents[0].type, COMBAT_EVENT.BATTLE_STARTED);
  assert.equal(model.combatEvents[0].label, 'Test Mission');
  model.tick();
  assert.ok(model.combatEvents.some((event) => event.type === COMBAT_EVENT.UNIT_ATTACKED));
});
