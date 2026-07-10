import { GAME_CONFIG, TEAM, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../data/gameConfig.js';
import { ATTACK_ANIMATION, COMBAT_EVENT, DEATH_ANIMATION, EFFECT_TYPE, LOG_TYPE } from '../data/gameTypes.js';

const ATTACK_STAGGER_MS = 180;
const BATTLE_SPEED = 0.5;
const BREACH_COLLAPSE_DELAY_MS = 180;
const BREACH_WALL_STAGGER_MS = 55;
const BREACH_WAVE_STEP_MS = 85;
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const lerp = (start, end, progress) => start + (end - start) * progress;
const point = (unit) => ({ row: unit.row, column: unit.column });
const animatedPoint = (unit, at) => {
  if (unit.animationStartedAt === undefined || unit.animationDuration === undefined) return point(unit);
  const duration = Math.max(1, unit.animationDuration / BATTLE_SPEED);
  const progress = clamp01((at - unit.animationStartedAt) / duration);
  return {
    row: lerp(unit.previousRow ?? unit.row, unit.row, progress),
    column: lerp(unit.previousColumn ?? unit.column, unit.column, progress),
  };
};
const teamColor = (team) => team === TEAM.PLAYER ? '#38bdf8' : '#ff5d5d';
const targetName = (target) => target.lineObjective ? (target.team === TEAM.PLAYER ? 'your line' : 'hostile line') : `${UNIT_TYPES[target.type].name} #${target.id}`;
const attackAnimationFor = (type) => hasUnitTag(type, UNIT_TAG.FLYING) && type.animation.attack === ATTACK_ANIMATION.MELEE ? ATTACK_ANIMATION.MISSILE : type.animation.attack;

function addDeathEffect(model, unit, at, duration, actionStart) {
  const definition = UNIT_TYPES[unit.type];
  model.effects.push({ type: EFFECT_TYPE.DEATH, ...animatedPoint(unit, at), shape: definition.shape, graphic: definition.graphic, deathStyle: definition.animation.death, color: teamColor(unit.team), seed: unit.id * 2.399963229728653, actionStart, start: at, duration: Math.max(duration * 2.1, 760) });
}
function addGroundDeathExplosion(model, unit, at, duration) { model.effects.push({ type: EFFECT_TYPE.EXPLOSION, ...animatedPoint(unit, at), start: at, duration: Math.max(duration * 1.55, 560), intensity: 0.9 }); }
function addHealthLossEffect(model, target, damage, actionStart, impactStart, duration) {
  const effect = { type: EFFECT_TYPE.HEALTH_LOSS, targetId: target.id, hpBefore: Math.min(target.maxHp, target.hp + damage), hpAfter: Math.max(0, target.hp), maxHp: target.maxHp, actionStart, start: impactStart, duration: Math.max(260, duration * 0.7) };
  if (target.lineObjective) {
    const prefix = `line:${target.team}:`;
    const simultaneous = model.effects.filter((candidate) => candidate.type === EFFECT_TYPE.HEALTH_LOSS
      && String(candidate.targetId).startsWith(prefix)
      && candidate.actionStart === actionStart
      && candidate.start === impactStart);
    if (simultaneous.length > 0) {
      const hpBefore = Math.max(effect.hpBefore, ...simultaneous.map((candidate) => candidate.hpBefore));
      for (const candidate of simultaneous) {
        candidate.hpBefore = hpBefore;
        candidate.hpAfter = effect.hpAfter;
      }
      effect.hpBefore = hpBefore;
    }
  }
  model.effects.push(effect);
}
function latestHealthLoss(model, unitId) { return [...model.effects].reverse().find((effect) => effect.type === EFFECT_TYPE.HEALTH_LOSS && effect.targetId === unitId); }
function addDetonationEffects(model, unit, at, duration) { for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) { const row = unit.row + rowOffset; const column = unit.column + columnOffset; if (row < 0 || row >= GAME_CONFIG.rows || column < 0 || column >= GAME_CONFIG.columns) continue; const distance = Math.hypot(rowOffset, columnOffset); model.effects.push({ type: EFFECT_TYPE.EXPLOSION, row, column, start: at + distance * 35, duration: Math.max(duration * 1.4, 500), intensity: distance === 0 ? 1 : 0.72 }); } }
function addAttackEffect(model, attacker, target, at, duration) { const animation = attackAnimationFor(UNIT_TYPES[attacker.type]); const ranged = animation !== ATTACK_ANIMATION.MELEE; model.effects.push({ type: ranged ? EFFECT_TYPE.RANGED : EFFECT_TYPE.MELEE, attackStyle: animation, attackerId: attacker.id, targetId: target.id, team: attacker.team, from: animatedPoint(attacker, at), to: animatedPoint(target, at), start: at, duration }); return { ranged, impactAt: at + duration * (ranged ? 0.52 : 0.2) }; }
function addBreachCollapseEffects(model, result, at, duration) {
  const losingTeam = result.playerWon ? TEAM.ENEMY : TEAM.PLAYER;
  const wallColumn = losingTeam === TEAM.PLAYER ? 0 : GAME_CONFIG.columns - 1;
  const collapseAt = at + BREACH_COLLAPSE_DELAY_MS;
  for (let row = 0; row < GAME_CONFIG.rows; row += 1) {
    model.effects.push({
      type: EFFECT_TYPE.EXPLOSION,
      row,
      column: wallColumn,
      start: collapseAt + row * BREACH_WALL_STAGGER_MS,
      duration: Math.max(620, duration * 1.7),
      intensity: 1,
    });
  }
  const units = model.units.filter((unit) => unit.alive);
  for (const unit of units) {
    const distance = losingTeam === TEAM.PLAYER ? unit.column : GAME_CONFIG.columns - 1 - unit.column;
    const deathAt = collapseAt + 260 + distance * BREACH_WAVE_STEP_MS;
    model.effects.push({
      type: EFFECT_TYPE.HEALTH_LOSS,
      targetId: unit.id,
      hpBefore: unit.hp,
      hpAfter: 0,
      maxHp: unit.maxHp,
      actionStart: collapseAt,
      start: deathAt,
      duration: 1,
    });
    addDeathEffect(model, unit, deathAt, duration, collapseAt);
    unit.alive = false;
    unit.hp = 0;
  }
}

export class CombatEventPresenter {
  constructor() { this.sequenceTickAt = null; this.sequenceIndex = -1; this.currentActionAt = 0; }
  actionTime(event) { const at = event.at ?? 0; if (this.sequenceTickAt !== at) { this.sequenceTickAt = at; this.sequenceIndex = -1; this.currentActionAt = at; } const isAttack = event.type === COMBAT_EVENT.UNIT_ATTACKED || event.type === COMBAT_EVENT.UNIT_DODGED; const attacker = event.attacker ?? event.source; const isMelee = isAttack && attackAnimationFor(UNIT_TYPES[attacker.type]) === ATTACK_ANIMATION.MELEE; if (isMelee) return at; if (isAttack || event.type === COMBAT_EVENT.UNIT_HEALED) { this.sequenceIndex += 1; this.currentActionAt = at + this.sequenceIndex * ATTACK_STAGGER_MS; } return this.currentActionAt; }
  present(model, event) {
    const duration = Math.max(110, Math.min(480, GAME_CONFIG.tickIntervalMs * 0.85)); const at = this.actionTime(event);
    switch (event.type) {
      case COMBAT_EVENT.BATTLE_STARTED: model.addLog(`${event.label} begins. Your force: ${event.playerCount} units. Hostile force: ${event.enemyCount} units.`, LOG_TYPE.SYSTEM); break;
      case COMBAT_EVENT.UNIT_HEALED: model.effects.push({ type: EFFECT_TYPE.HEAL, from: point(event.source), to: point(event.target), start: at, duration }, { type: EFFECT_TYPE.TEXT, ...point(event.target), text: `+${event.amount}`, color: '#4ade80', start: at, duration: duration * 1.3 }); model.addLog(`${UNIT_TYPES[event.source.type].name} #${event.source.id} restores ${event.amount} HP to ${UNIT_TYPES[event.target.type].name} #${event.target.id}.`, LOG_TYPE.HIT); break;
      case COMBAT_EVENT.UNIT_ATTACKED: { const { impactAt } = addAttackEffect(model, event.attacker, event.target, at, duration); model.effects.push({ type: EFFECT_TYPE.TEXT, ...animatedPoint(event.target, impactAt), text: `-${event.damage}`, color: '#ff5d5d', actionStart: at, start: impactAt, duration: duration * 1.3 }); addHealthLossEffect(model, event.target, event.damage, at, impactAt, duration); model.addLog(`${UNIT_TYPES[event.attacker.type].name} #${event.attacker.id} hits ${targetName(event.target)} for ${event.damage}.`, event.target.lineObjective ? (event.attacker.team === TEAM.PLAYER ? LOG_TYPE.KILL : LOG_TYPE.PLAYER_LOSS) : LOG_TYPE.HIT); break; }
      case COMBAT_EVENT.UNIT_DODGED: addAttackEffect(model, event.attacker, event.target, at, duration); model.effects.push({ type: EFFECT_TYPE.TEXT, ...point(event.unit), text: 'DODGE', color: '#f8fafc', start: at, duration: duration * 1.3 }); model.addLog(`${UNIT_TYPES[event.unit.type].name} #${event.unit.id} dodges ${UNIT_TYPES[event.attacker.type].name} #${event.attacker.id}'s attack.`, LOG_TYPE.HIT); break;
      case COMBAT_EVENT.UNIT_PUSHED: model.addLog(`${UNIT_TYPES[event.source.type].name} #${event.source.id} pushes ${UNIT_TYPES[event.unit.type].name} #${event.unit.id} backward.`, LOG_TYPE.HIT); break;
      case COMBAT_EVENT.SPLASH_HIT: { const impactAt = at + duration * 0.2; model.effects.push({ type: EFFECT_TYPE.TEXT, ...animatedPoint(event.target, impactAt), text: `-${event.damage}`, color: '#ff5d5d', actionStart: at, start: impactAt, duration: duration * 1.3 }); addHealthLossEffect(model, event.target, event.damage, at, impactAt, duration); model.addLog(`Splash blast hits ${targetName(event.target)} for ${event.damage}.`, event.target.lineObjective ? (event.source.team === TEAM.PLAYER ? LOG_TYPE.KILL : LOG_TYPE.PLAYER_LOSS) : LOG_TYPE.HIT); break; }
      case COMBAT_EVENT.UNIT_DETONATED: addDetonationEffects(model, event.unit, at, duration); addDeathEffect(model, event.unit, at, duration); model.addLog(`${UNIT_TYPES[event.unit.type].name} #${event.unit.id} detonates and is destroyed.`, event.unit.team === TEAM.PLAYER ? LOG_TYPE.PLAYER_LOSS : LOG_TYPE.KILL); break;
      case COMBAT_EVENT.UNIT_BREACHED: model.effects.push({ type: EFFECT_TYPE.TEXT, ...point(event.unit), text: 'BREACH!', color: '#fbbf24', start: at, duration: Math.max(duration * 1.6, 400) }); model.addLog(`${UNIT_TYPES[event.unit.type].name} #${event.unit.id} breaks through the line!`, LOG_TYPE.SYSTEM); break;
      case COMBAT_EVENT.BASE_ATTACKED: model.effects.push({ type: EFFECT_TYPE.TEXT, ...point(event.unit), text: `-${event.damage}`, color: '#fbbf24', start: at, duration: duration * 1.2 }); model.addLog(`${UNIT_TYPES[event.unit.type].name} #${event.unit.id} strikes the line for ${event.damage}.`, event.unit.team === TEAM.PLAYER ? LOG_TYPE.KILL : LOG_TYPE.PLAYER_LOSS); break;
      case COMBAT_EVENT.UNIT_DESTROYED: { const definition = UNIT_TYPES[event.unit.type]; const healthLoss = latestHealthLoss(model, event.unit.id); const effectAt = healthLoss?.start ?? at; if (definition.animation.death === DEATH_ANIMATION.EXPLODE) { addGroundDeathExplosion(model, event.unit, effectAt, duration); addDeathEffect(model, event.unit, effectAt, duration, healthLoss?.actionStart); } else addDeathEffect(model, event.unit, effectAt, duration, healthLoss?.actionStart); if (!event.silent) model.addLog(`${definition.name} #${event.unit.id} destroyed.`, event.unit.team === TEAM.PLAYER ? LOG_TYPE.PLAYER_LOSS : LOG_TYPE.KILL); break; }
      case COMBAT_EVENT.BATTLE_FINISHED: addBreachCollapseEffects(model, event.result, at, duration); model.addLog(event.result.text, LOG_TYPE.SYSTEM); break;
      default: throw new Error(`Unsupported combat event: ${event.type}`);
    }
  }
}
