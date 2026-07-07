import { UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../data/gameConfig.js';

export const gridDistance = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.column - b.column));
const laneDistance = (a, b) => Math.abs(a.column - b.column);

export class TargetingPolicy {
  isInAttackPattern(attacker, target, type = UNIT_TYPES[attacker.type]) {
    if (hasUnitTag(type, UNIT_TAG.SWIVEL)) return gridDistance(attacker, target) <= type.range;
    return attacker.row === target.row && laneDistance(attacker, target) <= type.range;
  }

  canTarget(attacker, target, type = UNIT_TYPES[attacker.type]) {
    if (!this.isInAttackPattern(attacker, target, type)) return false;
    if (hasUnitTag(target.type, UNIT_TAG.FLYING)
      && !hasUnitTag(type, UNIT_TAG.FLYING)
      && !hasUnitTag(type, UNIT_TAG.ANTI_AIR)) return false;
    return !hasUnitTag(target.type, UNIT_TAG.STEALTH) || gridDistance(attacker, target) <= 1;
  }

  nearest(candidates, origin) {
    return candidates.slice().sort((a, b) => gridDistance(origin, a) - gridDistance(origin, b))[0] ?? null;
  }
}