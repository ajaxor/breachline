import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG, UNIT_ROLE, UNIT_TYPES } from '../src/data/gameConfig.js';
import { MISSION_STATUS } from '../src/data/gameTypes.js';
import { createCampaign } from '../src/model/CampaignFactory.js';

const campaign = createCampaign(() => 0.5);

test('campaign has the configured mission count and unlock state', () => {
  assert.equal(campaign.length, GAME_CONFIG.missionCount);
  assert.equal(campaign[0].status, MISSION_STATUS.AVAILABLE);
  assert.ok(campaign.slice(1).every((mission) => mission.status === MISSION_STATUS.LOCKED));
});

test('enemy formations use unique enemy-zone cells and stay within budget', () => {
  for (const mission of campaign) {
    const cells = mission.enemyFormation.map((unit) => `${unit.row}:${unit.column}`);
    assert.equal(new Set(cells).size, cells.length, `mission ${mission.index + 1} has overlapping units`);
    assert.ok(mission.enemyFormation.every((unit) => GAME_CONFIG.enemyZone.includes(unit.column)));
    assert.ok(mission.enemyFormation.every((unit) => unit.row >= 0 && unit.row < GAME_CONFIG.rows));
    const cost = mission.enemyFormation.reduce((sum, unit) => sum + UNIT_TYPES[unit.type].cost, 0);
    assert.ok(cost <= mission.enemyBudget, `mission ${mission.index + 1} exceeds its enemy budget`);
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

test('barricades protect non-melee defenders while melee units occupy exposed front gaps', () => {
  for (const mission of campaign) {
    const barricades = mission.enemyFormation.filter((unit) => unit.type === 'tollbooth');
    const mobile = mission.enemyFormation.filter((unit) => UNIT_TYPES[unit.type].role !== UNIT_ROLE.STRUCTURE);
    assert.ok(barricades.length >= 2, `mission ${mission.index + 1} has no barricade line`);
    assert.ok(mobile.length >= 2, `mission ${mission.index + 1} has no mobile defenders`);

    for (const unit of mobile) {
      const role = UNIT_TYPES[unit.type].role;
      const barricadesAhead = barricades.filter((barricade) => barricade.row === unit.row && barricade.column < unit.column);
      if (role === UNIT_ROLE.MELEE) {
        assert.equal(barricadesAhead.length, 0, `mission ${mission.index + 1} puts melee ${unit.type} behind a barricade`);
      } else {
        assert.ok(unit.column > GAME_CONFIG.enemyZone[0], `mission ${mission.index + 1} exposes protected ${unit.type} on the front line`);
      }
    }
  }
});

test('later missions field denser armies with both cheap and premium units', () => {
  const earlyAverage = campaign.slice(0, 3).reduce((sum, mission) => sum + mission.enemyFormation.length, 0) / 3;
  const lateAverage = campaign.slice(-3).reduce((sum, mission) => sum + mission.enemyFormation.length, 0) / 3;
  assert.ok(lateAverage > earlyAverage, `late army density ${lateAverage} did not exceed early density ${earlyAverage}`);

  for (const mission of campaign.slice(-3)) {
    const mobile = mission.enemyFormation.filter((unit) => UNIT_TYPES[unit.type].role !== UNIT_ROLE.STRUCTURE);
    const costs = mobile.map((unit) => UNIT_TYPES[unit.type].cost);
    assert.ok(Math.min(...costs) <= 27, `mission ${mission.index + 1} lacks cheap mass units`);
    assert.ok(Math.max(...costs) >= 32, `mission ${mission.index + 1} lacks a premium unit`);
  }
});

test('campaign formations respect mobile unit unlock missions', () => {
  for (const mission of campaign) {
    for (const unit of mission.enemyFormation.filter((candidate) => candidate.type !== 'tollbooth')) {
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
    assert.equal(mission.draftBudget, GAME_CONFIG.startingDraftBudget + mission.index * GAME_CONFIG.draftBudgetStep);
  }
});
