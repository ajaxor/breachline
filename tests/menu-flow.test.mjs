import test from 'node:test';
import assert from 'node:assert/strict';
import { StrategyGameModel } from '../src/model/StrategyGameModel.js';

const sequence = (...values) => { let i = 0; return () => values[i++ % values.length]; };

test('campaign settings control mission count and difficulty budget', () => {
  const model = new StrategyGameModel({ random: sequence(0.25, 0.5, 0.75) });
  model.configureCampaign({ difficulty: 1.25, length: 5 });
  assert.equal(model.campaign.length, 5);
  assert.equal(model.campaign[0].enemyBudget, Math.round(220 * 1.25));
});

test('deployment rosters are alphabetical by displayed unit name', () => {
  const model = new StrategyGameModel({ random: () => 0.5 });
  model.configureSandbox();
  const names = model.rosterTypes.map((type) => type.name);
  assert.deepEqual(names, names.slice().sort((left, right) => left.localeCompare(right)));
});

test('sandbox exposes AI-only units and places both sides by board zone', () => {
  let now = 0;
  const model = new StrategyGameModel({ random: () => 0.1234, now: () => ++now });
  model.configureSandbox();
  assert(model.rosterTypes.some((type) => type.tags.includes('ai-only')));
  model.setSelectedUnitType('tollbooth');
  assert.equal(model.togglePlacement(0, 0), true);
  assert.equal(model.togglePlacement(0, 13), true);
  assert.equal(model.placement[0].type, 'tollbooth');
  assert.equal(model.mission.enemyFormation[0].type, 'tollbooth');
  assert.equal(model.startBattle(), true);
  const original = model.units.map(({ team, type, row, column }) => ({ team, type, row, column }));
  model.tick();
  assert.equal(model.replayLastBattle(), true);
  assert.deepEqual(model.units.map(({ team, type, row, column }) => ({ team, type, row, column })), original);
});

test('mutual destruction is reported as a failure', () => {
  const model = new StrategyGameModel({ random: () => 0.5 });
  model.playerBaseHp = 0;
  model.enemyBaseHp = 0;
  const result = model.determineResult();
  assert.equal(result.playerWon, false);
  assert.equal(result.cssClass, 'enemy-win');
  assert.match(result.text, /^DEFEAT/);
});
