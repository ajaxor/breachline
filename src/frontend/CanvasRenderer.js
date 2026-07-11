import { GAME_CONFIG, MODE, TEAM, UNIT_TYPES } from '../data/gameConfig.js';
import { ATTACK_ANIMATION, EFFECT_TYPE } from '../data/gameTypes.js';
import { drawUnitGraphic } from './UnitGraphics.js';

const lerp = (start, end, progress) => start + (end - start) * progress;
const clamp01 = (value) => Math.max(0, Math.min(1, value));

export class CanvasRenderer {
  constructor(canvas, container, now = () => performance.now()) {
    this.canvas = canvas;
    this.container = container;
    this.context = canvas.getContext('2d');
    this.cellSize = 40;
    this.now = now;
  }

  resize(model) {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width <= 0 || height <= 0) return;
    this.cellSize = Math.max(16, Math.floor(Math.min(width / GAME_CONFIG.columns, height / GAME_CONFIG.rows)));
    this.canvas.width = GAME_CONFIG.columns * this.cellSize;
    this.canvas.height = GAME_CONFIG.rows * this.cellSize;
    this.render(model);
  }

  cellFromPointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    const column = Math.floor(((event.clientX - rect.left) * this.canvas.width / rect.width) / this.cellSize);
    const row = Math.floor(((event.clientY - rect.top) * this.canvas.height / rect.height) / this.cellSize);
    return row >= 0 && row < GAME_CONFIG.rows && column >= 0 && column < GAME_CONFIG.columns ? { row, column } : null;
  }

  render(model) {
    this.drawGrid();
    if (model.mode === MODE.DEPLOY) {
      model.placement.forEach((unit) => this.drawUnit({ ...unit, team: TEAM.PLAYER, hp: 1, maxHp: 1 }, true));
      model.mission.enemyFormation.forEach((unit) => this.drawUnit({ ...unit, team: TEAM.ENEMY, hp: 1, maxHp: 1 }, true));
      return;
    }

    const now = this.now();
    const activeEffects = model.effects.filter((effect) => now >= effect.start && now - effect.start < effect.duration);
    const attacksByUnit = new Map();
    const healthEffectsByUnit = new Map();
    for (const effect of model.effects) {
      if (effect.type === EFFECT_TYPE.HEALTH_LOSS && now - effect.start < effect.duration) {
        const effects = healthEffectsByUnit.get(effect.targetId) ?? [];
        effects.push(effect);
        healthEffectsByUnit.set(effect.targetId, effects);
      }
    }
    for (const effect of activeEffects) {
      if (effect.attackerId !== undefined && (effect.type === EFFECT_TYPE.MELEE || effect.type === EFFECT_TYPE.RANGED)) {
        attacksByUnit.set(effect.attackerId, effect);
      }
    }
    model.units
      .filter((unit) => unit.alive || (healthEffectsByUnit.get(unit.id) ?? []).some((effect) => now < effect.start))
      .forEach((unit) => this.drawAnimatedUnit(unit, attacksByUnit.get(unit.id), healthEffectsByUnit.get(unit.id) ?? [], now));
    activeEffects.filter((effect) => effect.type !== EFFECT_TYPE.HEALTH_LOSS).forEach((effect) => this.drawEffect(effect, now));
  }

  drawAnimatedUnit(unit, attack, healthEffects, now) {
    const moveProgress = unit.animationStartedAt === undefined ? 1 : clamp01((now - unit.animationStartedAt) / Math.max(1, unit.animationDuration));
    let row = lerp(unit.previousRow ?? unit.row, unit.row, moveProgress);
    let column = lerp(unit.previousColumn ?? unit.column, unit.column, moveProgress);
    if (attack) {
      const progress = clamp01((now - attack.start) / attack.duration);
      const lunge = Math.sin(progress * Math.PI) * (attack.type === EFFECT_TYPE.MELEE ? 0.32 : 0.08);
      const rowDelta = attack.to.row - attack.from.row;
      const columnDelta = attack.to.column - attack.from.column;
      const length = Math.max(1, Math.hypot(rowDelta, columnDelta));
      row += rowDelta / length * lunge;
      column += columnDelta / length * lunge;
    }
    this.drawUnit(unit, false, row, column, healthEffects, now);
    if (unit.breached) this.drawBreachMarker(row, column);
  }

  drawGrid() {
    const ctx = this.context;
    const cell = this.cellSize;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawDeploymentZone(GAME_CONFIG.playerZone, 'rgba(56,189,248,.06)');
    this.drawDeploymentZone(GAME_CONFIG.enemyZone, 'rgba(255,93,93,.06)');
    ctx.strokeStyle = '#16202a';
    ctx.lineWidth = 1;
    for (let column = 0; column <= GAME_CONFIG.columns; column += 1) this.line(column * cell + 0.5, 0, column * cell + 0.5, GAME_CONFIG.rows * cell);
    for (let row = 0; row <= GAME_CONFIG.rows; row += 1) this.line(0, row * cell + 0.5, GAME_CONFIG.columns * cell, row * cell + 0.5);
    ctx.save();
    ctx.strokeStyle = '#2a3846';
    ctx.setLineDash([4, 4]);
    this.line(this.canvas.width / 2, 0, this.canvas.width / 2, this.canvas.height);
    ctx.restore();
  }

  drawDeploymentZone(columns, color) {
    this.context.fillStyle = color;
    columns.forEach((column) => this.context.fillRect(column * this.cellSize, 0, this.cellSize, GAME_CONFIG.rows * this.cellSize));
  }

  drawUnit(unit, ghost, row = unit.row, column = unit.column, healthEffects = [], now = this.now()) {
    const type = UNIT_TYPES[unit.type];
    const color = unit.team === TEAM.PLAYER ? '#38bdf8' : '#ff5d5d';
    const x = column * this.cellSize + this.cellSize / 2;
    const y = row * this.cellSize + this.cellSize / 2;
    this.context.save();
    this.context.translate(x, y);
    this.prepareUnitContext(unit, ghost);
    this.context.globalAlpha = (unit.stealthed ? 0.28 : 1) * (ghost ? 0.55 : 1);
    drawUnitGraphic(this.context, type.graphic ?? type.shape, 0, 0, this.cellSize * 0.32, color);
    const displayedHp = this.displayedHealth(unit, healthEffects, now);
    if (this.shouldDrawHealthBar(unit, ghost, displayedHp)) this.drawHealthBar(unit, displayedHp);
    this.context.restore();
  }

  prepareUnitContext() {}

  shouldDrawHealthBar(unit, ghost, displayedHp) {
    return !ghost && displayedHp > 0 && displayedHp < unit.maxHp;
  }

  displayedHealth(unit, healthEffects = [], now = this.now()) {
    const sortedEffects = healthEffects.slice().sort((a, b) => a.start - b.start);
    const activeEffect = sortedEffects.find((effect) => now >= effect.start && now - effect.start < effect.duration);
    if (activeEffect) {
      const progress = clamp01((now - activeEffect.start) / activeEffect.duration);
      return lerp(activeEffect.hpBefore, activeEffect.hpAfter, progress);
    }
    const nextEffect = sortedEffects.find((effect) => now < effect.start);
    return nextEffect ? nextEffect.hpBefore : unit.hp;
  }

  drawHealthBar(unit, displayedHp) {
    const width = this.cellSize * 0.7;
    const y = -this.cellSize / 2 + 5;
    const health = clamp01(displayedHp / unit.maxHp);
    this.context.fillStyle = '#0d141b';
    this.context.fillRect(-width / 2, y, width, 4);
    this.context.fillStyle = health > 0.5 ? '#4ade80' : health > 0.2 ? '#fbbf24' : '#ff5d5d';
    this.context.fillRect(-width / 2, y, width * health, 4);
  }

  drawEffect(effect, now) {
    const progress = clamp01((now - effect.start) / effect.duration);
    const color = effect.team === TEAM.PLAYER ? '#38bdf8' : effect.team === TEAM.ENEMY ? '#ff5d5d' : '#fbbf24';
    switch (effect.type) {
      case EFFECT_TYPE.RANGED: this.drawProjectile(effect, progress, color); break;
      case EFFECT_TYPE.MELEE: this.drawImpact(this.x(effect.to.column), this.y(effect.to.row), progress, color); break;
      case EFFECT_TYPE.HEAL: this.drawHeal(effect, progress); break;
      case EFFECT_TYPE.EXPLOSION: this.drawExplosion(effect, progress); break;
      case EFFECT_TYPE.DEATH: this.drawDeath(effect, progress); break;
      case EFFECT_TYPE.TEXT: this.drawText(effect, progress); break;
      default: throw new Error(`Unsupported effect type: ${effect.type}`);
    }
  }

  drawProjectile(effect, progress, color) {
    if (effect.attackStyle === ATTACK_ANIMATION.LIGHTNING) {
      this.drawLightning(effect, progress, color);
      return;
    }
    const fromX = this.x(effect.from.column), fromY = this.y(effect.from.row);
    const toX = this.x(effect.to.column), toY = this.y(effect.to.row);
    const travel = Math.min(1, progress / 0.55);
    const ctx = this.context;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(lerp(fromX, toX, travel), lerp(fromY, toY, travel));
    ctx.stroke();
    ctx.restore();
    if (progress > 0.5) this.drawImpact(toX, toY, (progress - 0.5) / 0.5, color);
  }

  drawLightning(effect, progress, color) {
    const fromX = this.x(effect.from.column), fromY = this.y(effect.from.row);
    const toX = this.x(effect.to.column), toY = this.y(effect.to.row);
    const ctx = this.context;
    const fade = 1 - progress;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const length = Math.max(1, Math.hypot(dx, dy));
    const normalX = -dy / length;
    const normalY = dx / length;
    const seed = (effect.attackerId ?? 0) * 17 + (effect.targetId ?? 0) * 31;
    ctx.save();
    ctx.globalAlpha = Math.min(1, fade * 1.8);
    ctx.strokeStyle = '#f8fafc';
    ctx.shadowColor = color;
    ctx.shadowBlur = this.cellSize * 0.22;
    ctx.lineWidth = Math.max(1.5, this.cellSize * 0.045 * (0.7 + fade * 0.5));
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    const segments = 8;
    for (let index = 1; index < segments; index += 1) {
      const t = index / segments;
      const envelope = Math.sin(t * Math.PI);
      const jitter = Math.sin(seed + index * 12.9898 + Math.floor(progress * 9) * 4.1414) * this.cellSize * 0.18 * envelope;
      ctx.lineTo(lerp(fromX, toX, t) + normalX * jitter, lerp(fromY, toY, t) + normalY * jitter);
    }
    ctx.lineTo(toX, toY);
    ctx.stroke();
    ctx.globalAlpha *= 0.55;
    ctx.lineWidth = Math.max(1, this.cellSize * 0.022);
    for (const branch of [0.32, 0.58]) {
      const baseX = lerp(fromX, toX, branch);
      const baseY = lerp(fromY, toY, branch);
      const direction = Math.sin(seed + branch * 19) >= 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(baseX + normalX * direction * this.cellSize * 0.24 + dx / length * this.cellSize * 0.08, baseY + normalY * direction * this.cellSize * 0.24 + dy / length * this.cellSize * 0.08);
      ctx.stroke();
    }
    ctx.restore();
    this.drawImpact(toX, toY, clamp01(progress * 1.7), color);
  }

  drawHeal(effect, progress) {
    const ctx = this.context;
    const fromX = this.x(effect.from.column), fromY = this.y(effect.from.row);
    const toX = this.x(effect.to.column), toY = this.y(effect.to.row);
    ctx.save();
    ctx.globalAlpha = (1 - progress) * 0.8;
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    this.line(fromX, fromY, toX, toY);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1 - progress;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(toX, toY, this.cellSize * (0.18 + progress * 0.28), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawExplosion(effect, progress) {
    const ctx = this.context;
    const x = this.x(effect.column), y = this.y(effect.row);
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, this.cellSize * (0.15 + progress * 0.85), 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ff5d5d';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = (1 - progress) * 0.7;
    ctx.beginPath();
    ctx.arc(x, y, this.cellSize * (0.1 + progress * 0.55), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawDeath(effect, progress) {
    const ctx = this.context;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    if (effect.graphic) drawUnitGraphic(ctx, effect.graphic, this.x(effect.column), this.y(effect.row), this.cellSize * 0.32 * (1 - 0.35 * progress), effect.color);
    else this.drawShape(effect.shape, this.x(effect.column), this.y(effect.row), this.cellSize * 0.32 * (1 - 0.35 * progress), effect.color);
    ctx.restore();
  }

  drawText(effect, progress) {
    const ctx = this.context;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = effect.color;
    ctx.textAlign = 'center';
    ctx.font = '700 12px "Space Mono", monospace';
    ctx.fillText(effect.text, this.x(effect.column), this.y(effect.row) - 6 - progress * 16);
    ctx.restore();
  }

  drawImpact(x, y, progress, color) {
    const ctx = this.context;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, this.cellSize * (0.12 + progress * 0.28), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawBreachMarker(row, column) {
    const ctx = this.context;
    ctx.save();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(this.x(column), this.y(row), this.cellSize * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawShape(shape, x, y, radius, color) {
    const ctx = this.context;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.save();
    ctx.globalAlpha *= 0.2;
    ctx.beginPath();
    this.shapePath(ctx, shape, radius);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    this.shapePath(ctx, shape, radius);
    ctx.stroke();
    ctx.restore();
  }

  shapePath(ctx, shape, radius) {
    if (shape === 'square') ctx.rect(-radius, -radius, radius * 2, radius * 2);
    else if (shape === 'triangle') this.polygon(ctx, radius, 3, -Math.PI / 2);
    else if (shape === 'diamond' || shape === 'kite') this.polygon(ctx, radius * 1.2, 4, -Math.PI / 2);
    else if (shape === 'hex') this.polygon(ctx, radius, 6, Math.PI / 6);
    else if (shape === 'octagon') this.polygon(ctx, radius, 8, Math.PI / 8);
    else if (shape === 'star' || shape === 'burst') this.star(ctx, radius, shape === 'burst' ? 8 : 5);
    else if (shape === 'chevron') { ctx.moveTo(-radius, -radius); ctx.lineTo(0, 0); ctx.lineTo(-radius, radius); ctx.moveTo(0, -radius); ctx.lineTo(radius, 0); ctx.lineTo(0, radius); }
    else if (shape === 'wing') { ctx.moveTo(-radius, 0); ctx.quadraticCurveTo(0, -radius, radius, 0); ctx.quadraticCurveTo(0, radius * 0.45, -radius, 0); ctx.closePath(); }
    else ctx.arc(0, 0, radius, 0, Math.PI * 2);
  }

  polygon(ctx, radius, sides, offset = 0) {
    for (let i = 0; i < sides; i += 1) {
      const angle = offset + i * Math.PI * 2 / sides;
      const px = radius * Math.cos(angle), py = radius * Math.sin(angle);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  star(ctx, radius, points) {
    for (let i = 0; i < points * 2; i += 1) {
      const angle = -Math.PI / 2 + i * Math.PI / points;
      const r = i % 2 ? radius * 0.45 : radius;
      const px = r * Math.cos(angle), py = r * Math.sin(angle);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  x(column) { return column * this.cellSize + this.cellSize / 2; }
  y(row) { return row * this.cellSize + this.cellSize / 2; }
  line(x1, y1, x2, y2) { const ctx = this.context; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
}
