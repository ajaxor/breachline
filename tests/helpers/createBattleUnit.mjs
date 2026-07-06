import { TEAM, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../../src/data/gameConfig.js';

export function createBattleUnit({
  id = 1,
  team = TEAM.PLAYER,
  type = 'grunt',
  row = 0,
  column = 0,
  now = 0,
  overrides = {},
} = {}) {
  const definition = UNIT_TYPES[type];
  if (!definition) throw new Error(`Unknown test unit type: ${type}`);

  return {
    id,
    team,
    type,
    row,
    column,
    previousRow: row,
    previousColumn: column,
    animationStartedAt: now,
    animationDuration: 1,
    breached: false,
    movedThisTurn: false,
    hp: definition.hp,
    maxHp: definition.hp,
    alive: true,
    stealthed: hasUnitTag(definition, UNIT_TAG.STEALTH),
    ...overrides,
  };
}
