import assert from 'node:assert/strict';
import { GAME_CONFIG, TEAM, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../src/data/gameConfig.js';
import { GameModel } from '../src/model/GameModel.js';
import { StrategyGameModel } from '../src/model/StrategyGameModel.js';

const createModel = () => new StrategyGameModel({ random: () => 0.5, now: () => 0 });

{
  const model = createModel();
  model.beginDrafts(1, 100);
  const choice = model.draftChoices[0];
  const expectedCount = Math.round(100 / choice.cost);
  assert.equal(choice.draftCount, expectedCount, 'draft quantity should be derived from budget and unit cost');
  assert.equal(model.chooseDraft(choice.key), true);
  assert.equal(model.supply[choice.key], expectedCount, 'choosing a draft should add the full unit set to supply');

  model.setSelectedUnitType(choice.key);
  for (let row = 0; row < expectedCount; row += 1) {
    assert.equal(model.togglePlacement(row, GAME_CONFIG.playerZone[0]), true);
  }
  assert.equal(model.availableCount(choice.key), 0);
  assert.equal(model.togglePlacement(expectedCount, GAME_CONFIG.playerZone[0]), false, 'deployment cannot exceed finite supply');
}

{
  const model = createModel();
  model.roster.grunt = true;
  model.supply.grunt = 3;
  model.setSelectedUnitType('grunt');
  model.togglePlacement(0, 0);
  model.togglePlacement(1, 0);
  assert.equal(model.startBattle(), true);
  assert.equal(model.supply.grunt, 1, 'every deployed unit should be consumed when the battle launches');

  model.finishBattle({ cssClass: 'player-win', text: 'test victory', playerWon: true });
  assert.equal(model.supply.grunt, 1, 'surviving deployed units should not return to supply');
  assert.equal(model.roster.grunt, true, 'a unit type with reserve supply should remain in the roster');

  model.returnToDeployment();
  assert.equal(model.placement.length, 0, 'returning to deployment should clear the previous formation');
  assert.equal(model.supply.grunt, 1, 'clearing the completed mission formation should not refund committed units');
}

{
  const model = createModel();
  model.roster.grunt = true;
  model.supply.grunt = 1;
  model.setSelectedUnitType('grunt');
  model.togglePlacement(0, 0);
  assert.equal(model.availableCount('grunt'), 0, 'a fully committed type should show zero remaining during deployment');
  assert.equal(model.startBattle(), true);
  model.finishBattle({ cssClass: 'enemy-win', text: 'test defeat', playerWon: false });
  assert.equal(model.roster.grunt, false, 'a depleted type should be removed from the roster when the mission ends');
  assert.equal(model.selectedUnitType, null, 'selection should clear when the selected type is depleted');
}

{
  const model = createModel();
  const enemyIncrease = model.campaign[1].enemyBudget - model.campaign[0].enemyBudget;
  const draftIncrease = model.campaign[1].draftBudget - model.campaign[0].draftBudget;
  assert.ok(draftIncrease > enemyIncrease, 'reinforcement draft growth should outpace enemy budget growth to absorb casualties');
}

{
  const flyingTypes = Object.values(UNIT_TYPES).filter((type) => hasUnitTag(type, UNIT_TAG.FLYING));
  assert.deepEqual(flyingTypes.map((type) => type.name), ['Midge', 'Wasp', 'Kite', 'Firefly']);
  assert.ok(flyingTypes.every((type) => type.hp < UNIT_TYPES.grunt.hp), 'flying units should all have poor health compared with the baseline trooper');
  assert.ok(flyingTypes.every((type) => type.shape === 'wing' && type.graphic === 'wasp'), 'flying units should share one winged icon silhouette');
  assert.ok(flyingTypes.every((type) => !hasUnitTag(type, UNIT_TAG.FAST_ATTACK)), 'flying units should not duplicate their intrinsic move-and-attack rule');
  assert.ok(flyingTypes.every((type) => !hasUnitTag(type, UNIT_TAG.CAN_MOVE_SIDEWAYS)), 'flying units should not use ground pathfinding tags');
  assert.ok(UNIT_TYPES.midge.cost < UNIT_TYPES.flyer.cost, 'Midge should fill the cheap swarm niche');
  assert.equal(UNIT_TYPES.kite.range, 4, 'Kite should fill the long-range lane niche');
  assert.equal(UNIT_TYPES.firefly.onAttack, 'detonate', 'Firefly should fill the flying demolition niche');

  const model = new GameModel({ random: () => 0.5, now: () => 0 });
  const flyer = {
    id: 1, team: TEAM.PLAYER, type: 'flyer', row: 2, column: 0,
    previousRow: 2, previousColumn: 0, animationStartedAt: 0, animationDuration: 1,
    breached: false, movedThisTurn: false, hp: UNIT_TYPES.flyer.hp, maxHp: UNIT_TYPES.flyer.hp, alive: true,
  };
  const allyBlocker = {
    id: 2, team: TEAM.PLAYER, type: 'grunt', row: 2, column: 1,
    breached: false, movedThisTurn: false, hp: UNIT_TYPES.grunt.hp, maxHp: UNIT_TYPES.grunt.hp, alive: true,
  };
  const enemy = {
    id: 3, team: TEAM.ENEMY, type: 'grunt', row: 2, column: 2,
    breached: false, movedThisTurn: false, hp: UNIT_TYPES.grunt.hp, maxHp: UNIT_TYPES.grunt.hp, alive: true,
  };
  model.units = [flyer, allyBlocker, enemy];

  assert.equal(model.processUnit(flyer, 0, 100), true);
  assert.equal(flyer.column, 1, 'flying units should advance exactly one cell through an occupied position');
  assert.equal(allyBlocker.column, flyer.column, 'flying units should be allowed to overlap ground units');
  assert.equal(enemy.hp, UNIT_TYPES.grunt.hp - UNIT_TYPES.flyer.attack, 'flying units should attack after moving');
}

console.log('Strategy game model tests passed.');
