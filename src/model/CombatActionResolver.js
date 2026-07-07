import { UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../data/gameConfig.js';
import { COMBAT_EVENT } from '../data/gameTypes.js';
import { MovementPolicy } from './MovementPolicy.js';
import { TargetingPolicy, gridDistance } from './TargetingPolicy.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const lerp = (start, end, progress) => start + (end - start) * progress;

const snapshot = (unit, at) => {
  const duration = Math.max(1, unit.animationDuration ?? 1);
  const progress = unit.animationStartedAt === undefined
    ? 1
    : clamp01((at - unit.animationStartedAt) / duration);
  return {
    id: unit.id,
    team: unit.team,
    type: unit.type,
    row: lerp(unit.previousRow ?? unit.row, unit.row, progress),
    column: lerp(unit.previousColumn ?? unit.column, unit.column, progress),
  };
};

export class CombatActionResolver {
  constructor({ targeting = new TargetingPolicy(), movement = new MovementPolicy() } = {}) {
    this.targeting = targeting;
    this.movement = movement;
  }

  processQueue(model, units, now, duration) {
    const queue = units.slice();
    let consecutivePasses = 0;
    while (queue.length > 0 && consecutivePasses < queue.length) {
      const unit = queue.shift();
      if (!unit.alive) continue;
      if (this.processUnit(model, unit, now, duration)) consecutivePasses = 0;
      else {
        queue.push(unit);
        consecutivePasses += 1;
      }
    }
  }

  processUnit(model, unit, now, duration) {
    if (!unit.alive) return true;
    const type = UNIT_TYPES[unit.type];
    if (unit.breached) {
      model.attackBase(unit, now, duration);
      return true;
    }
    if (hasUnitTag(type, UNIT_TAG.FLYING)) return this.processFlyingUnit(model, unit, type, now, duration);
    if (this.tryCombatAction(model, unit, type, now, duration)) return true;
    unit.movedThisTurn = this.movement.move(model, unit, now, duration);
    if (!unit.movedThisTurn) return false;
    if (hasUnitTag(type, UNIT_TAG.FAST_ATTACK)) {
      if (unit.breached) model.attackBase(unit, now, duration);
      else this.tryCombatAction(model, unit, type, now, duration);
    }
    return true;
  }

  processFlyingUnit(model, unit, type, now, duration) {
    unit.movedThisTurn = this.movement.move(model, unit, now, duration);
    if (unit.breached) model.attackBase(unit, now, duration);
    else this.tryCombatAction(model, unit, type, now, duration);
    return true;
  }

  canActAfterMovement(unit, type = UNIT_TYPES[unit.type]) {
    return !unit.movedThisTurn || hasUnitTag(type, UNIT_TAG.FAST_ATTACK) || hasUnitTag(type, UNIT_TAG.FLYING);
  }

  tryCombatAction(model, unit, type, now, duration) {
    if (!this.canActAfterMovement(unit, type)) return false;
    const nearby = model.spatialIndex.nearby(unit.row, unit.column, type.range);
    const enemies = nearby.filter((candidate) => candidate.alive && candidate.team !== unit.team);
    const allies = nearby.filter((candidate) => candidate.alive && candidate.team === unit.team && candidate.id !== unit.id);

    if (hasUnitTag(type, UNIT_TAG.HEAL)) {
      const target = this.targeting.nearest(
        allies.filter((ally) => ally.hp < ally.maxHp && this.targeting.isInAttackPattern(unit, ally, type)),
        unit,
      );
      if (!target) return false;
      const healed = Math.min(type.healAmount, target.maxHp - target.hp);
      target.hp += healed;
      model.emitCombatEvent({
        type: COMBAT_EVENT.UNIT_HEALED,
        source: snapshot(unit, now),
        target: snapshot(target, now),
        amount: healed,
        at: now,
      });
      return true;
    }

    if (type.attack <= 0) return false;
    const target = this.targeting.nearest(enemies.filter((enemy) => this.targeting.canTarget(unit, enemy, type)), unit);
    if (!target) return false;
    this.attackUnit(model, unit, target, enemies, now, duration);
    return true;
  }

  attackUnit(model, attacker, target, enemies, now, duration) {
    const type = UNIT_TYPES[attacker.type];
    target.hp -= type.attack;
    model.emitCombatEvent({
      type: COMBAT_EVENT.UNIT_ATTACKED,
      attacker: snapshot(attacker, now),
      target: snapshot(target, now),
      damage: type.attack,
      range: type.range,
      at: now,
    });

    if (hasUnitTag(type, UNIT_TAG.AOE)) {
      for (const enemy of enemies) {
        if (enemy.id === target.id || !enemy.alive || gridDistance(target, enemy) > 1) continue;
        const splash = Math.round(type.attack * 0.55);
        enemy.hp -= splash;
        model.emitCombatEvent({
          type: COMBAT_EVENT.SPLASH_HIT,
          source: snapshot(attacker, now),
          target: snapshot(enemy, now),
          damage: splash,
          at: now,
        });
        if (enemy.hp <= 0) model.killUnit(enemy, now, duration);
      }
    }

    if (hasUnitTag(type, UNIT_TAG.BOMB)) {
      attacker.alive = false;
      model.spatialIndex.remove(attacker);
      model.emitCombatEvent({ type: COMBAT_EVENT.UNIT_DETONATED, unit: snapshot(attacker, now), at: now });
    }

    if (target.alive && target.hp <= 0) model.killUnit(target, now, duration);
  }
}