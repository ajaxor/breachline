import { ENEMY_UNIT_TYPES, GAME_CONFIG, UNIT_TYPES } from '../data/gameConfig.js';

function shuffle(items, random) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function weightsForMission(index) {
  const weights = {
    grunt: 1,
    sniper: 0,
    tank: 0,
    bomber: 0,
    healer: 0,
    sidestepper: 0,
    infiltrator: 0,
    flyer: 0,
    mortar: 0,
    tollbooth: 0,
    sentry: 0,
  };
  if (index >= 1) weights.sniper = 0.3 + 0.04 * index;
  if (index >= 2) weights.tank = 0.24 + 0.04 * (index - 2);
  if (index >= 3) weights.bomber = 0.2 + 0.04 * (index - 3);
  if (index >= 3) weights.sidestepper = 0.2 + 0.04 * (index - 3);
  if (index >= 4) weights.healer = 0.14 + 0.03 * (index - 4);
  if (index >= 4) weights.tollbooth = 0.16 + 0.03 * (index - 4);
  if (index >= 5) weights.infiltrator = 0.16 + 0.03 * (index - 5);
  if (index >= 6) weights.flyer = 0.16 + 0.03 * (index - 6);
  if (index >= 7) weights.mortar = 0.14 + 0.03 * (index - 7);
  if (index >= 8) weights.sentry = 0.12 + 0.03 * (index - 8);
  const specialistWeight = Object.entries(weights)
    .filter(([key]) => key !== 'grunt')
    .reduce((sum, [, value]) => sum + value, 0);
  weights.grunt = Math.max(0.25, 1 - specialistWeight * 0.42);
  return weights;
}

function weightedPick(weights, keys, random) {
  const entries = keys.map((key) => [key, Math.max(0.0001, weights[key] ?? 0)]);
  let roll = random() * entries.reduce((sum, [, value]) => sum + value, 0);
  for (const [key, value] of entries) {
    roll -= value;
    if (roll <= 0) return key;
  }
  return entries.at(-1)[0];
}

function generateFormation(budget, missionIndex, random) {
  const rowPairs = Array.from({ length: GAME_CONFIG.rows / 2 }, (_, row) => [row, GAME_CONFIG.rows - 1 - row]);
  const slots = shuffle(GAME_CONFIG.enemyZone.flatMap((column) => rowPairs.map((pair) => ({ column, pair }))), random);
  const weights = weightsForMission(missionIndex);
  const enemyKeys = ENEMY_UNIT_TYPES.map((type) => type.key);
  const formation = [];
  let remaining = budget;

  for (const slot of slots) {
    const affordable = enemyKeys.filter((key) => UNIT_TYPES[key].cost * 2 <= remaining && (weights[key] ?? 0) > 0);
    if (!affordable.length) continue;
    const type = weightedPick(weights, affordable, random);
    remaining -= UNIT_TYPES[type].cost * 2;
    formation.push(
      { row: slot.pair[0], column: slot.column, type },
      { row: slot.pair[1], column: slot.column, type },
    );
  }
  return formation;
}

export function createCampaign(random = Math.random) {
  return Array.from({ length: GAME_CONFIG.missionCount }, (_, index) => {
    const playerBudget = GAME_CONFIG.startingBudget + index * GAME_CONFIG.budgetStep;
    const enemyBudget = playerBudget + GAME_CONFIG.enemyBudgetBonus + index * GAME_CONFIG.enemyBudgetStep;
    return {
      index,
      playerBudget,
      enemyBudget,
      enemyFormation: generateFormation(enemyBudget, index, random),
      status: index === 0 ? 'available' : 'locked',
    };
  });
}
