import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG, UNIT_ROLE, UNIT_TAG, UNIT_TYPES, hasUnitTag, techLevelForMission, techLevelWeight } from '../src/data/gameConfig.js';
import { ATTACK_ANIMATION, MISSION_STATUS } from '../src/data/gameTypes.js';
import { createCampaign } from '../src/model/CampaignFactory.js';

const campaign = createCampaign(() => 0.5);
const PROTECTED_ROLES = new Set([UNIT_ROLE.RANGED, UNIT_ROLE.SUPPORT, UNIT_ROLE.FLYING]);
const STATIONARY_ROLES = new Set([UNIT_ROLE.WALL, UNIT_ROLE.STRUCTURE]);

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function costOf(units) {
  return units.reduce((sum, unit) => sum + UNIT_TYPES[unit.type].cost, 0);
}

function rowPair(unit) {
  return Math.min(unit.row, GAME_CONFIG.rows - 1 - unit.row);
}

function isStationary(unit) {
  return STATIONARY_ROLES.has(UNIT_TYPES[unit.type].role);
}

function expectedDraftBudget(index) {
  const taper = index * Math.max(0, index - 1) * GAME_CONFIG.draftBudgetTaper;
  return Math.max(GAME_CONFIG.startingDraftBudget, GAME_CONFIG.startingDraftBudget + index * GAME_CONFIG.draftBudgetStep - taper);
}

function blockersByPair(mission) {
  const blockers = new Map();
  for (const unit of mission.enemyFormation) {
    if (!isStationary(unit)) continue;
    const pair = rowPair(unit);
    if (!blockers.has(pair)) blockers.set(pair, []);
    blockers.get(pair).push(unit.column);
  }
  return blockers;
}

function earlyMobileSignature(seed) {
  return createCampaign(seededRandom(seed), { missionCount: 2 })
    .flatMap((mission) => mission.enemyFormation
      .filter((unit) => !isStationary(unit))
      .map((unit) => unit.type)
      .sort())
    .join('|');
}

test('campaign has seven missions and correct unlock state', () => {
  assert.equal(GAME_CONFIG.missionCount, 7);
  assert.equal(campaign.length, GAME_CONFIG.missionCount);
  assert.equal(campaign[0].status, MISSION_STATUS.AVAILABLE);
  assert.ok(campaign.slice(1).every((mission) => mission.status === MISSION_STATUS.LOCKED));
});

test('each unit defines a valid tech level on the 1-3 scale', () => {
  assert.equal(GAME_CONFIG.minTechLevel, 1);
  assert.equal(GAME_CONFIG.maxTechLevel, 3);
  for (const type of Object.values(UNIT_TYPES)) {
    assert.ok(Number.isInteger(type.techLevel), `${type.key} does not have an integer tech level`);
    assert.ok(type.techLevel >= GAME_CONFIG.minTechLevel, `${type.key} is below the minimum tech level`);
    assert.ok(type.techLevel <= GAME_CONFIG.maxTechLevel, `${type.key} is above the maximum tech level`);
  }
});

test('campaign tech level rises from early to late missions', () => {
  assert.equal(techLevelForMission(0, campaign.length), GAME_CONFIG.minTechLevel);
  assert.equal(techLevelForMission(campaign.length - 1, campaign.length), GAME_CONFIG.maxTechLevel);
  for (let index = 1; index < campaign.length; index += 1) {
    assert.ok(techLevelForMission(index, campaign.length) >= techLevelForMission(index - 1, campaign.length));
  }
});

test('tech probability curve leaves small cross-tech chances at both ends', () => {
  const firstMission = 0;
  const finalMission = campaign.length - 1;
  assert.ok(techLevelWeight(3, firstMission, campaign.length) > 0, 'tech 3 has no first-draft chance');
  assert.ok(techLevelWeight(3, firstMission, campaign.length) < techLevelWeight(1, firstMission, campaign.length), 'early curve does not favor tech 1');
  assert.ok(techLevelWeight(1, finalMission, campaign.length) > 0, 'tech 1 has no final-draft chance');
  assert.ok(techLevelWeight(1, finalMission, campaign.length) < techLevelWeight(3, finalMission, campaign.length), 'late curve does not favor tech 3');
});

test('attack animations are derived from range and tags', () => {
  assert.equal(UNIT_TYPES.grunt.animation.attack, ATTACK_ANIMATION.MELEE);
  assert.equal(UNIT_TYPES.gunner.animation.attack, ATTACK_ANIMATION.LASER);
  assert.equal(UNIT_TYPES.sniper.animation.attack, ATTACK_ANIMATION.LASER);
  assert.equal(UNIT_TYPES.flak.animation.attack, ATTACK_ANIMATION.LOB);
  assert.equal(UNIT_TYPES.mortar.animation.attack, ATTACK_ANIMATION.LOB);
  assert.equal(UNIT_TYPES.bertha.animation.attack, ATTACK_ANIMATION.MISSILE);
  assert.equal(UNIT_TYPES.kite.animation.attack, ATTACK_ANIMATION.MISSILE);
  assert.equal(UNIT_TYPES.rocketTurret.animation.attack, ATTACK_ANIMATION.MISSILE);
  assert.equal(UNIT_TYPES.railTurret.animation.attack, ATTACK_ANIMATION.MISSILE);
});

test('enemy formations do not include player-only units', () => {
  for (const mission of campaign) {
    assert.ok(
      mission.enemyFormation.every((unit) => !hasUnitTag(unit.type, UNIT_TAG.PLAYER_ONLY)),
      `mission ${mission.index + 1} includes a player-only enemy`,
    );
  }
});

test('early campaign missions vary mobile army cores across seeds', () => {
  const signatures = new Set(Array.from({ length: 10 }, (_, index) => earlyMobileSignature(index + 1)));
  assert.ok(signatures.size > 1, `early missions generated only one mobile signature: ${[...signatures][0]}`);
});

test('enemy formations use unique enemy-zone cells and stay within their mobile wall and structure budgets', () => {
  for (const mission of campaign) {
    const cells = mission.enemyFormation.map((unit) => `${unit.row}:${unit.column}`);
    assert.equal(new Set(cells).size, cells.length, `mission ${mission.index + 1} has overlapping units`);
    assert.ok(mission.enemyFormation.every((unit) => GAME_CONFIG.enemyZone.includes(unit.column)));
    assert.ok(mission.enemyFormation.every((unit) => unit.row >= 0 && unit.row < GAME_CONFIG.rows));
    const mobileCost = costOf(mission.enemyFormation.filter((unit) => !isStationary(unit)));
    const wallCost = costOf(mission.enemyFormation.filter((unit) => unit.type === 'wall'));
    const structureCost = costOf(mission.enemyFormation.filter((unit) => isStationary(unit) && unit.type !== 'wall'));
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

test('campaign builds defensive bases before adding mobile armies', () => {
  for (const mission of campaign) {
    const structures = mission.enemyFormation.filter((unit) => isStationary(unit));
    const mobile = mission.enemyFormation.filter((unit) => !isStationary(unit));
    assert.ok(structures.length >= 2, `mission ${mission.index + 1} has no defensive base`);
    assert.ok(mobile.length >= 2, `mission ${mission.index + 1} has no mobile army`);
    assert.ok(structures.some((unit) => unit.column > GAME_CONFIG.enemyZone[0]), `mission ${mission.index + 1} puts every base piece on the front line`);
  }
});

test('ranged flying and support units deploy behind walls or structures when present', () => {
  for (const mission of campaign) {
    const blockers = blockersByPair(mission);
    for (const unit of mission.enemyFormation) {
      const role = UNIT_TYPES[unit.type].role;
      if (!PROTECTED_ROLES.has(role)) continue;
      const pairBlockers = blockers.get(rowPair(unit)) ?? [];
      assert.ok(
        pairBlockers.some((column) => column < unit.column),
        `mission ${mission.index + 1} exposes protected ${unit.type} in front of its base`,
      );
    }
  }
});

test('later missions use drafted army cores instead of high-variety random collections', () => {
  for (const mission of campaign.slice(5)) {
    const mobile = mission.enemyFormation.filter((unit) => !isStationary(unit));
    const mobileTypes = new Set(mobile.map((unit) => unit.type));
    const nonSupportTypes = new Set(mobile.filter((unit) => UNIT_TYPES[unit.type].role !== UNIT_ROLE.SUPPORT).map((unit) => unit.type));
    const typeCounts = mobile.reduce((counts, unit) => counts.set(unit.type, (counts.get(unit.type) ?? 0) + 1), new Map());
    assert.ok(nonSupportTypes.size <= 2, `mission ${mission.index + 1} uses too many non-support army types`);
    assert.ok(mobileTypes.size <= 3, `mission ${mission.index + 1} uses too many total army types`);
    assert.ok([...typeCounts.values()].some((count) => count >= 4), `mission ${mission.index + 1} lacks repeated unit counts`);
  }
});

test('support units stay limited in generated armies', () => {
  for (const mission of campaign) {
    const supportCount = mission.enemyFormation.filter((unit) => UNIT_TYPES[unit.type].role === UNIT_ROLE.SUPPORT).length;
    assert.ok(supportCount <= 2, `mission ${mission.index + 1} has too many support units`);
  }
});

test('later missions field denser armies with both cheap mass and premium units', () => {
  const earlyAverage = campaign.slice(0, 3).reduce((sum, mission) => sum + mission.enemyFormation.length, 0) / 3;
  const lateAverage = campaign.slice(-3).reduce((sum, mission) => sum + mission.enemyFormation.length, 0) / 3;
  assert.ok(lateAverage > earlyAverage, `late army density ${lateAverage} did not exceed early density ${earlyAverage}`);

  for (const mission of campaign.slice(-3)) {
    const mobile = mission.enemyFormation.filter((unit) => !isStationary(unit));
    const combatants = mission.enemyFormation.filter((unit) => unit.type !== 'wall');
    const mobileCosts = mobile.map((unit) => UNIT_TYPES[unit.type].cost);
    const combatantCosts = combatants.map((unit) => UNIT_TYPES[unit.type].cost);
    assert.ok(Math.min(...mobileCosts) <= 30, `mission ${mission.index + 1} lacks cheap mass units`);
    assert.ok(Math.max(...combatantCosts) >= 32, `mission ${mission.index + 1} lacks a premium unit`);
  }
});

test('later missions include a mix of fortified structures from a parallel structure budget', () => {
  const structureTypes = new Set(campaign.slice(5).flatMap((mission) => mission.enemyFormation
    .map((unit) => unit.type)
    .filter((type) => STATIONARY_ROLES.has(UNIT_TYPES[type].role) && type !== 'wall')));
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
    assert.equal(mission.draftBudget, expectedDraftBudget(mission.index));
  }
});