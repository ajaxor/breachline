import { GAME_CONFIG, MODE, TEAM, UNIT_TYPES } from '../data/gameConfig.js';
import { UNIT_ACTION } from '../data/gameTypes.js';
import { BattlefieldRenderer } from './BattlefieldRenderer.js';

export class DeploymentBattlefieldRenderer extends BattlefieldRenderer {
  render(model) {
    super.render(model);
    if (model.mode !== MODE.DEPLOY) return;

    this.context.save();
    if (this.isPortrait) this.context.transform(0, -1, 1, 0, 0, GAME_CONFIG.columns * this.cellSize);
    this.drawFriendlyEffectZones(model.placement);
    model.placement.forEach((unit) => this.drawUnit({ ...unit, team: TEAM.PLAYER, hp: 1, maxHp: 1 }, true));
    model.mission.enemyFormation.forEach((unit) => this.drawUnit({ ...unit, team: TEAM.ENEMY, hp: 1, maxHp: 1 }, true));
    this.context.restore();
  }

  drawFriendlyEffectZones(formation) {
    for (const unit of formation) {
      const type = UNIT_TYPES[unit.type];
      if (type?.action !== UNIT_ACTION.HEAL || type.range <= 0) continue;
      this.drawRangeZone(unit.row, unit.column, type.range);
    }
  }

  drawRangeZone(originRow, originColumn, range) {
    const ctx = this.context;
    const cell = this.cellSize;
    ctx.save();
    ctx.fillStyle = 'rgba(74, 222, 128, 0.12)';
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.42)';
    ctx.lineWidth = Math.max(1, cell * 0.025);

    for (let row = 0; row < GAME_CONFIG.rows; row += 1) {
      for (let column = 0; column < GAME_CONFIG.columns; column += 1) {
        if (Math.abs(row - originRow) + Math.abs(column - originColumn) > range) continue;
        const inset = Math.max(1, cell * 0.06);
        const x = column * cell + inset;
        const y = row * cell + inset;
        const size = cell - inset * 2;
        ctx.fillRect(x, y, size, size);
        ctx.strokeRect(x, y, size, size);
      }
    }
    ctx.restore();
  }
}
