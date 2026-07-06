import assert from 'node:assert/strict';
import { GAME_CONFIG } from '../src/data/gameConfig.js';
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
  model.units.find((unit) => unit.team === 'player').alive = false;
  model.finishBattle({ cssClass: 'enemy-win', text: 'test defeat', playerWon: false });
  assert.equal(model.supply.grunt, 2, 'destroyed player units should be permanently removed from supply');

  model.returnToDeployment();
  assert.equal(model.placement.length, 0, 'returning to deployment should clear the previous formation');
  assert.equal(model.supply.grunt, 2, 'surviving deployed units should return to supply without further loss');
}

{
  const model = createModel();
  const enemyIncrease = model.campaign[1].enemyBudget - model.campaign[0].enemyBudget;
  const draftIncrease = model.campaign[1].draftBudget - model.campaign[0].draftBudget;
  assert.ok(draftIncrease > enemyIncrease, 'reinforcement draft growth should outpace enemy budget growth to absorb casualties');
}

console.log('Strategy game model tests passed.');