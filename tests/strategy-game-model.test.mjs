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

console.log('Strategy game model tests passed.');