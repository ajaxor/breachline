import { GAME_CONFIG, TEAM } from '../data/gameConfig.js';
import { EFFECT_TYPE } from '../data/gameTypes.js';
import { CombatRangeBattlefieldRenderer } from './CombatRangeBattlefieldRenderer.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const FADE_EDGE_WIDTH = 1.35;
const FADE_COLOR = '#060a0e';

export class FinaleFadeBattlefieldRenderer extends CombatRangeBattlefieldRenderer {
  drawGrid() {
    super.drawGrid();
    const effect = this.activeGridFade();
    if (!effect) return;
    this.drawGridFade(effect);
  }

  drawEffect(effect, now) {
    if (effect.type === EFFECT_TYPE.GRID_FADE) return;
    super.drawEffect(effect, now);
  }

  activeGridFade() {
    const now = this.now();
    return this.model?.effects?.find((effect) => effect.type === EFFECT_TYPE.GRID_FADE
      && now >= effect.start
      && now - effect.start < effect.duration) ?? null;
  }

  drawGridFade(effect) {
    const now = this.now();
    const progress = clamp01((now - effect.start) / effect.duration);
    const playerLoses = effect.losingTeam === TEAM.PLAYER;
    const sweep = progress * (GAME_CONFIG.columns + FADE_EDGE_WIDTH);
    const ctx = this.context;
    const height = GAME_CONFIG.rows * this.cellSize;

    ctx.save();
    ctx.fillStyle = FADE_COLOR;
    for (let column = 0; column < GAME_CONFIG.columns; column += 1) {
      const distance = playerLoses ? column : GAME_CONFIG.columns - 1 - column;
      const alpha = clamp01((sweep - distance) / FADE_EDGE_WIDTH);
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      ctx.fillRect(column * this.cellSize, 0, this.cellSize + 1, height);
    }
    ctx.restore();
  }
}