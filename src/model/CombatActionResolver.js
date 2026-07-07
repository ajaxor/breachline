import { AURA_EFFECT, GAME_CONFIG, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../data/gameConfig.js';
import { COMBAT_EVENT } from '../data/gameTypes.js';
import { MovementPolicy } from './MovementPolicy.js';
import { TargetingPolicy, gridDistance } from './TargetingPolicy.js';

const STUN_TURNS = 2;
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const lerp = (start, end, progress) => start + (end - start) * progress;
const resolvedSnapshot = (unit) => ({
  id: unit.id,
  team: unit.team,
  type: unit.type,
  row: unit.row,
  column: unit.column,
  previousRow: unit.previousRow,
  previousColumn: unit.previousColumn,
  animationStartedAt: unit.animationStartedAt,
  animationDuration: unit.animationDuration,
  hp: unit.hp,
  maxHp: unit.maxHp,
});
const animatedSnapshot = (unit, at) => {
  const duration = Math.max(1, unit.animationDuration ?? 1);
  const progress = unit.animationStartedAt === undefined ? 1 : clamp01((at - unit.animationStartedAt) / duration);
  return { id: unit.id, team: unit.team, type: unit.type, row: lerp(unit.previousRow ?? unit.row, unit.row, progress), column: lerp(unit.previousColumn ?? unit.column, unit.column, progress) };
};

export class CombatActionResolver {
  constructor({ targeting = new TargetingPolicy(), movement = new MovementPolicy() } = {}) {
    this.targeting = targeting;
    this.movement = movement;
    this.targetPlan = null;
  }

  auraValue(model, unit, effect, sourceTeam = unit.team) {
    let strongest = 0;
    for (const source of model.units) {
      if (!source.alive || source.breached || source.team !== sourceTeam) continue;
      const aura = UNIT_TYPES[source.type].aura;
      if (!aura || aura.effect !== effect || gridDistance(source, unit) > aura.range) continue;
      strongest = Math.max(strongest, aura.value ?? 0);
    }
    return strongest;
  }

  applyStunFields(model) {
    for (const source of model.units) {
      if (!source.alive || source.breached) continue;
      const aura = UNIT_TYPES[source.type].aura;
      if (!aura || aura.effect !== AURA_EFFECT.STUN) continue;
      for (const target of model.units) {
        if (!target.alive || target.team === source.team || target.row !== source.row) continue;
        target.stunTurnsRemaining = Math.max(target.stunTurnsRemaining ?? 0, STUN_TURNS);
      }
    }
  }

  ageStuns(model) {
    for (const unit of model.units) {
      if ((unit.stunTurnsRemaining ?? 0) > 0) unit.stunTurnsRemaining -= 1;
    }
  }

  isStunned(unit) {
    return (unit.stunTurnsRemaining ?? 0) > 0;
  }

  attackDamage(model, attacker) {
    return UNIT_TYPES[attacker.type].attack + this.auraValue(model, attacker, AURA_EFFECT.DAMAGE);
  }

  incomingDamage(model, target, damage) {
    return Math.max(1, damage - this.auraValue(model, target, AURA_EFFECT.SHIELD));
  }

  buildTargetPlan(model, units) {
    const plan = new Map();
    for (const unit of units) {
      if (!unit.alive || unit.breached || this.isStunned(unit)) { plan.set(unit.id, null); continue; }
      const type = UNIT_TYPES[unit.type];
      const nearby = model.spatialIndex.nearby(unit.row, unit.column, type.range);
      if (hasUnitTag(type, UNIT_TAG.HEAL)) {
        const allies = nearby.filter((candidate) => candidate.alive && candidate.team === unit.team && candidate.id !== unit.id && candidate.hp < candidate.maxHp && this.targeting.isInAttackPattern(unit, candidate, type));
        plan.set(unit.id, this.targeting.nearest(allies, unit)?.id ?? null);
        continue;
      }
      if (type.attack <= 0) { plan.set(unit.id, null); continue; }
      const enemies = nearby.filter((candidate) => candidate.alive && candidate.team !== unit.team && this.targeting.canTarget(unit, candidate, type));
      plan.set(unit.id, this.targeting.nearest(enemies, unit)?.id ?? null);
    }
    return plan;
  }

  processQueue(model, units, now, duration) {
    const queue = units.slice();
    let consecutivePasses = 0;
    this.applyStunFields(model);
    this.targetPlan = model.spatialIndex ? this.buildTargetPlan(model, units) : null;
    try {
      while (queue.length > 0 && consecutivePasses < queue.length) {
        const unit = queue.shift();
        if (!unit.alive) continue;
        if (this.processUnit(model, unit, now, duration)) consecutivePasses = 0;
        else { queue.push(unit); consecutivePasses += 1; }
      }
    } finally {
      this.targetPlan = null;
      this.ageStuns(model);
    }
  }

  processUnit(model, unit, now, duration) {
    if (!unit.alive) return true;
    unit.stunnedThisTick = this.isStunned(unit);
    if (unit.stunnedThisTick) return true;
    const type = UNIT_TYPES[unit.type];
    if (unit.breached) { model.attackBase(unit, now, duration); return true; }
    if (hasUnitTag(type, UNIT_TAG.FLYING)) return this.processFlyingUnit(model, unit, type, now, duration);
    if (this.tryCombatAction(model, unit, type, now, duration)) return true;
    if (this.shouldPassForIncomingTarget(model, unit, type)) return true;
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

  plannedTarget(model, unit) {
    if (!this.targetPlan?.has(unit.id)) return undefined;
    const targetId = this.targetPlan.get(unit.id);
    if (targetId === null) return null;
    return model.units.find((candidate) => candidate.id === targetId && candidate.alive) ?? null;
  }

  shouldPassForIncomingTarget(model, unit, type) {
    if (type.range <= 1 || !this.targetPlan?.has(unit.id) || this.targetPlan.get(unit.id) !== null) return false;
    return model.units.some((enemy) => {
      if (!enemy.alive || enemy.team === unit.team || enemy.breached || enemy.previousRow === undefined || enemy.previousColumn === undefined) return false;
      if (enemy.row === enemy.previousRow && enemy.column === enemy.previousColumn) return false;
      if (!this.targeting.canTarget(unit, enemy, type)) return false;
      const previousPosition = { ...enemy, row: enemy.previousRow, column: enemy.previousColumn };
      return !this.targeting.canTarget(unit, previousPosition, type);
    });
  }

  tryCombatAction(model, unit, type, now, duration) {
    if (!this.canActAfterMovement(unit, type)) return false;
    const plannedTarget = this.plannedTarget(model, unit);
    const hasPlan = plannedTarget !== undefined;
    if (hasUnitTag(type, UNIT_TAG.HEAL)) {
      const target = hasPlan ? plannedTarget : this.targeting.nearest(model.spatialIndex.nearby(unit.row, unit.column, type.range).filter((ally) => ally.alive && ally.team === unit.team && ally.id !== unit.id && ally.hp < ally.maxHp && this.targeting.isInAttackPattern(unit, ally, type)), unit);
      if (!target || target.hp >= target.maxHp) return false;
      const healed = Math.min(type.healAmount, target.maxHp - target.hp);
      target.hp += healed;
      model.emitCombatEvent({ type: COMBAT_EVENT.UNIT_HEALED, source: resolvedSnapshot(unit), target: resolvedSnapshot(target), amount: healed, at: now });
      return true;
    }
    if (type.attack <= 0) return false;
    const target = hasPlan ? plannedTarget : this.targeting.nearest(model.spatialIndex.nearby(unit.row, unit.column, type.range).filter((enemy) => enemy.alive && enemy.team !== unit.team && this.targeting.canTarget(unit, enemy, type)), unit);
    if (!target) return false;
    if (hasUnitTag(type, UNIT_TAG.BOMB)) this.detonate(model, unit, now, duration);
    else this.attackUnit(model, unit, target, now, duration);
    return true;
  }

  tryAgileDodge(model, attacker, target, now, duration) {
    if (!hasUnitTag(target.type, UNIT_TAG.AGILE) || target.agileDodgeUsed) return false;
    target.agileDodgeUsed = true;
    const openRows = [target.row - 1, target.row + 1].filter((row) => row >= 0 && row < GAME_CONFIG.rows && !model.occupantAt(row, target.column));
    if (openRows.length === 0) return false;
    const previousRow = target.row;
    const previousColumn = target.column;
    target.row = openRows[Math.floor(model.random() * openRows.length)];
    target.previousRow = previousRow;
    target.previousColumn = previousColumn;
    target.animationStartedAt = now;
    target.animationDuration = duration;
    model.spatialIndex.move(target, previousRow, previousColumn);
    model.emitCombatEvent({
      type: COMBAT_EVENT.UNIT_DODGED,
      attacker: resolvedSnapshot(attacker),
      target: { ...resolvedSnapshot(target), row: previousRow, column: previousColumn },
      unit: resolvedSnapshot(target),
      at: now,
    });
    return true;
  }

  destroyUnit(model, unit, now, duration) {
    if (!unit.alive) return;
    if (hasUnitTag(unit.type, UNIT_TAG.BOMB)) this.detonate(model, unit, now, duration);
    else model.killUnit(unit, now, duration);
  }

  detonate(model, attacker, now, duration) {
    if (!attacker.alive) return;
    const source = animatedSnapshot(attacker, now);
    const rawDamage = this.attackDamage(model, attacker);
    const victims = model.units.filter((unit) => unit.alive && unit.team !== attacker.team && gridDistance(attacker, unit) <= 1);
    attacker.alive = false;
    model.spatialIndex.remove(attacker);
    model.emitCombatEvent({ type: COMBAT_EVENT.UNIT_DETONATED, unit: source, at: now });
    for (const victim of victims) {
      if (!victim.alive) continue;
      const damage = this.incomingDamage(model, victim, rawDamage);
      victim.hp -= damage;
      model.emitCombatEvent({ type: COMBAT_EVENT.SPLASH_HIT, source, target: resolvedSnapshot(victim), damage, at: now });
      if (victim.hp <= 0) this.destroyUnit(model, victim, now, duration);
    }
  }

  attackUnit(model, attacker, target, enemiesOrNow, nowOrDuration, legacyDuration) {
    const legacyCall = Array.isArray(enemiesOrNow);
    const now = legacyCall ? nowOrDuration : enemiesOrNow;
    const duration = legacyCall ? legacyDuration : nowOrDuration;
    if (this.tryAgileDodge(model, attacker, target, now, duration)) return;
    const rawDamage = this.attackDamage(model, attacker);
    const damage = this.incomingDamage(model, target, rawDamage);
    target.hp -= damage;
    model.emitCombatEvent({ type: COMBAT_EVENT.UNIT_ATTACKED, attacker: resolvedSnapshot(attacker), target: resolvedSnapshot(target), damage, range: UNIT_TYPES[attacker.type].range, at: now });
    if (hasUnitTag(attacker.type, UNIT_TAG.AOE)) {
      const enemies = model.units.filter((enemy) => enemy.alive && enemy.team !== attacker.team);
      for (const enemy of enemies) {
        if (enemy.id === target.id || gridDistance(target, enemy) > 1) continue;
        const splashDamage = this.incomingDamage(model, enemy, rawDamage);
        enemy.hp -= splashDamage;
        model.emitCombatEvent({ type: COMBAT_EVENT.SPLASH_HIT, source: resolvedSnapshot(attacker), target: resolvedSnapshot(enemy), damage: splashDamage, at: now });
        if (enemy.hp <= 0) this.destroyUnit(model, enemy, now, duration);
      }
    }
    if (target.alive && target.hp <= 0) this.destroyUnit(model, target, now, duration);
  }
}