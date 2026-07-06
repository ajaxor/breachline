import { GAME_CONFIG, UNIT_ROLE, UNIT_TAG, UNIT_TYPES } from './gameConfig.js';

const VALID_ACTIONS = new Set(['attack', 'heal']);
const VALID_ON_ATTACK = new Set(['detonate']);
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
  assertPositiveNumber(GAME_CONFIG.startingBudget, 'startingBudget', { integer: true });
  assertPositiveNumber(GAME_CONFIG.budgetStep, 'budgetStep', { integer: true, allowZero: true });
  assertPositiveNumber(GAME_CONFIG.enemyBudgetBonus, 'enemyBudgetBonus', { integer: true, allowZero: true });
  assertPositiveNumber(GAME_CONFIG.enemyBudgetStep, 'enemyBudgetStep', { integer: true, allowZero: true });
  assertPositiveNumber(GAME_CONFIG.startingDraftBudget, 'startingDraftBudget', { integer: true });
  assertPositiveNumber(GAME_CONFIG.draftBudgetStep, 'draftBudgetStep', { integer: true, allowZero: true });

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

  for (const tag of type.tags) assert(VALID_TAGS.has(tag), `${label} has unknown tag ${tag}`);

  const action = type.action ?? 'attack';
  assert(VALID_ACTIONS.has(action), `${label} has unknown action ${action}`);
  if (action === 'heal') {
    assert(type.attack === 0, `${label} healers must have zero attack`);
    assertPositiveNumber(type.healAmount, `${label} healAmount`, { integer: true });
  }
  if (type.onAttack !== undefined) assert(VALID_ON_ATTACK.has(type.onAttack), `${label} has unknown onAttack behavior ${type.onAttack}`);

  if (type.role === UNIT_ROLE.STRUCTURE) {
    assert(type.tags.includes(UNIT_TAG.STATIONARY), `${label} structures must be stationary`);
    assert(type.tags.includes(UNIT_TAG.AI_ONLY), `${label} structures must be AI-only`);
  }
  if (type.tags.includes(UNIT_TAG.FLYING)) {
    assert(!type.tags.includes(UNIT_TAG.FAST_ATTACK), `${label} flying units must not duplicate fast-attack`);
    assert(!type.tags.includes(UNIT_TAG.CAN_MOVE_SIDEWAYS), `${label} flying units must not use ground sideways movement`);
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
