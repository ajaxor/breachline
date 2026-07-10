import { AURA_EFFECT, GAME_CONFIG, MODE, TEAM, UNIT_TYPES } from '../data/gameConfig.js';
import { EFFECT_TYPE, IDLE_ANIMATION, MOVEMENT_ANIMATION, UNIT_ACTION } from '../data/gameTypes.js';
import { BattlefieldRenderer } from './BattlefieldRenderer.js';
import { drawUnitGraphic } from './UnitGraphics.js';

const RANGE_STYLE = Object.freeze({
  heal: { fill: 'rgba(74, 222, 128, 0.12)', stroke: 'rgba(74, 222, 128, 0.48)' },
  [AURA_EFFECT.SHIELD]: { fill: 'rgba(56, 189, 248, 0.12)', stroke: 'rgba(56, 189, 248, 0.5)' },
  [AURA_EFFECT.DAMAGE]: { fill: 'rgba(251, 191, 36, 0.12)', stroke: 'rgba(251, 191, 36, 0.5)' },
  [AURA_EFFECT.STUN]: { fill: 'rgba(192, 132, 252, 0.12)', stroke: 'rgba(192, 132, 252, 0.5)' },
  [AURA_EFFECT.STEALTH]: { fill: 'rgba(148, 163, 184, 0.1)', stroke: 'rgba(148, 163, 184, 0.5)' },
});

const WALL_DEPTH_CELLS = 0.5;
const WALL_LEAN_CELLS = 0.24;
const WALL_GUTTER_CELLS = WALL_DEPTH_CELLS;
const TOTAL_WALL_GUTTER_CELLS = WALL_GUTTER_CELLS * 2;
const TOTAL_WALL_LEAN_CELLS = WALL_LEAN_CELLS * 2;
const BATTLE_SPEED = 0.5;
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const lerp = (start, end, progress) => start + (end - start) * progress;

export class DeploymentBattlefieldRenderer extends BattlefieldRenderer {
  resize(model) {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width <= 0 || height <= 0) return;

    this.isPortrait = height > width;
    const visualColumns = this.isPortrait
      ? GAME_CONFIG.rows + TOTAL_WALL_LEAN_CELLS
      : GAME_CONFIG.columns + TOTAL_WALL_GUTTER_CELLS;
    const visualRows = this.isPortrait
      ? GAME_CONFIG.columns + TOTAL_WALL_GUTTER_CELLS
      : GAME_CONFIG.rows + TOTAL_WALL_LEAN_CELLS;
    this.cellSize = Math.max(16, Math.floor(Math.min(width / visualColumns, height / visualRows)));
    this.canvas.width = visualColumns * this.cellSize;
    this.canvas.height = visualRows * this.cellSize;
    this.render(model);
  }

  render(model) {
    this.model = model;
    const endGutter = WALL_GUTTER_CELLS * this.cellSize;
    const leanGutter = WALL_LEAN_CELLS * this.cellSize;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.save();
    this.context.translate(
      this.isPortrait ? leanGutter : endGutter,
      this.isPortrait ? endGutter : leanGutter,
    );
    super.render(model);
    if (model.mode === MODE.DEPLOY) {
      this.context.save();
      if (this.isPortrait) this.context.transform(0, -1, 1, 0, 0, GAME_CONFIG.columns * this.cellSize);
      this.drawFriendlyEffectZones(model.placement);
      model.placement.forEach((unit) => this.drawUnit({ ...unit, team: TEAM.PLAYER, hp: 1, maxHp: 1 }, true));
      model.mission.enemyFormation.forEach((unit) => this.drawUnit({ ...unit, team: TEAM.ENEMY, hp: 1, maxHp: 1 }, true));
      this.context.restore();
    }
    this.context.restore();
  }

  cellFromPointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    const visualX = (event.clientX - rect.left) * this.canvas.width / rect.width;
    const visualY = (event.clientY - rect.top) * this.canvas.height / rect.height;
    const endGutter = WALL_GUTTER_CELLS * this.cellSize;
    const leanGutter = WALL_LEAN_CELLS * this.cellSize;
    const row = this.isPortrait
      ? Math.floor((visualX - leanGutter) / this.cellSize)
      : Math.floor((visualY - leanGutter) / this.cellSize);
    const column = this.isPortrait
      ? GAME_CONFIG.columns - 1 - Math.floor((visualY - endGutter) / this.cellSize)
      : Math.floor((visualX - endGutter) / this.cellSize);
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

    const moveProgress = animated.animationStartedAt === undefined ? 1 : clamp01((now - animated.animationStartedAt) / Math.max(1, animated.animationDuration));
    let row = lerp(animated.previousRow ?? animated.row, animated.row, moveProgress);
    let column = lerp(animated.previousColumn ?? animated.column, animated.column, moveProgress);
    if (attack) {
      const progress = clamp01((now - attack.start) / attack.duration);
      const melee = attack.type === EFFECT_TYPE.MELEE;
      const lunge = Math.sin(progress * Math.PI) * (melee ? 0.12 : 0.08);
      const rowDelta = attack.to.row - attack.from.row;
      const columnDelta = attack.to.column - attack.from.column;
      const length = Math.max(1, Math.hypot(rowDelta, columnDelta));
      row += rowDelta / length * lunge;
      column += columnDelta / length * lunge;
    }

    this.drawUnit(animated, false, row, column, healthEffects, now);
    if (unit.breached) this.drawBreachMarker(row, column);
    if (this.model?.mode === MODE.BATTLE && unit.alive) this.drawAuraStatuses(unit, row, column, now);
    this.drawHitFlash(unit, row, column, healthEffects, now);
  }

  drawHitFlash(unit, row, column, healthEffects, now) {
    const effect = healthEffects.find((candidate) => now >= candidate.start && now - candidate.start < Math.min(candidate.duration, 180));
    if (!effect) return;
    const progress = clamp01((now - effect.start) / Math.min(effect.duration, 180));
    const pulse = Math.sin(progress * Math.PI);
    const ctx = this.context;
    ctx.save();
    ctx.translate(this.x(column), this.y(row));
    this.prepareUnitContext(unit, false);
    ctx.globalAlpha = pulse * 0.72;
    ctx.shadowColor = '#f8fafc';
    ctx.shadowBlur = this.cellSize * 0.2;
    drawUnitGraphic(ctx, UNIT_TYPES[unit.type].graphic ?? UNIT_TYPES[unit.type].shape, 0, 0, this.cellSize * (0.32 + pulse * 0.025), '#f8fafc');
    ctx.restore();
  }

  drawEffect(effect, now) {
    if (effect.type === EFFECT_TYPE.MELEE) {
      this.drawMeleeStrike(effect, clamp01((now - effect.start) / effect.duration));
      return;
    }
    super.drawEffect(effect, now);
  }

  drawMeleeStrike(effect, progress) {
    const ctx = this.context;
    const x = this.x(effect.to.column);
    const y = this.y(effect.to.row);
    const angle = Math.atan2(effect.to.row - effect.from.row, effect.to.column - effect.from.column);
    const swing = Math.sin(progress * Math.PI);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.globalAlpha = (1 - progress) * 0.9;
    ctx.strokeStyle = '#f8fafc';
    ctx.shadowColor = effect.team === TEAM.PLAYER ? '#38bdf8' : '#ff5d5d';
    ctx.shadowBlur = this.cellSize * 0.16;
    ctx.lineWidth = Math.max(1.5, this.cellSize * 0.045 * (1 - progress * 0.45));
    ctx.beginPath();
    ctx.arc(0, 0, this.cellSize * (0.22 + swing * 0.18), -Math.PI * 0.72, Math.PI * 0.22);
    ctx.stroke();
    ctx.restore();
    this.drawImpact(x, y, progress, effect.team === TEAM.PLAYER ? '#38bdf8' : '#ff5d5d');
  }

  drawDeath(effect, progress) {
    const ctx = this.context;
    const x = this.x(effect.column);
    const y = this.y(effect.row);
    const crack = clamp01(progress / 0.22);
    const scatter = clamp01((progress - 0.12) / 0.88);
    const fade = 1 - scatter;
    ctx.save();
    ctx.globalAlpha = (1 - crack) * 0.9;
    ctx.translate(x, y);
    if (this.isPortrait) ctx.rotate(Math.PI / 2);
    ctx.scale(1 + crack * 0.18, 1 + crack * 0.18);
    drawUnitGraphic(ctx, effect.graphic ?? effect.shape, 0, 0, this.cellSize * 0.32, effect.color);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = Math.max(1, this.cellSize * 0.025);
    ctx.beginPath();
    ctx.arc(x, y, this.cellSize * (0.12 + scatter * 0.48), 0, Math.PI * 2);
    ctx.stroke();
    for (let index = 0; index < 14; index += 1) {
      const angle = effect.seed + index * Math.PI * 2 / 14;
      const speed = 0.28 + (index % 5) * 0.07;
      const distance = this.cellSize * scatter * speed;
      const shardX = x + Math.cos(angle) * distance;
      const shardY = y + Math.sin(angle) * distance + scatter * scatter * this.cellSize * 0.22;
      const size = this.cellSize * (0.07 - scatter * 0.035) * (index % 3 === 0 ? 1.25 : 1);
      ctx.save();
      ctx.translate(shardX, shardY);
      ctx.rotate(angle + scatter * Math.PI * (index % 2 ? 3 : -3));
      ctx.fillStyle = index % 4 === 0 ? '#f8fafc' : effect.color;
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size * 0.7, size * 0.55);
      ctx.lineTo(-size * 0.4, -size * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  drawEndWalls(logicalWidth, logicalHeight) {
    this.drawPerspectiveWall(0, logicalHeight, '#38bdf8', -1);
    this.drawPerspectiveWall(logicalWidth, logicalHeight, '#ff5d5d', 1);
  }

  wallHealth(color) {
    if (!this.model || this.model.mode !== MODE.BATTLE) return 1;
    return clamp01((color === '#ff5d5d' ? this.model.enemyLineHp : this.model.playerLineHp) / GAME_CONFIG.baseHp);
  }

  activeWallHit(color) {
    if (!this.model || this.model.mode !== MODE.BATTLE) return null;
    const team = color === '#ff5d5d' ? TEAM.ENEMY : TEAM.PLAYER;
    const now = this.now();
    return [...this.model.effects].reverse().find((effect) => effect.type === EFFECT_TYPE.HEALTH_LOSS && String(effect.targetId).startsWith(`line:${team}:`) && now >= effect.start && now - effect.start < Math.min(effect.duration, 180));
  }

  traceWall(edgeX, height, outward) {
    const depth = this.cellSize * WALL_DEPTH_CELLS;
    const lean = this.cellSize * WALL_LEAN_CELLS;
    const farX = edgeX + outward * depth;
    this.context.beginPath();
    this.context.moveTo(edgeX, 0);
    this.context.lineTo(farX, -lean);
    this.context.lineTo(farX, height + lean);
    this.context.lineTo(edgeX, height);
    this.context.closePath();
  }

  drawPerspectiveWall(edgeX, height, color, outward) {
    const ctx = this.context;
    const health = this.wallHealth(color);
    const dimFill = color === '#ff5d5d' ? 'rgba(92,36,36,0.28)' : 'rgba(23,58,72,0.32)';
    const brightFill = color === '#ff5d5d' ? 'rgba(255,93,93,0.18)' : 'rgba(56,189,248,0.18)';
    ctx.save();
    ctx.fillStyle = dimFill;
    ctx.strokeStyle = `${color}66`;
    ctx.lineWidth = Math.max(1.5, this.cellSize * 0.05);
    this.traceWall(edgeX, height, outward);
    ctx.fill();
    ctx.stroke();

    const inset = (1 - health) * height * 0.5;
    if (health > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(Math.min(edgeX, edgeX + outward * this.cellSize * WALL_DEPTH_CELLS) - 2, inset, this.cellSize * WALL_DEPTH_CELLS + 4, Math.max(0, height - inset * 2));
      ctx.clip();
      ctx.shadowColor = color;
      ctx.shadowBlur = this.cellSize * 0.16;
      ctx.fillStyle = brightFill;
      ctx.strokeStyle = color;
      this.traceWall(edgeX, height, outward);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    const hit = this.activeWallHit(color);
    if (hit) {
      const row = Number(String(hit.targetId).split(':').at(-1));
      const progress = clamp01((this.now() - hit.start) / Math.min(hit.duration, 180));
      ctx.globalAlpha = Math.sin(progress * Math.PI) * 0.75;
      ctx.fillStyle = '#f8fafc';
      ctx.shadowColor = '#f8fafc';
      ctx.shadowBlur = this.cellSize * 0.2;
      ctx.fillRect(Math.min(edgeX, edgeX + outward * this.cellSize * WALL_DEPTH_CELLS), row * this.cellSize, this.cellSize * WALL_DEPTH_CELLS, this.cellSize);
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.38;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, this.cellSize * 0.025);
    const farX = edgeX + outward * this.cellSize * WALL_DEPTH_CELLS;
    for (let row = 1; row < GAME_CONFIG.rows; row += 1) {
      const t = row / GAME_CONFIG.rows;
      this.line(edgeX, height * t, farX, lerp(-this.cellSize * WALL_LEAN_CELLS, height + this.cellSize * WALL_LEAN_CELLS, t));
    }
    ctx.restore();
  }

  drawFriendlyEffectZones(formation) {
    for (const unit of formation) {
      const type = UNIT_TYPES[unit.type];
      if (type?.action === UNIT_ACTION.HEAL) {
        this.drawRangeZone(unit.row, unit.column, type.range, RANGE_STYLE.heal);
        continue;
      }
      if (type?.aura?.effect === AURA_EFFECT.STUN) {
        this.drawBattlefieldRow(unit.column, RANGE_STYLE[AURA_EFFECT.STUN]);
        continue;
      }
      if (type?.aura) this.drawRangeZone(unit.row, unit.column, type.aura.range, RANGE_STYLE[type.aura.effect]);
    }
  }

  drawBattlefieldRow(column, style) {
    if (!style) return;
    const ctx = this.context;
    const cell = this.cellSize;
    const inset = Math.max(1, cell * 0.06);
    ctx.save();
    ctx.fillStyle = style.fill;
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = Math.max(1, cell * 0.025);
    for (let row = 0; row < GAME_CONFIG.rows; row += 1) {
      const x = column * cell + inset;
      const y = row * cell + inset;
      const size = cell - inset * 2;
      ctx.fillRect(x, y, size, size);
      ctx.strokeRect(x, y, size, size);
    }
    ctx.restore();
  }

  drawRangeZone(originRow, originColumn, range, style) {
    if (!style) return;
    const ctx = this.context;
    const cell = this.cellSize;
    ctx.save();
    ctx.fillStyle = style.fill;
    ctx.strokeStyle = style.stroke;
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
