import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG, TEAM, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../src/data/gameConfig.js';
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
  for (let row = 0; row < expectedCount; row += 1) {
    assert.equal(model.togglePlacement(row, GAME_CONFIG.playerZone[0]), true);
  }
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

test('flying unit definitions preserve their intended niches', () => {
  const flyingTypes = Object.values(UNIT_TYPES).filter((type) => hasUnitTag(type, UNIT_TAG.FLYING));
  assert.deepEqual(flyingTypes.map((type) => type.name), ['Midge', 'Wasp', 'Kite', 'Firefly']);
  assert.ok(flyingTypes.every((type) => type.hp < UNIT_TYPES.grunt.hp));
  assert.ok(flyingTypes.every((type) => type.shape === 'wing' && type.graphic === 'wasp'));
  assert.ok(flyingTypes.every((type) => !hasUnitTag(type, UNIT_TAG.FAST_ATTACK)));
  assert.ok(flyingTypes.every((type) => !hasUnitTag(type, UNIT_TAG.CAN_MOVE_SIDEWAYS)));
  assert.ok(UNIT_TYPES.midge.cost < UNIT_TYPES.flyer.cost);
  assert.equal(UNIT_TYPES.kite.range, 4);
  assert.equal(UNIT_TYPES.firefly.onAttack, 'detonate');
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
