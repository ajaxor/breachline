import { GAME_CONFIG, MODE, TEAM, UNIT_TYPES } from '../data/gameConfig.js';

export class CanvasRenderer {
  constructor(canvas, container) {
    this.canvas = canvas;
    this.container = container;
    this.context = canvas.getContext('2d');
    this.cellSize = 40;
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
    model.units.filter((unit) => unit.alive).forEach((unit) => this.drawUnit(unit, false));
    model.effects.forEach((effect) => {
      if (effect.type !== 'text') return;
      const x = effect.column * this.cellSize + this.cellSize / 2;
      const y = effect.row * this.cellSize + this.cellSize / 2;
      this.context.fillStyle = effect.color;
      this.context.textAlign = 'center';
      this.context.font = '700 12px Space Mono';
      this.context.fillText(effect.text, x, y - 10);
    });
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
    for (let column = 0; column <= GAME_CONFIG.columns; column += 1) this.line(column * cell, 0, column * cell, GAME_CONFIG.rows * cell);
    for (let row = 0; row <= GAME_CONFIG.rows; row += 1) this.line(0, row * cell, GAME_CONFIG.columns * cell, row * cell);
  }

  drawUnit(unit, ghost) {
    const type = UNIT_TYPES[unit.type];
    const color = unit.team === TEAM.PLAYER ? '#38bdf8' : '#ff5d5d';
    const x = unit.column * this.cellSize + this.cellSize / 2;
    const y = unit.row * this.cellSize + this.cellSize / 2;
    this.drawShape(type.shape, x, y, this.cellSize * .32, ghost ? `${color}80` : color);
    if (!ghost) {
      const width = this.cellSize * .7;
      this.context.fillStyle = '#0d141b';
      this.context.fillRect(x - width / 2, unit.row * this.cellSize + 5, width, 4);
      this.context.fillStyle = '#4ade80';
      this.context.fillRect(x - width / 2, unit.row * this.cellSize + 5, width * Math.max(0, unit.hp / unit.maxHp), 4);
    }
  }

  drawShape(shape, x, y, radius, color) {
    const ctx = this.context;
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = color; ctx.fillStyle = `${color}33`; ctx.lineWidth = 2; ctx.beginPath();
    if (shape === 'square') ctx.rect(-radius, -radius, radius * 2, radius * 2);
    else if (shape === 'triangle') { ctx.moveTo(0, -radius); ctx.lineTo(radius, radius); ctx.lineTo(-radius, radius); ctx.closePath(); }
    else if (shape === 'diamond') { ctx.moveTo(0, -radius); ctx.lineTo(radius, 0); ctx.lineTo(0, radius); ctx.lineTo(-radius, 0); ctx.closePath(); }
    else if (shape === 'hex') { for (let i = 0; i < 6; i += 1) { const angle = Math.PI / 6 + i * Math.PI / 3; const px = radius * Math.cos(angle); const py = radius * Math.sin(angle); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); }
    else ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke(); ctx.restore();
  }

  line(x1, y1, x2, y2) { const ctx = this.context; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
}
