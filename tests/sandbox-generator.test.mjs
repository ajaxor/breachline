import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG, UNIT_ROLE, UNIT_TYPES } from '../src/data/gameConfig.js';
import { MODE } from '../src/data/gameConfig.js';
import { StrategyGameModel } from '../src/model/StrategyGameModel.js';

function constantRandom() { return 0.5; }

const STATIONARY_ROLES = new Set([UNIT_ROLE.WALL, UNIT_ROLE.STRUCTURE]);

function costOf(units) {
  return units.reduce((sum, unit) => sum + UNIT_TYPES[unit.type].cost, 0);
}

function isStationary(unit) {
  return STATIONARY_ROLES.has(UNIT_TYPES[unit.type].role);
}

test('sandbox can load campaign-generator hostile deployments without replacing player placements', () => {
  const model = new StrategyGameModel({ random: constantRandom });
  model.configureSandbox({ difficulty: 1, length: 7 });
  model.setSelectedUnitType('grunt');
  assert.equal(model.togglePlacement(0, GAME_CONFIG.playerZone[0]), true);
  assert.deepEqual(model.placement, [{ row: 0, column: GAME_CONFIG.playerZone[0], type: 'grunt' }]);

  assert.equal(model.generateSandboxCampaignDeployment(), true);
  assert.equal(model.mode, MODE.DEPLOY);
  assert.equal(model.sandboxGeneratedMissionIndex, 0);
  assert.equal(model.sandboxGeneratorMissionIndex, 1);
  assert.deepEqual(model.placement, [{ row: 0, column: GAME_CONFIG.playerZone[0], type: 'grunt' }]);
  assert.ok(model.mission.enemyFormation.length > 0, 'campaign generator did not create hostile units');
  assert.ok(model.mission.enemyFormation.every((unit) => GAME_CONFIG.enemyZone.includes(unit.column)), 'generated hostile deployment escaped the enemy zone');

  const mobileCost = costOf(model.mission.enemyFormation.filter((unit) => !isStationary(unit)));
  const wallCost = costOf(model.mission.enemyFormation.filter((unit) => unit.type === 'wall'));
  const structureCost = costOf(model.mission.enemyFormation.filter((unit) => isStationary(unit) && unit.type !== 'wall'));
  assert.ok(mobileCost <= model.mission.enemyBudget, 'generated sandbox mobiles exceeded campaign mobile budget');
  assert.ok(wallCost <= model.mission.wallBudget, 'generated sandbox walls exceeded campaign wall budget');
  assert.ok(structureCost <= model.mission.structureBudget, 'generated sandbox structures exceeded campaign structure budget');

  assert.equal(model.generateSandboxCampaignDeployment(), true);
  assert.equal(model.sandboxGeneratedMissionIndex, 1);
  assert.equal(model.sandboxGeneratorMissionIndex, 2);
  assert.deepEqual(model.placement, [{ row: 0, column: GAME_CONFIG.playerZone[0], type: 'grunt' }]);
});

test('campaign-generator deployment is sandbox-only and deployment-only', () => {
  const model = new StrategyGameModel({ random: constantRandom });
  model.configureCampaign({ difficulty: 1, length: 5 });
  assert.equal(model.generateSandboxCampaignDeployment(), false);

  model.configureSandbox({ difficulty: 1, length: 5 });
  model.setSelectedUnitType('grunt');
  model.togglePlacement(0, GAME_CONFIG.playerZone[0]);
  model.generateSandboxCampaignDeployment();
  assert.equal(model.startBattle(), true);
  assert.equal(model.generateSandboxCampaignDeployment(), false);
});
