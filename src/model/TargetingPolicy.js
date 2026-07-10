import { TEAM, UNIT_ROLE, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../data/gameConfig.js';

export const gridDistance = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.column - b.column));
const laneDistance = (a, b) => Math.abs(a.column - b.column);

export class TargetingPolicy {
  isAhead(attacker, target) {
    const direction = attacker.team === TEAM.PLAYER ? 1 : -1;
    return (target.column - attacker.column) * direction >= 0;
  }

  isBlockingAdjacent(attacker, target) {
    const direction = attacker.team === TEAM.PLAYER ? 1 : -1;
    return target.row === attacker.row && target.column === attacker.column + direction;
  }

  isInAttackPattern(attacker, target, type = UNIT_TYPES[attacker.type]) {
    if (hasUnitTag(type, UNIT_TAG.SWIVEL)) return gridDistance(attacker, target) <= type.range;
    return attacker.row === target.row && laneDistance(attacker, target) <= type.range;
  }

  canTarget(attacker, target, type = UNIT_TYPES[attacker.type]) {
    if (!this.isAhead(attacker, target)) return false;
    if (!this.isInAttackPattern(attacker, target, type)) return false;
    const targetType = UNIT_TYPES[target.type];
    const targetIsBaseWall = Boolean(target.baseWall);
    if (!targetIsBaseWall && hasUnitTag(type, UNIT_TAG.RAM) && targetType?.role === UNIT_ROLE.WALL) return false;
    if (!targetIsBaseWall && targetType?.role === UNIT_ROLE.WALL && !this.isBlockingAdjacent(attacker, target)) return false;
    if (hasUnitTag(target.type, UNIT_TAG.FLYING)
      && !hasUnitTag(type, UNIT_TAG.FLYING)
      && !hasUnitTag(type, UNIT_TAG.ANTI_AIR)) return false;
    const stealthActive = target.stealthed ?? hasUnitTag(target.type, UNIT_TAG.STEALTH);
    return !stealthActive || gridDistance(attacker, target) <= 1;
  }

  targetPriority() {
    return 0;
  }

  nearest(candidates, origin) {
    const type = UNIT_TYPES[origin.type];
    return candidates.slice().sort((a, b) => (this.targetPriority(origin, a, type) - this.targetPriority(origin, b, type)) || gridDistance(origin, a) - gridDistance(origin, b))[0] ?? null;
  }
}
