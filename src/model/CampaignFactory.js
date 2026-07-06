import { ENEMY_UNIT_TYPES, GAME_CONFIG, UNIT_TYPES } from '../data/gameConfig.js';
import { MISSION_STATUS } from '../data/gameTypes.js';

function shuffle(items, random) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function weightsForMission(index) {
  const weights = Object.fromEntries(ENEMY_UNIT_TYPES.map((type) => {
    const { unlockMission, initialWeight, weightGrowth } = type.campaign;
    const weight = index < unlockMission ? 0 : initialWeight + weightGrowth * (index - unlockMission);
    return [type.key, weight];
  }));

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
    const draftBudget = GAME_CONFIG.startingDraftBudget + index * GAME_CONFIG.draftBudgetStep;
    return {
      index,
      playerBudget,
      enemyBudget,
      draftBudget,
      enemyFormation: generateFormation(enemyBudget, index, random),
      status: index === 0 ? MISSION_STATUS.AVAILABLE : MISSION_STATUS.LOCKED,
    };
  });
}
