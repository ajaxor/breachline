import { ENEMY_UNIT_TYPES, GAME_CONFIG, UNIT_ROLE, UNIT_TYPES } from '../data/gameConfig.js';
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
  const specialistWeight = Object.entries(weights).filter(([key]) => key !== 'grunt').reduce((sum, [, value]) => sum + value, 0);
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

function addMirroredPair(formation, pair, column, type) {
  formation.push({ row: pair[0], column, type }, { row: pair[1], column, type });
}

function generateFormation(budget, missionIndex, random) {
  const rowPairs = Array.from({ length: GAME_CONFIG.rows / 2 }, (_, row) => [row, GAME_CONFIG.rows - 1 - row]);
  const weights = weightsForMission(missionIndex);
  const mobileKeys = ENEMY_UNIT_TYPES.filter((type) => type.role !== UNIT_ROLE.STRUCTURE).map((type) => type.key);
  const formation = [];
  let remaining = budget;

  const barricadePairCost = UNIT_TYPES.tollbooth.cost * 2;
  const cheapestMobilePair = Math.min(...mobileKeys.map((key) => UNIT_TYPES[key].cost * 2));
  const barricadePairs = shuffle(rowPairs, random);
  const frontColumns = GAME_CONFIG.enemyZone.slice(0, 2);
  const desiredBarricadePairs = remaining >= barricadePairCost * 2 + cheapestMobilePair ? 2 : 1;
  for (let index = 0; index < desiredBarricadePairs; index += 1) {
    if (remaining < barricadePairCost + cheapestMobilePair) break;
    addMirroredPair(formation, barricadePairs[index], frontColumns[Math.min(index, frontColumns.length - 1)], 'tollbooth');
    remaining -= barricadePairCost;
  }

  const occupied = new Set(formation.map((unit) => `${unit.row}:${unit.column}`));
  const rearColumns = GAME_CONFIG.enemyZone.slice(1);
  const mobileSlots = shuffle(rearColumns.flatMap((column) => rowPairs.map((pair) => ({ column, pair }))), random);
  for (const slot of mobileSlots) {
    if (occupied.has(`${slot.pair[0]}:${slot.column}`) || occupied.has(`${slot.pair[1]}:${slot.column}`)) continue;
    const affordable = mobileKeys.filter((key) => UNIT_TYPES[key].cost * 2 <= remaining && (weights[key] ?? 0) > 0);
    if (!affordable.length) continue;
    const type = weightedPick(weights, affordable, random);
    addMirroredPair(formation, slot.pair, slot.column, type);
    occupied.add(`${slot.pair[0]}:${slot.column}`);
    occupied.add(`${slot.pair[1]}:${slot.column}`);
    remaining -= UNIT_TYPES[type].cost * 2;
  }

  if (!formation.some((unit) => UNIT_TYPES[unit.type].role !== UNIT_ROLE.STRUCTURE)) {
    const fallback = mobileKeys.filter((key) => UNIT_TYPES[key].cost * 2 <= remaining).sort((left, right) => UNIT_TYPES[left].cost - UNIT_TYPES[right].cost)[0];
    const slot = mobileSlots.find(({ column, pair }) => !occupied.has(`${pair[0]}:${column}`) && !occupied.has(`${pair[1]}:${column}`));
    if (fallback && slot) addMirroredPair(formation, slot.pair, slot.column, fallback);
  }
  return formation;
}

export function createCampaign(random = Math.random, { missionCount = GAME_CONFIG.missionCount, difficulty = 1 } = {}) {
  return Array.from({ length: missionCount }, (_, index) => {
    const playerBudget = GAME_CONFIG.startingBudget + index * GAME_CONFIG.budgetStep;
    const baseEnemyBudget = playerBudget + GAME_CONFIG.enemyBudgetBonus + index * GAME_CONFIG.enemyBudgetStep;
    const enemyBudget = Math.round(baseEnemyBudget * difficulty);
    const draftBudget = GAME_CONFIG.startingDraftBudget + index * GAME_CONFIG.draftBudgetStep;
    return { index, playerBudget, enemyBudget, draftBudget, enemyFormation: generateFormation(enemyBudget, index, random), status: index === 0 ? MISSION_STATUS.AVAILABLE : MISSION_STATUS.LOCKED };
  });
}
