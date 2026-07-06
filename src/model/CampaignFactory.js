import { GAME_CONFIG, UNIT_TYPES } from '../data/gameConfig.js';

function shuffle(items, random) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function weightsForMission(index) {
  const weights = { grunt: 1, sniper: 0, tank: 0, bomber: 0, healer: 0 };
  if (index >= 1) weights.sniper = 0.3 + 0.05 * index;
  if (index >= 2) weights.tank = 0.25 + 0.05 * (index - 2);
  if (index >= 3) weights.bomber = 0.2 + 0.05 * (index - 3);
  if (index >= 4) weights.healer = 0.15 + 0.04 * (index - 4);
  weights.grunt = Math.max(0.25, 1 - (weights.sniper + weights.tank + weights.bomber + weights.healer) * 0.6);
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
  const formation = [];
  let remaining = budget;

  for (const slot of slots) {
    const affordable = Object.keys(UNIT_TYPES).filter((key) => UNIT_TYPES[key].cost * 2 <= remaining);
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
