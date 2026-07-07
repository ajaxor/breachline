import { AURA_EFFECT, GAME_CONFIG, MODE, UNIT_TYPES } from '../data/gameConfig.js';
import {
  ATTACK_ANIMATION,
  DEATH_ANIMATION,
  IDLE_ANIMATION,
  MOVEMENT_ANIMATION,
} from '../data/gameTypes.js';
import { CanvasRenderer } from './CanvasRenderer.js';
import { drawUnitGraphic } from './UnitGraphics.js';

const BATTLE_SPEED = 0.5;
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const lerp = (start, end, progress) => start + (end - start) * progress;
const gridDistance = (left, right) => Math.abs(left.row - right.row) + Math.abs(left.column - right.column);

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
    this.model = model;
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

  drawAnimatedUnit(unit, attack, healthEffects, now) {
    const animation = UNIT_TYPES[unit.type].animation;
    const movementSpeed = animation.movement === MOVEMENT_ANIMATION.GLIDE ? 1.12 : 1;
    const animationDuration = unit.animationDuration === undefined ? undefined : unit.animationDuration / (BATTLE_SPEED * movementSpeed);
    const animated = { ...unit, animationDuration };

    if (animation.idle === IDLE_ANIMATION.HOVER) {
      const hover = Math.sin(now / 260 + unit.id * 1.7) * 0.075;
      if (this.isPortrait) {
        animated.column += hover;
        animated.previousColumn = (animated.previousColumn ?? unit.column) + hover;
      } else {
        animated.row += hover;
        animated.previousRow = (animated.previousRow ?? unit.row) + hover;
      }
    } else if (animation.movement === MOVEMENT_ANIMATION.MARCH && unit.animationStartedAt !== undefined) {
      const progress = clamp01((now - unit.animationStartedAt) / Math.max(1, animationDuration));
      const bounce = Math.abs(Math.sin(progress * Math.PI * 4)) * 0.035 * (1 - progress);
      if (this.isPortrait) {
        animated.column -= bounce;
        animated.previousColumn = (animated.previousColumn ?? unit.column) - bounce;
      } else {
        animated.row -= bounce;
        animated.previousRow = (animated.previousRow ?? unit.row) - bounce;
      }
    }

    super.drawAnimatedUnit(animated, attack, healthEffects, now);
    if (this.model?.mode !== MODE.BATTLE || !unit.alive) return;
    const moveProgress = animated.animationStartedAt === undefined ? 1 : clamp01((now - animated.animationStartedAt) / Math.max(1, animated.animationDuration));
    let row = lerp(animated.previousRow ?? animated.row, animated.row, moveProgress);
    let column = lerp(animated.previousColumn ?? animated.column, animated.column, moveProgress);
    if (attack) {
      const progress = clamp01((now - attack.start) / attack.duration);
      const lunge = Math.sin(progress * Math.PI) * (attack.type === 'melee' ? 0.32 : 0.08);
      const rowDelta = attack.to.row - attack.from.row;
      const columnDelta = attack.to.column - attack.from.column;
      const length = Math.max(1, Math.hypot(rowDelta, columnDelta));
      row += rowDelta / length * lunge;
      column += columnDelta / length * lunge;
    }
    this.drawAuraStatuses(unit, row, column, now);
  }

  drawAuraStatuses(unit, row, column, now) {
    const statuses = this.activeAuraStatuses(unit);
    if (!statuses.shielded && !statuses.amplified && !statuses.stunned) return;
    const ctx = this.context;
    const x = this.x(column);
    const y = this.y(row);
    const pulse = (Math.sin(now / 180 + unit.id) + 1) / 2;
    const radius = this.cellSize * 0.39;

    ctx.save();
    ctx.translate(x, y);
    if (statuses.shielded) {
      ctx.strokeStyle = `rgba(56,189,248,${0.55 + pulse * 0.25})`;
      ctx.lineWidth = Math.max(1.5, this.cellSize * 0.045);
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = this.cellSize * 0.18;
      ctx.beginPath();
      ctx.arc(0, 0, radius + pulse * this.cellSize * 0.035, -Math.PI * 0.85, Math.PI * 0.85);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    if (statuses.amplified) {
      ctx.strokeStyle = `rgba(251,191,36,${0.65 + pulse * 0.25})`;
      ctx.fillStyle = '#fbbf24';
      ctx.lineWidth = Math.max(1.2, this.cellSize * 0.03);
      for (let index = 0; index < 3; index += 1) {
        const angle = now / 420 + index * Math.PI * 2 / 3 + unit.id;
        const orbit = radius + this.cellSize * 0.06;
        const px = Math.cos(angle) * orbit;
        const py = Math.sin(angle) * orbit;
        ctx.beginPath();
        ctx.moveTo(px - this.cellSize * 0.05, py + this.cellSize * 0.04);
        ctx.lineTo(px, py - this.cellSize * 0.05);
        ctx.lineTo(px + this.cellSize * 0.05, py + this.cellSize * 0.04);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1.2, this.cellSize * 0.025), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (statuses.stunned) {
      ctx.strokeStyle = `rgba(192,132,252,${0.7 + pulse * 0.25})`;
      ctx.lineWidth = Math.max(1.5, this.cellSize * 0.04);
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = this.cellSize * 0.12;
      for (let index = 0; index < 3; index += 1) {
        const offset = (index - 1) * this.cellSize * 0.13;
        ctx.beginPath();
        ctx.moveTo(offset - this.cellSize * 0.08, -radius * 0.95);
        ctx.lineTo(offset + this.cellSize * 0.02, -radius * 0.65);
        ctx.lineTo(offset - this.cellSize * 0.03, -radius * 0.45);
        ctx.lineTo(offset + this.cellSize * 0.08, -radius * 0.18);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(192,132,252,${0.06 + pulse * 0.05})`;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.92, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  activeAuraStatuses(unit) {
    const statuses = { shielded: false, amplified: false, stunned: (unit.stunTurnsRemaining ?? 0) > 0 || unit.stunnedThisTick };
    const units = this.model?.units ?? [];
    for (const source of units) {
      if (!source.alive || source.breached) continue;
      const aura = UNIT_TYPES[source.type]?.aura;
      if (!aura || gridDistance(source, unit) > aura.range) continue;
      if (source.team === unit.team && aura.effect === AURA_EFFECT.SHIELD) statuses.shielded = true;
      if (source.team === unit.team && aura.effect === AURA_EFFECT.DAMAGE) statuses.amplified = true;
    }
    return statuses;
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

  drawProjectile(effect, progress, color) {
    switch (effect.attackStyle) {
      case ATTACK_ANIMATION.MISSILE:
        this.drawMissile(effect, progress, color);
        break;
      case ATTACK_ANIMATION.LOB:
        this.drawLobbedProjectile(effect, progress, color);
        break;
      case ATTACK_ANIMATION.LASER:
      default:
        this.drawLaser(effect, progress, color);
        break;
    }
  }

  drawLaser(effect, progress, color) {
    const fromX = this.x(effect.from.column), fromY = this.y(effect.from.row);
    const toX = this.x(effect.to.column), toY = this.y(effect.to.row);
    const ctx = this.context;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress * 1.35);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, this.cellSize * 0.07 * (1 - progress));
    ctx.shadowColor = color;
    ctx.shadowBlur = this.cellSize * 0.18;
    this.line(fromX, fromY, toX, toY);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = Math.max(0.75, this.cellSize * 0.018);
    this.line(fromX, fromY, toX, toY);
    ctx.restore();
    if (progress > 0.38) this.drawImpact(toX, toY, (progress - 0.38) / 0.62, color);
  }

  drawMissile(effect, progress, color) {
    const fromX = this.x(effect.from.column), fromY = this.y(effect.from.row);
    const toX = this.x(effect.to.column), toY = this.y(effect.to.row);
    const travel = Math.min(1, progress / 0.68);
    const x = lerp(fromX, toX, travel);
    const y = lerp(fromY, toY, travel);
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const ctx = this.context;
    ctx.save();
    ctx.globalAlpha = 1 - Math.max(0, progress - 0.72) / 0.28;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = Math.max(1, this.cellSize * 0.045);
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(angle) * this.cellSize * 0.3, y - Math.sin(angle) * this.cellSize * 0.3);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.fillRect(-this.cellSize * 0.13, -this.cellSize * 0.055, this.cellSize * 0.25, this.cellSize * 0.11);
    ctx.restore();
    if (progress > 0.62) this.drawImpact(toX, toY, (progress - 0.62) / 0.38, color);
  }

  drawLobbedProjectile(effect, progress, color) {
    const fromX = this.x(effect.from.column), fromY = this.y(effect.from.row);
    const toX = this.x(effect.to.column), toY = this.y(effect.to.row);
    const travel = Math.min(1, progress / 0.72);
    const arc = Math.sin(travel * Math.PI) * this.cellSize * 0.9;
    const x = lerp(fromX, toX, travel);
    const y = lerp(fromY, toY, travel) - arc;
    const ctx = this.context;
    ctx.save();
    ctx.globalAlpha = 1 - Math.max(0, progress - 0.75) / 0.25;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, this.cellSize * 0.085, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `${color}99`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    for (let step = 1; step <= 10; step += 1) {
      const t = travel * step / 10;
      ctx.lineTo(lerp(fromX, toX, t), lerp(fromY, toY, t) - Math.sin(t * Math.PI) * this.cellSize * 0.9);
    }
    ctx.stroke();
    ctx.restore();
    if (progress > 0.66) this.drawImpact(toX, toY, (progress - 0.66) / 0.34, color);
  }

  drawExplosion(effect, progress) {
    const intensity = effect.intensity ?? 1;
    const ctx = this.context;
    const x = this.x(effect.column), y = this.y(effect.row);
    ctx.save();
    ctx.globalAlpha = (1 - progress) * intensity;
    const radius = this.cellSize * (0.12 + progress * 0.72) * intensity;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, radius));
    glow.addColorStop(0, '#f8fafc');
    glow.addColorStop(0.25, '#fbbf24');
    glow.addColorStop(0.65, '#ff5d5d');
    glow.addColorStop(1, 'rgba(255,93,93,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawDeath(effect, progress) {
    if (effect.deathStyle === DEATH_ANIMATION.SPIN_OUT) {
      this.drawSpinOutDeath(effect, progress);
      return;
    }
    this.drawExplosiveDeath(effect, progress);
  }

  drawSpinOutDeath(effect, progress) {
    const ctx = this.context;
    const x = this.x(effect.column);
    const y = this.y(effect.row) + progress * progress * this.cellSize * 0.7;
    const radius = this.cellSize * 0.32;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.translate(x, y);
    if (this.isPortrait) ctx.rotate(Math.PI / 2);
    ctx.rotate(progress * Math.PI * 4.5);
    ctx.scale(1 - progress * 0.45, 1 - progress * 0.45);
    drawUnitGraphic(ctx, effect.graphic ?? effect.shape, 0, 0, radius, effect.color);
    ctx.restore();
  }

  drawExplosiveDeath(effect, progress) {
    const ctx = this.context;
    const x = this.x(effect.column);
    const y = this.y(effect.row);
    const fade = 1 - progress;
    const flash = Math.sin(Math.min(1, progress * 2) * Math.PI);

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(x, y);
    if (this.isPortrait) ctx.rotate(Math.PI / 2);
    ctx.scale(1 + flash * 0.35, 1 + flash * 0.35);
    drawUnitGraphic(ctx, effect.graphic ?? effect.shape, 0, 0, this.cellSize * 0.32 * fade, effect.color);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = fade;
    for (let index = 0; index < 10; index += 1) {
      const angle = index * Math.PI * 2 / 10 + effect.seed;
      const distance = this.cellSize * progress * (0.3 + (index % 4) * 0.1);
      const size = this.cellSize * Math.max(0.015, 0.065 - progress * 0.035);
      const fragmentX = x + Math.cos(angle) * distance;
      const fragmentY = y + Math.sin(angle) * distance + progress * progress * this.cellSize * 0.2;
      ctx.save();
      ctx.translate(fragmentX, fragmentY);
      ctx.rotate(angle + progress * Math.PI * (index % 2 ? 2 : -2));
      ctx.fillStyle = index % 3 === 0 ? '#fbbf24' : effect.color;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.restore();
    }
    ctx.restore();
  }
}