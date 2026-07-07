import { GAME_CONFIG } from '../data/gameConfig.js';
import { CanvasRenderer } from './CanvasRenderer.js';
import { drawUnitGraphic } from './UnitGraphics.js';

export class BattlefieldRenderer extends CanvasRenderer {
  resize(model) {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width <= 0 || height <= 0) return;
    this.isPortrait = height > width;
    const visualColumns = this.isPortrait ? GAME_CONFIG.rows : GAME_CONFIG.columns;
    const visualRows = this.isPortrait ? GAME_CONFIG.columns : GAME_CONFIG.rows;
    this.cellSize = Math.max(16, Math.floor(Math.min(width / visualColumns, height / visualRows)));
    this.canvas.width = visualColumns * this.cellSize;
    this.canvas.height = visualRows * this.cellSize;
    this.render(model);
  }

  render(model) {
    this.showTurnProgress = Boolean(model.turnQueue);
    if (!this.isPortrait) {
      super.render(model);
      return;
    }
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.save();
    this.context.transform(0, -1, 1, 0, 0, GAME_CONFIG.columns * this.cellSize);
    super.render(model);
    this.context.restore();
  }

  cellFromPointer(event) {
    if (!this.isPortrait) return super.cellFromPointer(event);
    const rect = this.canvas.getBoundingClientRect();
    const visualX = (event.clientX - rect.left) * this.canvas.width / rect.width;
    const visualY = (event.clientY - rect.top) * this.canvas.height / rect.height;
    const row = Math.floor(visualX / this.cellSize);
    const column = GAME_CONFIG.columns - 1 - Math.floor(visualY / this.cellSize);
    return row >= 0 && row < GAME_CONFIG.rows && column >= 0 && column < GAME_CONFIG.columns ? { row, column } : null;
  }

  drawGrid() {
    const ctx = this.context;
    const cell = this.cellSize;
    const logicalWidth = GAME_CONFIG.columns * cell;
    const logicalHeight = GAME_CONFIG.rows * cell;
    if (!this.isPortrait) ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawDeploymentZone(GAME_CONFIG.playerZone, 'rgba(56,189,248,.06)');
    this.drawDeploymentZone(GAME_CONFIG.enemyZone, 'rgba(255,93,93,.06)');
    ctx.strokeStyle = '#16202a';
    ctx.lineWidth = 1;
    for (let column = 0; column <= GAME_CONFIG.columns; column += 1) this.line(column * cell + 0.5, 0, column * cell + 0.5, logicalHeight);
    for (let row = 0; row <= GAME_CONFIG.rows; row += 1) this.line(0, row * cell + 0.5, logicalWidth, row * cell + 0.5);
    ctx.save();
    ctx.strokeStyle = '#2a3846';
    ctx.setLineDash([4, 4]);
    this.line(logicalWidth / 2, 0, logicalWidth / 2, logicalHeight);
    ctx.restore();
  }

  drawDeploymentZone(columns, color) {
    this.context.fillStyle = color;
    columns.forEach((column) => this.context.fillRect(column * this.cellSize, 0, this.cellSize, GAME_CONFIG.rows * this.cellSize));
  }

  drawUnit(unit, ghost, row = unit.row, column = unit.column, healthEffects = [], now = this.now()) {
    super.drawUnit(unit, ghost, row, column, healthEffects, now);
    if (!ghost && this.showTurnProgress && unit.actedThisTick) this.drawActedIndicator(row, column);
  }

  drawActedIndicator(row, column) {
    const ctx = this.context;
    const x = this.x(column);
    const y = this.y(row);
    const radius = this.cellSize * 0.36;
    const markerSize = Math.max(4, this.cellSize * 0.12);

    ctx.save();
    ctx.fillStyle = 'rgba(3, 8, 13, 0.68)';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(x + radius * 0.42, y + radius * 0.42, markerSize, markerSize);
    ctx.restore();
  }

  prepareUnitContext() {
    if (this.isPortrait) this.context.rotate(Math.PI / 2);
  }

  shouldDrawHealthBar(unit, ghost) {
    return !ghost && unit.hp < unit.maxHp;
  }

  drawText(effect, progress) {
    if (!this.isPortrait) {
      super.drawText(effect, progress);
      return;
    }
    const ctx = this.context;
    ctx.save();
    ctx.translate(this.x(effect.column), this.y(effect.row));
    ctx.rotate(Math.PI / 2);
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = effect.color;
    ctx.textAlign = 'center';
    ctx.font = '700 12px "Space Mono", monospace';
    ctx.fillText(effect.text, 0, -6 - progress * 16);
    ctx.restore();
  }

  drawDeath(effect, progress) {
    const ctx = this.context;
    const x = this.x(effect.column);
    const y = this.y(effect.row);
    const radius = this.cellSize * 0.32;
    const fade = 1 - progress;
    const burst = Math.sin(progress * Math.PI);

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(x, y);
    if (this.isPortrait) ctx.rotate(Math.PI / 2);
    ctx.rotate(progress * Math.PI * 0.65);
    ctx.scale(1 + burst * 0.28, Math.max(0.08, 1 - progress * 0.92));
    drawUnitGraphic(ctx, effect.graphic ?? effect.shape, 0, 0, radius, effect.color);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = fade * 0.9;
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = Math.max(1.5, this.cellSize * 0.05 * fade);
    ctx.beginPath();
    ctx.arc(x, y, this.cellSize * (0.18 + progress * 0.62), 0, Math.PI * 2);
    ctx.stroke();

    const fragmentCount = 8;
    for (let index = 0; index < fragmentCount; index += 1) {
      const angle = index * Math.PI * 2 / fragmentCount + effect.seed;
      const distance = this.cellSize * progress * (0.25 + (index % 3) * 0.11);
      const size = this.cellSize * (0.055 - progress * 0.025);
      const fragmentX = x + Math.cos(angle) * distance;
      const fragmentY = y + Math.sin(angle) * distance + progress * progress * this.cellSize * 0.18;
      ctx.save();
      ctx.translate(fragmentX, fragmentY);
      ctx.rotate(angle + progress * Math.PI * (index % 2 ? 1 : -1));
      ctx.fillStyle = effect.color;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.restore();
    }
    ctx.restore();
  }
}
