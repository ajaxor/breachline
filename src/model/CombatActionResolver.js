import { TEAM, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../data/gameConfig.js';
import { ATTACK_EFFECT, EFFECT_TYPE, LOG_TYPE, UNIT_ACTION } from '../data/gameTypes.js';
import { MovementPolicy } from './MovementPolicy.js';
import { TargetingPolicy, gridDistance } from './TargetingPolicy.js';

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

    if (type.action === UNIT_ACTION.HEAL) {
      const target = this.targeting.nearest(
        allies.filter((ally) => ally.hp < ally.maxHp && this.targeting.isInAttackPattern(unit, ally, type)),
        unit,
      );
      if (!target) return false;
      const healed = Math.min(type.healAmount, target.maxHp - target.hp);
      target.hp += healed;
      model.effects.push(
        { type: EFFECT_TYPE.HEAL, from: model.point(unit), to: model.point(target), start: now, duration },
        { type: EFFECT_TYPE.TEXT, ...model.point(target), text: `+${healed}`, color: '#4ade80', start: now, duration: duration * 1.3 },
      );
      model.addLog(`${type.name} #${unit.id} restores ${healed} HP to ${UNIT_TYPES[target.type].name} #${target.id}.`, LOG_TYPE.HIT);
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
    model.effects.push({ type: type.range > 1 ? EFFECT_TYPE.RANGED : EFFECT_TYPE.MELEE, attackerId: attacker.id, team: attacker.team, from: model.point(attacker), to: model.point(target), start: now, duration });
    target.hp -= type.attack;
    model.effects.push({ type: EFFECT_TYPE.TEXT, ...model.point(target), text: `-${type.attack}`, color: '#ff5d5d', start: now, duration: duration * 1.3 });
    model.addLog(`${type.name} #${attacker.id} hits ${UNIT_TYPES[target.type].name} #${target.id} for ${type.attack}.`, LOG_TYPE.HIT);

    if (type.onAttack === ATTACK_EFFECT.DETONATE) {
      model.effects.push({ type: EFFECT_TYPE.EXPLOSION, ...model.point(attacker), start: now, duration: Math.max(duration, 320) });
      for (const enemy of enemies) {
        if (enemy.id === target.id || !enemy.alive || gridDistance(attacker, enemy) > 1) continue;
        const splash = Math.round(type.attack * 0.55);
        enemy.hp -= splash;
        model.effects.push({ type: EFFECT_TYPE.TEXT, ...model.point(enemy), text: `-${splash}`, color: '#ff5d5d', start: now, duration: duration * 1.3 });
        model.addLog(`Splash blast hits ${UNIT_TYPES[enemy.type].name} #${enemy.id} for ${splash}.`, LOG_TYPE.HIT);
        if (enemy.hp <= 0) model.killUnit(enemy, now, duration);
      }
      attacker.alive = false;
      model.spatialIndex.remove(attacker);
      model.addDeathEffect(attacker, now, duration);
      model.addLog(`${type.name} #${attacker.id} detonates and is destroyed.`, attacker.team === TEAM.PLAYER ? LOG_TYPE.PLAYER_LOSS : LOG_TYPE.KILL);
    }

    if (target.alive && target.hp <= 0) model.killUnit(target, now, duration);
  }
}
