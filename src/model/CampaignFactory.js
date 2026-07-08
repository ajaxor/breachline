import { ENEMY_UNIT_TYPES, GAME_CONFIG, UNIT_ROLE, UNIT_TYPES, isUnitTechAvailable } from '../data/gameConfig.js';
import { MISSION_STATUS } from '../data/gameTypes.js';

const STRUCTURE_TYPES = ['tollbooth', 'sentry', 'flakTurret', 'rocketTurret', 'mortarNest', 'railTurret', 'factory'];
const PROTECTED_ROLES = new Set([UNIT_ROLE.RANGED, UNIT_ROLE.SUPPORT, UNIT_ROLE.FLYING]);
const STATIONARY_ROLES = new Set([UNIT_ROLE.WALL, UNIT_ROLE.STRUCTURE]);

function shuffle(items, random) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function weightsForMission(index, random, missionCount) {
  const weights = Object.fromEntries(ENEMY_UNIT_TYPES.map((type) => {
    const { unlockMission, initialWeight, weightGrowth } = type.campaign;
    const techAvailable = isUnitTechAvailable(type, index, random, missionCount);
    const weight = index < unlockMission || !techAvailable ? 0 : initialWeight + weightGrowth * (index - unlockMission);
    return [type.key, weight];
  }));
  const specialistWeight = Object.entries(weights).filter(([key]) => key !== 'grunt' && key !== 'wall' && key !== 'skitter').reduce((sum, [, value]) => sum + value, 0);
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

function cellKey(row, column) { return `${row}:${column}`; }
function pairKey(pair) { return `${pair[0]}:${pair[1]}`; }
function rowPairs() { return Array.from({ length: GAME_CONFIG.rows / 2 }, (_, row) => [row, GAME_CONFIG.rows - 1 - row]); }
function pairIndex(pair) { return Math.min(pair[0], pair[1]); }
function isSlotOpen(occupied, { pair, column }) { return !occupied.has(cellKey(pair[0], column)) && !occupied.has(cellKey(pair[1], column)); }
function occupyPair(occupied, pair, column) { occupied.add(cellKey(pair[0], column)); occupied.add(cellKey(pair[1], column)); }
function addMirroredPair(formation, occupied, pair, column, type) {
  formation.push({ row: pair[0], column, type }, { row: pair[1], column, type });
  occupyPair(occupied, pair, column);
}

function centerOutPairs(pairs) {
  const center = (pairs.length - 1) / 2;
  return pairs.slice().sort((left, right) => Math.abs(pairIndex(left) - center) - Math.abs(pairIndex(right) - center) || pairIndex(left) - pairIndex(right));
}

function columnsByMiddle({ includeFront = false, includeBack = true } = {}) {
  const frontColumn = GAME_CONFIG.enemyZone[0];
  const backColumn = GAME_CONFIG.enemyZone.at(-1);
  const center = (frontColumn + backColumn) / 2;
  return GAME_CONFIG.enemyZone
    .filter((column) => (includeFront || column !== frontColumn) && (includeBack || column !== backColumn))
    .slice()
    .sort((left, right) => Math.abs(left - center) - Math.abs(right - center) || left - right);
}

function uniqueSlots(slots) {
  const seen = new Set();
  return slots.filter((slot) => {
    const key = `${pairKey(slot.pair)}:${slot.column}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function slotsForBase(pairs, columns, random) {
  const orderedPairs = centerOutPairs(pairs);
  const horizontal = orderedPairs.flatMap((pair) => columns.slice(0, 3).map((column) => ({ pair, column })));
  const vertical = columns.slice(0, 2).flatMap((column) => orderedPairs.map((pair) => ({ pair, column })));
  return uniqueSlots([...shuffle(horizontal, random), ...vertical]);
}

function slotsForMobile(pairs, columns, random) {
  return uniqueSlots(shuffle(centerOutPairs(pairs).flatMap((pair) => columns.map((column) => ({ pair, column }))), random));
}

function isBlocker(typeKey) {
  return STATIONARY_ROLES.has(UNIT_TYPES[typeKey].role);
}

function blockerColumnsByPair(formation) {
  const result = new Map();
  for (const unit of formation) {
    if (!isBlocker(unit.type)) continue;
    const key = Math.min(unit.row, GAME_CONFIG.rows - 1 - unit.row);
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(unit.column);
  }
  for (const columns of result.values()) columns.sort((left, right) => left - right);
  return result;
}

function hasBlockerAhead(slot, blockers) {
  const columns = blockers.get(pairIndex(slot.pair)) ?? [];
  return columns.some((column) => column < slot.column);
}

function affordableKeys(keys, budget) {
  return keys.filter((key) => UNIT_TYPES[key].cost * 2 <= budget);
}

function addWallBase(formation, occupied, pairs, wallBudget, random) {
  const wallPairCost = UNIT_TYPES.wall.cost * 2;
  let remaining = wallBudget;
  let placedPairs = 0;
  const columns = columnsByMiddle({ includeFront: false, includeBack: false });

  for (const slot of slotsForBase(pairs, columns, random)) {
    if (remaining < wallPairCost) break;
    if (!isSlotOpen(occupied, slot)) continue;
    addMirroredPair(formation, occupied, slot.pair, slot.column, 'wall');
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

function addStructureBase(formation, occupied, pairs, structureBudget, missionIndex, weights, random) {
  let remaining = structureBudget;
  const baseColumns = columnsByMiddle({ includeFront: false, includeBack: false });
  const slots = slotsForBase(pairs, baseColumns, random);
  const unlocked = STRUCTURE_TYPES.filter((key) => (weights[key] ?? 0) > 0);
  const planned = requiredStructureKeys(missionIndex).filter((key) => unlocked.includes(key));

  while (planned.length < Math.min(4, 1 + Math.floor(missionIndex / 2))) {
    const candidates = unlocked.filter((key) => !planned.includes(key) && UNIT_TYPES[key].cost * 2 <= remaining);
    if (!candidates.length) break;
    planned.push(weightedPick(weights, candidates, random));
  }

  for (const key of planned) {
    const cost = UNIT_TYPES[key].cost * 2;
    if (remaining < cost) continue;
    const slotIndex = slots.findIndex((slot) => isSlotOpen(occupied, slot));
    if (slotIndex === -1) break;
    const [slot] = slots.splice(slotIndex, 1);
    addMirroredPair(formation, occupied, slot.pair, slot.column, key);
    remaining -= cost;
  }

  return remaining;
}

function pickDistinct(weights, keys, count, random) {
  const result = [];
  const pool = keys.slice();
  while (result.length < count && pool.length) {
    const key = weightedPick(weights, pool, random);
    result.push(key);
    pool.splice(pool.indexOf(key), 1);
  }
  return result;
}

function draftCampaignArmy(mobileBudget, missionIndex, weights, random) {
  const unlockedMobile = ENEMY_UNIT_TYPES.filter((type) => !STATIONARY_ROLES.has(type.role) && (weights[type.key] ?? 0) > 0);
  const nonSupport = unlockedMobile.filter((type) => type.role !== UNIT_ROLE.SUPPORT).map((type) => type.key);
  const supports = unlockedMobile.filter((type) => type.role === UNIT_ROLE.SUPPORT).map((type) => type.key);
  const cheapMass = nonSupport.filter((key) => UNIT_TYPES[key].cost <= 30);
  const premium = nonSupport.filter((key) => UNIT_TYPES[key].cost > 30);
  const coreTypeCount = missionIndex >= 5 ? 2 : 3;
  const core = [];

  if (missionIndex <= 1) {
    core.push(...pickDistinct(weights, nonSupport, Math.min(2, nonSupport.length), random));
  } else {
    core.push(...pickDistinct(weights, cheapMass.length ? cheapMass : nonSupport, 1, random));
    core.push(...pickDistinct(weights, premium.filter((key) => !core.includes(key)).length ? premium.filter((key) => !core.includes(key)) : nonSupport.filter((key) => !core.includes(key)), coreTypeCount - 1, random));
  }
  if (!core.length && nonSupport.length) core.push(nonSupport[0]);

  const supportKey = missionIndex >= 4 && supports.length ? weightedPick(weights, supports, random) : null;
  const supportBudget = supportKey ? Math.min(UNIT_TYPES[supportKey].cost * 2, mobileBudget * 0.14) : 0;
  let remaining = mobileBudget - supportBudget;
  const entries = [];
  const createEntry = (key, pairs, extra = {}) => ({
    type: key,
    pairs,
    protected: PROTECTED_ROLES.has(UNIT_TYPES[key].role),
    avoidBlockers: UNIT_TYPES[key].role === UNIT_ROLE.MELEE,
    ...extra,
  });

  const coreShares = core.length === 1 ? [1] : (missionIndex >= 5 ? [0.68, 0.32] : [0.58, 0.42, 0.15]);
  core.forEach((key, index) => {
    const cost = UNIT_TYPES[key].cost * 2;
    const targetBudget = Math.max(cost, remaining * (coreShares[index] ?? 0.15));
    const pairs = Math.max(1, Math.floor(targetBudget / cost));
    if (remaining >= cost) {
      entries.push(createEntry(key, pairs));
      remaining -= pairs * cost;
    }
  });

  const refillKey = core.find((key) => UNIT_TYPES[key].cost <= 30) ?? core[0];
  if (refillKey) {
    const cost = UNIT_TYPES[refillKey].cost * 2;
    const refill = Math.floor(Math.max(0, remaining) / cost);
    if (refill > 0) entries.push(createEntry(refillKey, refill));
  }

  if (supportKey && supportBudget >= UNIT_TYPES[supportKey].cost * 2) entries.push(createEntry(supportKey, 1, { protected: true, support: true, avoidBlockers: false }));
  return entries;
}

function placeDraftedArmy(formation, occupied, draftedArmy, pairs, random) {
  const blockers = blockerColumnsByPair(formation);
  const protectedColumns = GAME_CONFIG.enemyZone.slice(3).reverse();
  const frontColumns = columnsByMiddle({ includeFront: false });
  const protectedSlots = slotsForMobile(pairs, protectedColumns, random).filter((slot) => hasBlockerAhead(slot, blockers));
  const frontSlots = slotsForMobile(pairs, frontColumns, random);
  const unblockedFrontSlots = frontSlots.filter((slot) => !hasBlockerAhead(slot, blockers));
  const fallbackSlots = slotsForMobile(pairs, GAME_CONFIG.enemyZone.slice().reverse(), random);
  const unblockedFallbackSlots = fallbackSlots.filter((slot) => !hasBlockerAhead(slot, blockers));

  const takeSlot = (slots) => {
    const index = slots.findIndex((slot) => isSlotOpen(occupied, slot));
    if (index === -1) return null;
    const [slot] = slots.splice(index, 1);
    return slot;
  };

  for (const entry of draftedArmy) {
    for (let count = 0; count < entry.pairs; count += 1) {
      const preferredSlots = entry.protected ? protectedSlots : (entry.avoidBlockers ? unblockedFrontSlots : frontSlots);
      const fallbackPreferredSlots = entry.avoidBlockers ? unblockedFallbackSlots : fallbackSlots;
      const slot = takeSlot(preferredSlots) ?? takeSlot(fallbackPreferredSlots) ?? takeSlot(fallbackSlots);
      if (!slot) return;
      addMirroredPair(formation, occupied, slot.pair, slot.column, entry.type);
    }
  }
}

function generateFormation(mobileBudget, wallBudget, structureBudget, missionIndex, missionCount, random) {
  const pairs = rowPairs();
  const weights = weightsForMission(missionIndex, random, missionCount);
  const formation = [];
  const occupied = new Set();

  addWallBase(formation, occupied, pairs, wallBudget, random);
  addStructureBase(formation, occupied, pairs, structureBudget, missionIndex, weights, random);
  placeDraftedArmy(formation, occupied, draftCampaignArmy(mobileBudget, missionIndex, weights, random), pairs, random);

  if (!formation.some((unit) => !STATIONARY_ROLES.has(UNIT_TYPES[unit.type].role))) {
    const fallback = affordableKeys(ENEMY_UNIT_TYPES.filter((type) => !STATIONARY_ROLES.has(type.role) && (weights[type.key] ?? 0) > 0).map((type) => type.key), mobileBudget).sort((left, right) => UNIT_TYPES[left].cost - UNIT_TYPES[right].cost)[0];
    const slot = slotsForMobile(pairs, columnsByMiddle({ includeFront: false }), random).find((candidate) => isSlotOpen(occupied, candidate));
    if (fallback && slot) addMirroredPair(formation, occupied, slot.pair, slot.column, fallback);
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
    const draftBudgetTaper = index * Math.max(0, index - 1) * GAME_CONFIG.draftBudgetTaper;
    const draftBudget = Math.max(GAME_CONFIG.startingDraftBudget, GAME_CONFIG.startingDraftBudget + index * GAME_CONFIG.draftBudgetStep - draftBudgetTaper);
    return {
      index,
      playerBudget,
      enemyBudget,
      wallBudget,
      structureBudget,
      draftBudget,
      enemyFormation: generateFormation(enemyBudget, wallBudget, structureBudget, index, missionCount, random),
      status: index === 0 ? MISSION_STATUS.AVAILABLE : MISSION_STATUS.LOCKED,
    };
  });
}
