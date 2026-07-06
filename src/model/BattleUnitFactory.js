import { GAME_CONFIG, TEAM, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../data/gameConfig.js';

function assertPlan(plan) {
  if (!plan || !Number.isInteger(plan.row) || !Number.isInteger(plan.column)) throw new Error(`Invalid battle unit position: ${JSON.stringify(plan)}`);
  if (plan.row < 0 || plan.row >= GAME_CONFIG.rows || plan.column < 0 || plan.column >= GAME_CONFIG.columns) throw new Error(`Battle unit is outside the board: ${JSON.stringify(plan)}`);
  if (!UNIT_TYPES[plan.type]) throw new Error(`Unknown battle unit type: ${plan?.type}`);
}

export class BattleUnitFactory {
  create(plan, team, id, startedAt) {
    assertPlan(plan);
    if (!Object.values(TEAM).includes(team)) throw new Error(`Unknown battle unit team: ${team}`);
    if (!Number.isInteger(id) || id <= 0) throw new Error(`Invalid battle unit id: ${id}`);
    const type = UNIT_TYPES[plan.type];
    return {
      id,
      team,
      type: plan.type,
      row: plan.row,
      column: plan.column,
      previousRow: plan.row,
      previousColumn: plan.column,
      animationStartedAt: startedAt,
      animationDuration: 1,
      breached: false,
      movedThisTurn: false,
      hp: type.hp,
      maxHp: type.hp,
      alive: true,
      stealthed: hasUnitTag(type, UNIT_TAG.STEALTH),
    };
  }
}
