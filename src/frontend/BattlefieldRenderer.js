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
}
