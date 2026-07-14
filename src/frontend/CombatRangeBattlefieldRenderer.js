import { GAME_CONFIG, TEAM, UNIT_TAG, UNIT_TYPES } from '../data/gameConfig.js';
import { ATTACK_ANIMATION } from '../data/gameTypes.js';
import { DeploymentBattlefieldRenderer } from './DeploymentBattlefieldRenderer.js';
import { drawUnitGraphic } from './UnitGraphics.js';

const RANGE_STYLE = Object.freeze({
  fill: 'rgba(248, 250, 252, 0.055)',
  stroke: 'rgba(248, 250, 252, 0.22)',
});

export class CombatRangeBattlefieldRenderer extends DeploymentBattlefieldRenderer {
  constructor(...args) {
    super(...args);
    this.inspectedEnemyCell = null;
  }

  setInspectedEnemyCell(cell) {
    this.inspectedEnemyCell = cell ? { row: cell.row, column: cell.column } : null;
    if (this.model) this.render(this.model);
  }

  drawProjectile(effect, progress, color) {
    if (effect.attackStyle === ATTACK_ANIMATION.LIGHTNING) {
      this.drawLightning(effect, progress, color);
      return;
    }
    super.drawProjectile(effect, progress, color);
  }

  drawImpact(x, y, progress, color) {
    const ctx = this.context;
    const fade = 1 - progress;
    const snap = Math.sin(Math.min(1, progress * 1.7) * Math.PI);
    const radius = this.cellSize * (0.12 + snap * 0.16);
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = fade;
    ctx.shadowColor = color;
    ctx.shadowBlur = this.cellSize * 0.16 * fade;
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = Math.max(1.2, this.cellSize * 0.04 * fade);
    const spin = progress * Math.PI * 2.25;
    ctx.rotate(Math.PI / 4 + spin);
    ctx.strokeRect(-radius, -radius, radius * 2, radius * 2);
    ctx.rotate(-Math.PI / 4 - spin);
    ctx.fillStyle = '#f8fafc';
    ctx.globalAlpha = fade * (0.45 + snap * 0.45);
    ctx.beginPath();
    ctx.arc(0, 0, this.cellSize * (0.035 + snap * 0.035), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, this.cellSize * 0.026);
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI / 4 + progress * Math.PI * 2;
      const stagger = 0.72 + (index % 3) * 0.14;
      const inner = this.cellSize * (0.12 + progress * 0.08) * stagger;
      const outer = inner + this.cellSize * (0.11 + snap * 0.07) * fade;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.restore();
  }

  canShowAttackRange(type) {
    return Boolean(type && type.attack > 0 && type.range > 0);
  }

  drawFriendlyEffectZones(formation) {
    super.drawFriendlyEffectZones(formation);

    const unit = formation.at(-1);
    if (unit) {
      const type = UNIT_TYPES[unit.type];
      if (this.canShowAttackRange(type)) this.drawRangedRangeZone({ ...unit, team: TEAM.PLAYER }, type);
    }

    const inspected = this.inspectedEnemyCell;
    if (!inspected) return;
    const enemy = this.model?.mission?.enemyFormation?.find(
      (candidate) => candidate.row === inspected.row && candidate.column === inspected.column,
    );
    const enemyType = enemy ? UNIT_TYPES[enemy.type] : null;
    if (this.canShowAttackRange(enemyType)) this.drawRangedRangeZone({ ...enemy, team: TEAM.ENEMY }, enemyType);
  }

  isCellInAttackRange(unit, type, row, column) {
    const rowDistance = Math.abs(row - unit.row);
    const columnDistance = Math.abs(column - unit.column);
    const direction = unit.team === TEAM.PLAYER ? 1 : -1;
    const forwardDistance = (column - unit.column) * direction;
    if (forwardDistance < 0) return false;
    if (type.tags.includes(UNIT_TAG.SWIVEL)) return Math.max(rowDistance, columnDistance) <= type.range;
    const inForwardLane = row === unit.row && forwardDistance <= type.range;
    const inSideLane = column === unit.column && rowDistance <= type.range;
    return inForwardLane || inSideLane;
  }

  drawRangedRangeZone(unit, type) {
    const ctx = this.context;
    const cell = this.cellSize;
    const graphic = type.graphic ?? type.shape;
    ctx.save();
    ctx.fillStyle = RANGE_STYLE.fill;
    ctx.strokeStyle = RANGE_STYLE.stroke;
    ctx.lineWidth = Math.max(1, cell * 0.025);
    for (let row = 0; row < GAME_CONFIG.rows; row += 1) {
      for (let column = 0; column < GAME_CONFIG.columns; column += 1) {
        if (!this.isCellInAttackRange(unit, type, row, column)) continue;
        const inset = Math.max(1, cell * 0.06);
        const x = column * cell + inset;
        const y = row * cell + inset;
        const size = cell - inset * 2;
        ctx.fillRect(x, y, size, size);
        ctx.strokeRect(x, y, size, size);
        ctx.save();
        ctx.globalAlpha = 0.16;
        drawUnitGraphic(ctx, graphic, x + size / 2, y + size / 2, cell * 0.105, unit.team === TEAM.ENEMY ? '#ff5d5d' : '#38bdf8');
        ctx.restore();
      }
    }
    ctx.restore();
  }
}
