import test from 'node:test';
import assert from 'node:assert/strict';
import { StrategyGameModel } from '../src/model/StrategyGameModel.js';

function draftModel(randomValue = 0.3) {
  const model = new StrategyGameModel({ random: () => randomValue, now: () => 0 });
  model.pendingDrafts = 1;
  return model;
}

test('mission one draft choices are single tech-one units', () => {
  const model = draftModel(0);
  model.currentDraftMissionIndex = 0;
  const choices = model.rollDraftChoices();

  assert.equal(choices.length, 3);
  assert.equal(choices.every((choice) => !choice.isPair), true);
  assert.equal(choices.flatMap((choice) => choice.units).every((unit) => unit.techLevel === 1), true);
});

test('pair offerings are not selected by a moderate pair roll', () => {
  const model = draftModel(0.3);
  model.currentDraftMissionIndex = 1;
  const choices = model.rollDraftChoices();

  assert.equal(choices.length, 3);
  assert.equal(choices.every((choice) => !choice.isPair), true);
});
