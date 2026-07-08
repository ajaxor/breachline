import { ENEMY_UNIT_TYPES, GAME_CONFIG, UNIT_ROLE, UNIT_TYPES } from '../data/gameConfig.js';
import { MISSION_STATUS } from '../data/gameTypes.js';

const STRUCTURE_TYPES = ['tollbooth', 'sentry', 'flakTurret', 'rocketTurret', 'mortarNest', 'railTurret', 'factory'];

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

function cellKey(row, column) {
  return `${row}:${column}`;
}

function isSlotOpen(occupied, { pair, column }) {
  return !occupied.has(cellKey(pair[0], column)) && !occupied.has(cellKey(pair[1], column));
}

function occupyPair(occupied, pair, column) {
  occupied.add(cellKey(pair[0], column));
  occupied.add(cellKey(pair[1], column));
}

function rowPairs() {
  return Array.from({ length: GAME_CONFIG.rows / 2 }, (_, row) => [row, GAME_CONFIG.rows - 1 - row]);
}

function middleColumns({ includeFront = false } = {}) {
  const frontColumn = GAME_CONFIG.enemyZone[0];
  const center = (GAME_CONFIG.enemyZone[0] + GAME_CONFIG.enemyZone.at(-1)) / 2;
  return GAME_CONFIG.enemyZone
    .filter((column) => includeFront || column !== frontColumn)
    .slice()
    .sort((left, right) => Math.abs(left - center) - Math.abs(right - center) || left - right);
}

function formationSlots(pattern, pairs, columns, random) {
  const centerPair = Math.floor((pairs.length - 1) / 2);
  const centerColumn = columns[0];
  const sideColumns = columns.slice(1, 4);

  switch (pattern) {
    case 'vertical-line':
      return shuffle(pairs, random).map((pair) => ({ pair, column: centerColumn }));
    case 'horizontal-line': {
      const pair = pairs[Math.min(pairs.length - 1, centerPair + Math.floor(random() * 2))];
      return columns.slice(0, 4).map((column) => ({ pair, column }));
    }
    case 'blob': {
      const nearPairs = [pairs[centerPair], pairs[centerPair + 1], pairs[centerPair - 1]].filter(Boolean);
      return shuffle([
        { pair: nearPairs[0], column: centerColumn },
        ...sideColumns.slice(0, 2).map((column) => ({ pair: nearPairs[0], column })),
        ...nearPairs.slice(1).flatMap((pair) => columns.slice(0, 2).map((column) => ({ pair, column }))),
      ], random);
    }
    case 'symmetric-columns':
      return shuffle(columns.slice(0, 4).flatMap((column) => pairs.slice(0, 3).map((pair) => ({ pair, column }))), random);
    default:
      return shuffle(columns.flatMap((column) => pairs.map((pair) => ({ pair, column }))), random);
  }
}

function uniqueSlots(slots) {
  const seen = new Set();
  return slots.filter((slot) => {
    const key = `${slot.pair[0]}:${slot.pair[1]}:${slot.column}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function choosePattern(missionIndex, random) {
  const patterns = ['vertical-line', 'horizontal-line', 'blob', 'symmetric-columns'];
  return patterns[(missionIndex + Math.floor(random() * patterns.length)) % patterns.length];
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

function addUnitsFromSlots(formation, occupied, slots, keys, weights, budget, missionIndex, random) {
  let remaining = budget;
  let placedPairs = 0;

  for (const slot of slots) {
    if (!slot.keys?.length && !keys.length) continue;
    if (!isSlotOpen(occupied, slot)) continue;
    const type = chooseFormationUnit(slot.keys ?? keys, weights, remaining, missionIndex, placedPairs, random);
    if (!type) continue;
    addMirroredPair(formation, slot.pair, slot.column, type);
    occupyPair(occupied, slot.pair, slot.column);
    remaining -= UNIT_TYPES[type].cost * 2;
    placedPairs += 1;
  }

  return { remaining, placedPairs };
}

function wallSlotsForMission(pairs, missionIndex, random) {
  const columns = middleColumns({ includeFront: true });
  const pattern = ['horizontal-line', 'blob', 'vertical-line'][missionIndex % 3];
  return formationSlots(pattern, pairs, columns, random);
}

function addWallFormation(formation, occupied, pairs, wallBudget, missionIndex, random) {
  const wallPairCost = UNIT_TYPES.wall.cost * 2;
  let remaining = wallBudget;
  let placedPairs = 0;
  for (const slot of wallSlotsForMission(pairs, missionIndex, random)) {
    if (remaining < wallPairCost) break;
    if (!isSlotOpen(occupied, slot)) continue;
    addMirroredPair(formation, slot.pair, slot.column, 'wall');
    occupyPair(occupied, slot.pair, slot.column);
    remaining -= wallPairCost;
    placedPairs += 1;
  }
  return placedPairs;
}

function requiredStructureKeys(missionIndex) {
  const keys = [];
  if (missionIndex >= UNIT_TYPES.tollbooth.campaign.unlockMission) keys.push('tollbooth');
  const advanced = ['flakTurret', 'rocketTurret', 'mortarNest', 'railTurret', 'factory']
    .filter((key) => missionIndex >= UNIT_TYPES[key].campaign.unlockMission);
  if (advanced.length) keys.push(advanced[missionIndex % advanced.length]);
  if (missionIndex >= UNIT_TYPES.sentry.campaign.unlockMission + 1) keys.push('sentry');
  return keys;
}

function placeRequiredStructures(formation, occupied, slots, structureBudget, missionIndex) {
  let remaining = structureBudget;
  const openSlots = slots.slice();

  for (const key of requiredStructureKeys(missionIndex)) {
    const cost = UNIT_TYPES[key].cost * 2;
    if (remaining < cost) continue;
    const slotIndex = openSlots.findIndex((slot) => isSlotOpen(occupied, slot));
    if (slotIndex === -1) break;
    const [slot] = openSlots.splice(slotIndex, 1);
    addMirroredPair(formation, slot.pair, slot.column, key);
    occupyPair(occupied, slot.pair, slot.column);
    remaining -= cost;
  }

  return { remaining, openSlots };
}

function generateFormation(mobileBudget, wallBudget, structureBudget, missionIndex, random) {
  const pairs = rowPairs();
  const columns = middleColumns();
  const weights = weightsForMission(missionIndex);
  const formation = [];
  const occupied = new Set();

  addWallFormation(formation, occupied, pairs, wallBudget, missionIndex, random);

  const unlockedMobile = ENEMY_UNIT_TYPES.filter((type) => type.role !== UNIT_ROLE.STRUCTURE && (weights[type.key] ?? 0) > 0);
  const unlockedStructures = STRUCTURE_TYPES.filter((key) => (weights[key] ?? 0) > 0);
  const meleeKeys = unlockedMobile.filter((type) => type.role === UNIT_ROLE.MELEE).map((type) => type.key);
  const nonMeleeKeys = unlockedMobile.filter((type) => type.role !== UNIT_ROLE.MELEE).map((type) => type.key);
  const mobileKeys = unlockedMobile.map((type) => type.key);
  const allNonWallKeys = [...mobileKeys, ...unlockedStructures];

  const structurePattern = choosePattern(missionIndex + 1, random);
  const structureSlots = uniqueSlots([
    ...formationSlots(structurePattern, pairs, columns, random),
    ...formationSlots('symmetric-columns', pairs, columns, random),
  ]).filter((slot) => isSlotOpen(occupied, slot));
  const requiredResult = placeRequiredStructures(formation, occupied, structureSlots, structureBudget, missionIndex);

  const mobilePattern = choosePattern(missionIndex, random);
  const mobileSlots = uniqueSlots([
    ...formationSlots(mobilePattern, pairs, columns, random),
    ...formationSlots('symmetric-columns', pairs, columns, random),
  ]).filter((slot) => isSlotOpen(occupied, slot));
  const tacticalSlots = mobileSlots.map((slot, index) => ({
    ...slot,
    keys: index % 3 === 0 && meleeKeys.length ? meleeKeys : (nonMeleeKeys.length ? nonMeleeKeys : mobileKeys),
  }));
  const mobileResult = addUnitsFromSlots(formation, occupied, tacticalSlots, mobileKeys, weights, mobileBudget, missionIndex, random);
  addUnitsFromSlots(formation, occupied, requiredResult.openSlots, unlockedStructures, weights, requiredResult.remaining, missionIndex, random);

  if (!formation.some((unit) => UNIT_TYPES[unit.type].role !== UNIT_ROLE.STRUCTURE)) {
    const fallback = allNonWallKeys
      .filter((key) => UNIT_TYPES[key].role !== UNIT_ROLE.STRUCTURE && UNIT_TYPES[key].cost * 2 <= mobileResult.remaining)
      .sort((left, right) => UNIT_TYPES[left].cost - UNIT_TYPES[right].cost)[0];
    const fallbackSlot = mobileSlots.find((slot) => isSlotOpen(occupied, slot));
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
    const structureBudget = Math.round((GAME_CONFIG.structureBudgetBase + index * GAME_CONFIG.structureBudgetStep) * difficulty);
    const draftBudget = GAME_CONFIG.startingDraftBudget + index * GAME_CONFIG.draftBudgetStep;
    return {
      index,
      playerBudget,
      enemyBudget,
      wallBudget,
      structureBudget,
      draftBudget,
      enemyFormation: generateFormation(enemyBudget, wallBudget, structureBudget, index, random),
      status: index === 0 ? MISSION_STATUS.AVAILABLE : MISSION_STATUS.LOCKED,
    };
  });
}
