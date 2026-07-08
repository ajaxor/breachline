import assert from 'node:assert/strict';
import test from 'node:test';

import { TEAM, UNIT_ROLE, UNIT_TYPES } from '../src/data/gameConfig.js';
import { StrategyGameModel } from '../src/model/StrategyGameModel.js';
import { TargetingPolicy } from '../src/model/TargetingPolicy.js';

function constantRandom(value) {
  return () => value;
}

test('reinforcement drafts never pair two support units', () => {
  const model = new StrategyGameModel({ random: constantRandom(0.1), now: () => 0 });
  model.configureCampaign();
  model.beginDrafts(1);

  for (let roll = 0; roll < 50; roll += 1) {
    model.rollDraftChoices();
    for (const choice of model.draftChoices) {
      if (!choice.isPair) continue;
      assert.notEqual(choice.units.filter((unit) => unit.role === UNIT_ROLE.SUPPORT).length, 2, `support pair offered as ${choice.key}`);
    }
  }
});

test('passive blockers use wall frames while factories use structure frames', () => {
  assert.equal(UNIT_TYPES.wall.role, UNIT_ROLE.WALL);
  assert.equal(UNIT_TYPES.tollbooth.role, UNIT_ROLE.WALL);
  assert.equal(UNIT_TYPES.factory.role, UNIT_ROLE.STRUCTURE);
  assert.equal(UNIT_TYPES.wall.shape, 'rectangle');
  assert.equal(UNIT_TYPES.sentry.role, UNIT_ROLE.STRUCTURE);
  assert.equal(UNIT_TYPES.factory.shape, 'hex');
  assert.equal(UNIT_TYPES.sentry.shape, 'hex');
});

test('ranged units ignore walls unless directly blocked by them', () => {
  const targeting = new TargetingPolicy();
  const attacker = { id: 1, team: TEAM.PLAYER, type: 'sniper', row: 3, column: 3 };
  const distantWall = { id: 2, team: TEAM.ENEMY, type: 'wall', row: 3, column: 6 };
  const adjacentWall = { id: 3, team: TEAM.ENEMY, type: 'wall', row: 3, column: 4 };

  assert.equal(targeting.canTarget(attacker, distantWall), false);
  assert.equal(targeting.canTarget(attacker, adjacentWall), true);
});

test('ranged units treat structures like other units', () => {
  const targeting = new TargetingPolicy();
  const attacker = { id: 1, team: TEAM.PLAYER, type: 'sniper', row: 3, column: 3 };
  const nearbyTurret = { id: 2, team: TEAM.ENEMY, type: 'sentry', row: 3, column: 4 };
  const nearbyFactory = { id: 3, team: TEAM.ENEMY, type: 'factory', row: 3, column: 5 };
  const farGrunt = { id: 4, team: TEAM.ENEMY, type: 'grunt', row: 3, column: 7 };

  assert.equal(targeting.canTarget(attacker, nearbyTurret), true);
  assert.equal(targeting.canTarget(attacker, nearbyFactory), true);
  assert.equal(targeting.nearest([nearbyTurret, farGrunt], attacker), nearbyTurret);
});
