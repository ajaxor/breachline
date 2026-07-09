import { AURA_EFFECT, GAME_CONFIG, UNIT_ROLE, UNIT_TAG, UNIT_TYPES } from './gameConfig.js';
import { ATTACK_EFFECT, UNIT_ACTION } from './gameTypes.js';

const VALID_ACTIONS = new Set(Object.values(UNIT_ACTION));
const VALID_AURA_EFFECTS = new Set(Object.values(AURA_EFFECT));
const VALID_ON_ATTACK = new Set(Object.values(ATTACK_EFFECT));
const VALID_TAGS = new Set(Object.values(UNIT_TAG));
const VALID_ROLES = new Set(Object.values(UNIT_ROLE));

function assert(condition, message) {
  if (!condition) throw new Error(`Invalid game data: ${message}`);
}

function assertPositiveNumber(value, label, { integer = false, allowZero = false } = {}) {
  assert(typeof value === 'number' && Number.isFinite(value), `${label} must be a finite number`);
  assert(allowZero ? value >= 0 : value > 0, `${label} must be ${allowZero ? 'non-negative' : 'positive'}`);
  if (integer) assert(Number.isInteger(value), `${label} must be an integer`);
}

function validateZone(zone, label) {
  assert(Array.isArray(zone) && zone.length > 0, `${label} must contain at least one column`);
  assert(new Set(zone).size === zone.length, `${label} cannot contain duplicate columns`);
  for (const column of zone) {
    assert(Number.isInteger(column), `${label} columns must be integers`);
    assert(column >= 0 && column < GAME_CONFIG.columns, `${label} column ${column} is outside the board`);
  }
}

function validateConfig() {
  assertPositiveNumber(GAME_CONFIG.columns, 'columns', { integer: true });
  assertPositiveNumber(GAME_CONFIG.rows, 'rows', { integer: true });
  assert(GAME_CONFIG.rows % 2 === 0, 'rows must be even because enemy formations are generated in mirrored row pairs');
  assertPositiveNumber(GAME_CONFIG.baseHp, 'baseHp', { integer: true });
  assertPositiveNumber(GAME_CONFIG.missionCount, 'missionCount', { integer: true });
  assertPositiveNumber(GAME_CONFIG.tickIntervalMs, 'tickIntervalMs', { integer: true });
  assertPositiveNumber(GAME_CONFIG.maxLogEntries, 'maxLogEntries', { integer: true });
  assertPositiveNumber(GAME_CONFIG.startingBudget, 'startingBudget', { integer: true });
  assertPositiveNumber(GAME_CONFIG.budgetStep, 'budgetStep', { integer: true, allowZero: true });
  assertPositiveNumber(GAME_CONFIG.enemyBudgetBonus, 'enemyBudgetBonus', { integer: true, allowZero: true });
  assertPositiveNumber(GAME_CONFIG.enemyBudgetStep, 'enemyBudgetStep', { integer: true, allowZero: true });
  assertPositiveNumber(GAME_CONFIG.wallBudgetBase, 'wallBudgetBase', { integer: true, allowZero: true });
  assertPositiveNumber(GAME_CONFIG.wallBudgetStep, 'wallBudgetStep', { integer: true, allowZero: true });
  assertPositiveNumber(GAME_CONFIG.startingDraftBudget, 'startingDraftBudget', { integer: true });
  assertPositiveNumber(GAME_CONFIG.draftBudgetStep, 'draftBudgetStep', { integer: true, allowZero: true });
  assertPositiveNumber(GAME_CONFIG.draftBudgetTaper, 'draftBudgetTaper', { integer: true, allowZero: true });

  validateZone(GAME_CONFIG.playerZone, 'playerZone');
  validateZone(GAME_CONFIG.enemyZone, 'enemyZone');
  const overlap = GAME_CONFIG.playerZone.find((column) => GAME_CONFIG.enemyZone.includes(column));
  assert(overlap === undefined, `deployment zones overlap at column ${overlap}`);
}

function validateUnit(mapKey, type) {
  const label = `unit ${mapKey}`;
  assert(type && typeof type === 'object', `${label} must be an object`);
  assert(type.key === mapKey, `${label} key must match its UNIT_TYPES property`);
  assert(typeof type.name === 'string' && type.name.trim().length > 0, `${label} must have a name`);
  assert(VALID_ROLES.has(type.role), `${label} has unknown role ${type.role}`);
  assertPositiveNumber(type.cost, `${label} cost`, { integer: true });
  assertPositiveNumber(type.hp, `${label} hp`, { integer: true });
  assertPositiveNumber(type.attack, `${label} attack`, { integer: true, allowZero: true });
  assertPositiveNumber(type.range, `${label} range`, { integer: true });
  assert(typeof type.behavior === 'string' && type.behavior.trim().length > 0, `${label} must describe its behavior`);
  assert(typeof type.graphic === 'string' && type.graphic.length > 0, `${label} must define a graphic`);
  assert(Array.isArray(type.tags), `${label} tags must be an array`);
  assert(new Set(type.tags).size === type.tags.length, `${label} cannot contain duplicate tags`);

  assert(type.campaign && typeof type.campaign === 'object', `${label} must define campaign availability`);
  assertPositiveNumber(type.campaign.unlockMission, `${label} campaign.unlockMission`, { integer: true, allowZero: true });
  assertPositiveNumber(type.campaign.initialWeight, `${label} campaign.initialWeight`, { allowZero: true });
  assertPositiveNumber(type.campaign.weightGrowth, `${label} campaign.weightGrowth`, { allowZero: true });

  for (const tag of type.tags) assert(VALID_TAGS.has(tag), `${label} has unknown tag ${tag}`);

  const action = type.action ?? UNIT_ACTION.ATTACK;
  assert(VALID_ACTIONS.has(action), `${label} has unknown action ${action}`);
  if (action === UNIT_ACTION.HEAL) {
    assert(type.attack === 0, `${label} healers must have zero attack`);
    assertPositiveNumber(type.healAmount, `${label} healAmount`, { integer: true });
  }
  if (type.aura !== undefined) {
    assert(type.role === UNIT_ROLE.SUPPORT || type.tags.includes(UNIT_TAG.ENHANCE), `${label} aura units must use the support role unless they are explicit melee commanders with Enhance`);
    assert(type.attack === 0 || type.tags.includes(UNIT_TAG.ENHANCE), `${label} aura units must have zero attack unless they are explicit melee commanders with Enhance`);
    assert(VALID_AURA_EFFECTS.has(type.aura.effect), `${label} has unknown aura effect ${type.aura.effect}`);
    assertPositiveNumber(type.aura.range, `${label} aura.range`, { integer: true });
    assertPositiveNumber(type.aura.value, `${label} aura.value`, { integer: true });
  }
  if (type.production !== undefined) {
    assert(type.tags.includes(UNIT_TAG.FACTORY), `${label} production units must use the factory tag`);
    assert(typeof type.production.type === 'string' && UNIT_TYPES[type.production.type], `${label} production.type must reference a unit`);
    assert(UNIT_TYPES[type.production.type].role === UNIT_ROLE.MELEE, `${label} factories should produce melee units`);
    assertPositiveNumber(type.production.interval, `${label} production.interval`, { integer: true });
  }
  if (type.thorns !== undefined) {
    assert(type.tags.includes(UNIT_TAG.THORNS), `${label} thorns config must use the thorns tag`);
    assertPositiveNumber(type.thorns.reflectRatio, `${label} thorns.reflectRatio`);
    assert(type.thorns.reflectRatio <= 1, `${label} thorns.reflectRatio cannot exceed 1`);
  }
  if (type.onAttack !== undefined) assert(VALID_ON_ATTACK.has(type.onAttack), `${label} has unknown onAttack behavior ${type.onAttack}`);

  if (type.role === UNIT_ROLE.STRUCTURE) {
    assert(type.tags.includes(UNIT_TAG.STATIONARY), `${label} structures must be stationary`);
    assert(type.tags.includes(UNIT_TAG.AI_ONLY), `${label} structures must be AI-only`);
  }
  if (type.tags.includes(UNIT_TAG.FLYING)) {
    assert(!type.tags.includes(UNIT_TAG.FAST_ATTACK), `${label} flying units must not duplicate fast-attack`);
    assert(!type.tags.includes(UNIT_TAG.AGILE), `${label} flying units must not use ground agile movement`);
    assert(type.role !== UNIT_ROLE.STRUCTURE, `${label} structures cannot fly`);
  }
}

export function validateGameData() {
  validateConfig();
  const entries = Object.entries(UNIT_TYPES);
  assert(entries.length > 0, 'UNIT_TYPES must contain at least one unit');
  entries.forEach(([key, type]) => validateUnit(key, type));
  return true;
}
