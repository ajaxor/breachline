import { TEAM, UNIT_TYPES } from '../data/gameConfig.js';
import { CanvasRenderer } from './CanvasRenderer.js';

export class BattlefieldRenderer extends CanvasRenderer {
  drawUnit(unit, ghost, row = unit.row, column = unit.column) {
    const type = UNIT_TYPES[unit.type];
    const color = unit.team === TEAM.PLAYER ? '#38bdf8' : '#ff5d5d';
    const x = column * this.cellSize + this.cellSize / 2;
    const y = row * this.cellSize + this.cellSize / 2;
    this.context.save();
    this.context.globalAlpha = (unit.stealthed ? 0.28 : 1) * (ghost ? 0.55 : 1);
    this.drawUnitGraphic(type.graphic ?? type.shape, x, y, this.cellSize * 0.32, color);
    if (!ghost && unit.hp < unit.maxHp) {
      const width = this.cellSize * 0.7;
      const health = Math.max(0, unit.hp / unit.maxHp);
      this.context.fillStyle = '#0d141b';
      this.context.fillRect(x - width / 2, y - this.cellSize / 2 + 5, width, 4);
      this.context.fillStyle = health > 0.5 ? '#4ade80' : health > 0.2 ? '#fbbf24' : '#ff5d5d';
      this.context.fillRect(x - width / 2, y - this.cellSize / 2 + 5, width * health, 4);
    }
    this.context.restore();
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
    ctx.rotate(progress * Math.PI * 0.65);
    ctx.scale(1 + burst * 0.28, Math.max(0.08, 1 - progress * 0.92));
    this.drawUnitGraphic(effect.graphic ?? effect.shape, 0, 0, radius, effect.color);
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