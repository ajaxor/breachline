import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG, UNIT_ROLE, UNIT_TYPES } from '../src/data/gameConfig.js';
import { MISSION_STATUS } from '../src/data/gameTypes.js';
import { createCampaign } from '../src/model/CampaignFactory.js';

const campaign = createCampaign(() => 0.5);

function costOf(units) {
  return units.reduce((sum, unit) => sum + UNIT_TYPES[unit.type].cost, 0);
}

test('campaign has the configured mission count and unlock state', () => {
  assert.equal(campaign.length, GAME_CONFIG.missionCount);
  assert.equal(campaign[0].status, MISSION_STATUS.AVAILABLE);
  assert.ok(campaign.slice(1).every((mission) => mission.status === MISSION_STATUS.LOCKED));
});

test('enemy formations use unique enemy-zone cells and stay within their mobile wall and structure budgets', () => {
  for (const mission of campaign) {
    const cells = mission.enemyFormation.map((unit) => `${unit.row}:${unit.column}`);
    assert.equal(new Set(cells).size, cells.length, `mission ${mission.index + 1} has overlapping units`);
    assert.ok(mission.enemyFormation.every((unit) => GAME_CONFIG.enemyZone.includes(unit.column)));
    assert.ok(mission.enemyFormation.every((unit) => unit.row >= 0 && unit.row < GAME_CONFIG.rows));
    const mobileCost = costOf(mission.enemyFormation.filter((unit) => UNIT_TYPES[unit.type].role !== UNIT_ROLE.STRUCTURE));
    const wallCost = costOf(mission.enemyFormation.filter((unit) => unit.type === 'wall'));
    const structureCost = costOf(mission.enemyFormation.filter((unit) => UNIT_TYPES[unit.type].role === UNIT_ROLE.STRUCTURE && unit.type !== 'wall'));
    assert.ok(mobileCost <= mission.enemyBudget, `mission ${mission.index + 1} exceeds its enemy budget`);
    assert.ok(wallCost <= mission.wallBudget, `mission ${mission.index + 1} exceeds its wall budget`);
    assert.ok(structureCost <= mission.structureBudget, `mission ${mission.index + 1} exceeds its structure budget`);
  }
});

test('enemy formations remain mirrored across the horizontal center line', () => {
  for (const mission of campaign) {
    const cells = new Set(mission.enemyFormation.map((unit) => `${unit.row}:${unit.column}:${unit.type}`));
    for (const unit of mission.enemyFormation) {
      const mirrorRow = GAME_CONFIG.rows - 1 - unit.row;
      assert.ok(cells.has(`${mirrorRow}:${unit.column}:${unit.type}`), `mission ${mission.index + 1} is not mirrored`);
    }
  }
});

test('walls spend from a separate campaign budget and mostly defend the middle deployment area', () => {
  for (const mission of campaign) {
    const walls = mission.enemyFormation.filter((unit) => unit.type === 'wall');
    const defenders = mission.enemyFormation.filter((unit) => unit.type !== 'wall');
    assert.ok(walls.length >= 2, `mission ${mission.index + 1} has no wall line`);
    assert.ok(defenders.some((unit) => UNIT_TYPES[unit.type].role !== UNIT_ROLE.STRUCTURE), `mission ${mission.index + 1} has no mobile defenders`);
    assert.equal(mission.wallBudget, GAME_CONFIG.wallBudgetBase + mission.index * GAME_CONFIG.wallBudgetStep);

    const frontWallCount = walls.filter((unit) => unit.column === GAME_CONFIG.enemyZone[0]).length;
    assert.ok(frontWallCount < walls.length, `mission ${mission.index + 1} puts every wall on the front line`);
  }
});

test('campaign creates varied line blob and column deployment shapes', () => {
  const shapeCounts = campaign.map((mission) => {
    const cellCountsByColumn = new Map();
    const cellCountsByPair = new Map();
    for (const unit of mission.enemyFormation) {
      const pair = Math.min(unit.row, GAME_CONFIG.rows - 1 - unit.row);
      cellCountsByColumn.set(unit.column, (cellCountsByColumn.get(unit.column) ?? 0) + 1);
      cellCountsByPair.set(pair, (cellCountsByPair.get(pair) ?? 0) + 1);
    }
    return {
      hasVerticalLine: [...cellCountsByColumn.values()].some((count) => count >= 4),
      hasHorizontalLine: [...cellCountsByPair.values()].some((count) => count >= 6),
      usedColumns: cellCountsByColumn.size,
    };
  });

  assert.ok(shapeCounts.some((shape) => shape.hasVerticalLine), 'campaign never creates a vertical line');
  assert.ok(shapeCounts.some((shape) => shape.hasHorizontalLine), 'campaign never creates a horizontal line');
  assert.ok(shapeCounts.some((shape) => shape.usedColumns >= 3), 'campaign never creates a blob or broad symmetric formation');
});

test('later missions field denser armies with both cheap and premium units', () => {
  const earlyAverage = campaign.slice(0, 3).reduce((sum, mission) => sum + mission.enemyFormation.length, 0) / 3;
  const lateAverage = campaign.slice(-3).reduce((sum, mission) => sum + mission.enemyFormation.length, 0) / 3;
  assert.ok(lateAverage > earlyAverage, `late army density ${lateAverage} did not exceed early density ${earlyAverage}`);

  for (const mission of campaign.slice(-3)) {
    const mobile = mission.enemyFormation.filter((unit) => UNIT_TYPES[unit.type].role !== UNIT_ROLE.STRUCTURE);
    const combatants = mission.enemyFormation.filter((unit) => unit.type !== 'wall');
    const mobileCosts = mobile.map((unit) => UNIT_TYPES[unit.type].cost);
    const combatantCosts = combatants.map((unit) => UNIT_TYPES[unit.type].cost);
    assert.ok(Math.min(...mobileCosts) <= 27, `mission ${mission.index + 1} lacks cheap mass units`);
    assert.ok(Math.max(...combatantCosts) >= 32, `mission ${mission.index + 1} lacks a premium unit`);
  }
});

test('later missions include a mix of fortified structures from a parallel structure budget', () => {
  const structureTypes = new Set(campaign.slice(5).flatMap((mission) => mission.enemyFormation
    .map((unit) => unit.type)
    .filter((type) => UNIT_TYPES[type].role === UNIT_ROLE.STRUCTURE && type !== 'wall')));
  assert.ok(structureTypes.has('tollbooth'), 'later missions never use barricades');
  assert.ok(structureTypes.has('sentry'), 'later missions never use basic turrets');
  assert.ok([...structureTypes].some((type) => ['flakTurret', 'rocketTurret', 'mortarNest', 'railTurret', 'factory'].includes(type)), 'later missions never use advanced structures');
});

test('campaign formations respect non-wall unit unlock missions', () => {
  for (const mission of campaign) {
    for (const unit of mission.enemyFormation.filter((candidate) => candidate.type !== 'wall')) {
      assert.ok(
        UNIT_TYPES[unit.type].campaign.unlockMission <= mission.index,
        `${unit.type} appears before its unlock mission`,
      );
    }
  }
});

test('mission budgets grow according to configuration', () => {
  for (const mission of campaign) {
    assert.equal(mission.playerBudget, GAME_CONFIG.startingBudget + mission.index * GAME_CONFIG.budgetStep);
    assert.equal(mission.enemyBudget, mission.playerBudget + GAME_CONFIG.enemyBudgetBonus + mission.index * GAME_CONFIG.enemyBudgetStep);
    assert.equal(mission.wallBudget, GAME_CONFIG.wallBudgetBase + mission.index * GAME_CONFIG.wallBudgetStep);
    assert.equal(mission.structureBudget, GAME_CONFIG.structureBudgetBase + mission.index * GAME_CONFIG.structureBudgetStep);
    assert.equal(mission.draftBudget, GAME_CONFIG.startingDraftBudget + mission.index * GAME_CONFIG.draftBudgetStep);
  }
});
