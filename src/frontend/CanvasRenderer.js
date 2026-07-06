import { GAME_CONFIG, MODE, TEAM, UNIT_TYPES } from '../data/gameConfig.js';

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
    const activeEffects = model.effects.filter((effect) => now - effect.start < effect.duration);
    model.units.filter((unit) => unit.alive).forEach((unit) => this.drawAnimatedUnit(unit, activeEffects, now));
    activeEffects.forEach((effect) => this.drawEffect(effect, now));
  }

  drawAnimatedUnit(unit, effects, now) {
    const moveProgress = unit.animationStartedAt === undefined ? 1 : clamp01((now - unit.animationStartedAt) / Math.max(1, unit.animationDuration));
    let row = lerp(unit.previousRow ?? unit.row, unit.row, moveProgress);
    let column = lerp(unit.previousColumn ?? unit.column, unit.column, moveProgress);
    const attack = effects.find((effect) => effect.attackerId === unit.id && (effect.type === 'melee' || effect.type === 'ranged'));
    if (attack) {
      const progress = clamp01((now - attack.start) / attack.duration);
      const lunge = Math.sin(progress * Math.PI) * (attack.type === 'melee' ? 0.32 : 0.08);
      const rowDelta = attack.to.row - attack.from.row;
      const columnDelta = attack.to.column - attack.from.column;
      const length = Math.max(1, Math.hypot(rowDelta, columnDelta));
      row += rowDelta / length * lunge;
      column += columnDelta / length * lunge;
    }
    this.drawUnit(unit, false, row, column);
    if (unit.breached) this.drawBreachMarker(row, column);
  }

  drawGrid() {
    const ctx = this.context;
    const cell = this.cellSize;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = 'rgba(56,189,248,.06)';
    ctx.fillRect(0, 0, 3 * cell, GAME_CONFIG.rows * cell);
    ctx.fillStyle = 'rgba(255,93,93,.06)';
    ctx.fillRect((GAME_CONFIG.columns - 3) * cell, 0, 3 * cell, GAME_CONFIG.rows * cell);
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

  drawUnit(unit, ghost, row = unit.row, column = unit.column) {
    const type = UNIT_TYPES[unit.type];
    const color = unit.team === TEAM.PLAYER ? '#38bdf8' : '#ff5d5d';
    const x = column * this.cellSize + this.cellSize / 2;
    const y = row * this.cellSize + this.cellSize / 2;
    this.context.save();
    this.context.globalAlpha = unit.stealthed ? 0.28 : 1;
    this.drawShape(type.shape, x, y, this.cellSize * 0.32, ghost ? `${color}80` : color);
    if (!ghost) {
      const width = this.cellSize * 0.7;
      const health = Math.max(0, unit.hp / unit.maxHp);
      this.context.fillStyle = '#0d141b';
      this.context.fillRect(x - width / 2, y - this.cellSize / 2 + 5, width, 4);
      this.context.fillStyle = health > 0.5 ? '#4ade80' : health > 0.2 ? '#fbbf24' : '#ff5d5d';
      this.context.fillRect(x - width / 2, y - this.cellSize / 2 + 5, width * health, 4);
    }
    this.context.restore();
  }

  drawEffect(effect, now) {
    const progress = clamp01((now - effect.start) / effect.duration);
    const color = effect.team === TEAM.PLAYER ? '#38bdf8' : effect.team === TEAM.ENEMY ? '#ff5d5d' : '#fbbf24';
    if (effect.type === 'ranged') this.drawProjectile(effect, progress, color);
    else if (effect.type === 'melee') this.drawImpact(this.x(effect.to.column), this.y(effect.to.row), progress, color);
    else if (effect.type === 'heal') this.drawHeal(effect, progress);
    else if (effect.type === 'explosion') this.drawExplosion(effect, progress);
    else if (effect.type === 'death') this.drawDeath(effect, progress);
    else if (effect.type === 'text') this.drawText(effect, progress);
  }

  drawProjectile(effect, progress, color) {
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
    this.drawShape(effect.shape, this.x(effect.column), this.y(effect.row), this.cellSize * 0.32 * (1 - 0.35 * progress), effect.color);
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
    ctx.fillStyle = `${color}33`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (shape === 'square') ctx.rect(-radius, -radius, radius * 2, radius * 2);
    else if (shape === 'triangle') this.polygon(ctx, radius, 3, -Math.PI / 2);
    else if (shape === 'diamond' || shape === 'kite') this.polygon(ctx, radius * 1.2, 4, -Math.PI / 2);
    else if (shape === 'hex') this.polygon(ctx, radius, 6, Math.PI / 6);
    else if (shape === 'octagon') this.polygon(ctx, radius, 8, Math.PI / 8);
    else if (shape === 'star' || shape === 'burst') this.star(ctx, radius, shape === 'burst' ? 8 : 5);
    else if (shape === 'chevron') { ctx.moveTo(-radius, -radius); ctx.lineTo(0, 0); ctx.lineTo(-radius, radius); ctx.moveTo(0, -radius); ctx.lineTo(radius, 0); ctx.lineTo(0, radius); }
    else if (shape === 'wing') { ctx.moveTo(-radius, 0); ctx.quadraticCurveTo(0, -radius, radius, 0); ctx.quadraticCurveTo(0, radius * 0.45, -radius, 0); ctx.closePath(); }
    else ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.moveTo(-radius * 0.5, 0); ctx.lineTo(radius * 0.5, 0);
      ctx.moveTo(0, -radius * 0.5); ctx.lineTo(0, radius * 0.5);
      ctx.stroke();
    }
    ctx.restore();
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
