import { UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../data/gameConfig.js';

function assertPlan(plan) {
  if (!plan || !Number.isInteger(plan.row) || !Number.isInteger(plan.column) || !UNIT_TYPES[plan.type]) {
    throw new Error(`Invalid battle unit plan: ${JSON.stringify(plan)}`);
  }
}

export class BattleUnitFactory {
  constructor({ now = () => performance.now() } = {}) {
    this.now = now;
  }

  create(plan, team, id, startedAt = this.now()) {
    assertPlan(plan);
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
