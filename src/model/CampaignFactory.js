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
  const specialistWeight = Object.entries(weights).filter(([key]) => key !== 'grunt' && key !== 'wall').reduce((sum, [, value]) => sum + value, 0);
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

function chooseFormationUnit(keys, weights, remaining, missionIndex, pairIndex, random) {
  const affordable = keys.filter((key) => UNIT_TYPES[key].cost * 2 <= remaining && (weights[key] ?? 0) > 0);
  if (!affordable.length) return null;

  const byCost = affordable.slice().sort((left, right) => UNIT_TYPES[left].cost - UNIT_TYPES[right].cost);
  if (missionIndex >= 7 && pairIndex === 0) return byCost[0];

  const split = Math.max(1, Math.ceil(byCost.length / 2));
  const cheapPool = byCost.slice(0, split);
  const premiumPool = byCost.slice(Math.floor(byCost.length / 2));
  const premiumInterval = Math.max(3, 5 - Math.floor(missionIndex / 3));
  const shouldAddPremium = premiumPool.length > 0 && pairIndex % premiumInterval === premiumInterval - 1;
  const cheapBias = Math.min(0.82, 0.28 + missionIndex * 0.065);
  const pool = shouldAddPremium ? premiumPool : (random() < cheapBias ? cheapPool : affordable);
  return weightedPick(weights, pool, random);
}

function addWallLine(formation, rowPairs, wallBudget, random) {
  const wallPairCost = UNIT_TYPES.wall.cost * 2;
  let remaining = wallBudget;
  let placedPairs = 0;
  const occupied = new Set(formation.map((unit) => `${unit.row}:${unit.column}`));
  const frontColumns = GAME_CONFIG.enemyZone.slice(0, 2);
  const wallSlots = shuffle(frontColumns.flatMap((column) => rowPairs.map((pair) => ({ column, pair }))), random);

  for (const slot of wallSlots) {
    if (remaining < wallPairCost) break;
    if (occupied.has(`${slot.pair[0]}:${slot.column}`) || occupied.has(`${slot.pair[1]}:${slot.column}`)) continue;
    addMirroredPair(formation, slot.pair, slot.column, 'wall');
    occupied.add(`${slot.pair[0]}:${slot.column}`);
    occupied.add(`${slot.pair[1]}:${slot.column}`);
    remaining -= wallPairCost;
    placedPairs += 1;
  }
  return placedPairs;
}

function requiredStructureKeys(missionIndex) {
  const keys = [];
  if (missionIndex >= UNIT_TYPES.tollbooth.campaign.unlockMission) keys.push('tollbooth');
  if (missionIndex >= UNIT_TYPES.sentry.campaign.unlockMission + 1) keys.push('sentry');
  const advanced = ['flakTurret', 'rocketTurret', 'mortarNest', 'railTurret', 'factory']
    .filter((key) => missionIndex >= UNIT_TYPES[key].campaign.unlockMission);
  if (advanced.length) keys.push(advanced[missionIndex % advanced.length]);
  return keys;
}

function placeRequiredStructures(formation, rowPairs, columns, budget, missionIndex, random) {
  let remaining = budget;
  const occupied = new Set(formation.map((unit) => `${unit.row}:${unit.column}`));
  const slots = shuffle(columns.flatMap((column) => rowPairs.map((pair) => ({ column, pair }))), random);

  for (const key of requiredStructureKeys(missionIndex)) {
    const cost = UNIT_TYPES[key].cost * 2;
    if (remaining < cost) continue;
    const slotIndex = slots.findIndex(({ column, pair }) => !occupied.has(`${pair[0]}:${column}`) && !occupied.has(`${pair[1]}:${column}`));
    if (slotIndex === -1) break;
    const [slot] = slots.splice(slotIndex, 1);
    addMirroredPair(formation, slot.pair, slot.column, key);
    occupied.add(`${slot.pair[0]}:${slot.column}`);
    occupied.add(`${slot.pair[1]}:${slot.column}`);
    remaining -= cost;
  }

  return remaining;
}

function generateFormation(budget, wallBudget, missionIndex, random) {
  const rowPairs = Array.from({ length: GAME_CONFIG.rows / 2 }, (_, row) => [row, GAME_CONFIG.rows - 1 - row]);
  const weights = weightsForMission(missionIndex);
  const formation = [];
  const wallPairs = addWallLine(formation, rowPairs, wallBudget, random);

  const unlockedMobile = ENEMY_UNIT_TYPES.filter((type) => type.role !== UNIT_ROLE.STRUCTURE && (weights[type.key] ?? 0) > 0);
  const unlockedStructures = ENEMY_UNIT_TYPES.filter((type) => type.role === UNIT_ROLE.STRUCTURE && type.key !== 'wall' && (weights[type.key] ?? 0) > 0);
  const meleeKeys = unlockedMobile.filter((type) => type.role === UNIT_ROLE.MELEE).map((type) => type.key);
  const protectedKeys = [...unlockedMobile.filter((type) => type.role !== UNIT_ROLE.MELEE).map((type) => type.key), ...unlockedStructures.map((type) => type.key)];
  const allNonWallKeys = [...unlockedMobile.map((type) => type.key), ...unlockedStructures.map((type) => type.key)];

  const rearStartOffset = Math.min(2, Math.max(1, wallPairs));
  const rearColumns = GAME_CONFIG.enemyZone.slice(rearStartOffset);
  let remaining = placeRequiredStructures(formation, rowPairs, rearColumns, budget, missionIndex, random);

  const occupied = new Set(formation.map((unit) => `${unit.row}:${unit.column}`));
  const frontColumn = GAME_CONFIG.enemyZone[0];
  const frontMeleeSlots = shuffle(rowPairs, random)
    .filter((pair) => !occupied.has(`${pair[0]}:${frontColumn}`) && !occupied.has(`${pair[1]}:${frontColumn}`))
    .map((pair) => ({ column: frontColumn, pair, keys: meleeKeys }));
  const protectedSlots = shuffle(rearColumns.flatMap((column) => rowPairs.map((pair) => ({ column, pair, keys: protectedKeys }))), random)
    .filter(({ column, pair }) => !occupied.has(`${pair[0]}:${column}`) && !occupied.has(`${pair[1]}:${column}`));

  const tacticalSlots = [];
  const maxSlots = Math.max(frontMeleeSlots.length, protectedSlots.length);
  for (let index = 0; index < maxSlots; index += 1) {
    if (frontMeleeSlots[index]) tacticalSlots.push(frontMeleeSlots[index]);
    if (protectedSlots[index]) tacticalSlots.push(protectedSlots[index]);
  }

  let pairIndex = 0;
  for (const slot of tacticalSlots) {
    if (!slot.keys.length) continue;
    const type = chooseFormationUnit(slot.keys, weights, remaining, missionIndex, pairIndex, random);
    if (!type) continue;
    addMirroredPair(formation, slot.pair, slot.column, type);
    occupied.add(`${slot.pair[0]}:${slot.column}`);
    occupied.add(`${slot.pair[1]}:${slot.column}`);
    remaining -= UNIT_TYPES[type].cost * 2;
    pairIndex += 1;
  }

  if (!formation.some((unit) => UNIT_TYPES[unit.type].role !== UNIT_ROLE.STRUCTURE)) {
    const fallback = allNonWallKeys.filter((key) => UNIT_TYPES[key].cost * 2 <= remaining && UNIT_TYPES[key].role !== UNIT_ROLE.STRUCTURE).sort((left, right) => UNIT_TYPES[left].cost - UNIT_TYPES[right].cost)[0];
    const fallbackSlot = fallback && UNIT_TYPES[fallback].role === UNIT_ROLE.MELEE ? frontMeleeSlots[0] : protectedSlots[0];
    if (fallback && fallbackSlot) addMirroredPair(formation, fallbackSlot.pair, fallbackSlot.column, fallback);
  }
  return formation;
}

export function createCampaign(random = Math.random, { missionCount = GAME_CONFIG.missionCount, difficulty = 1 } = {}) {
  return Array.from({ length: missionCount }, (_, index) => {
    const playerBudget = GAME_CONFIG.startingBudget + index * GAME_CONFIG.budgetStep;
    const baseEnemyBudget = playerBudget + GAME_CONFIG.enemyBudgetBonus + index * GAME_CONFIG.enemyBudgetStep;
    const enemyBudget = Math.round(baseEnemyBudget * difficulty);
    const wallBudget = Math.round((GAME_CONFIG.wallBudgetBase + index * GAME_CONFIG.wallBudgetStep) * difficulty);
    const draftBudget = GAME_CONFIG.startingDraftBudget + index * GAME_CONFIG.draftBudgetStep;
    return { index, playerBudget, enemyBudget, wallBudget, draftBudget, enemyFormation: generateFormation(enemyBudget, wallBudget, index, random), status: index === 0 ? MISSION_STATUS.AVAILABLE : MISSION_STATUS.LOCKED };
  });
}
