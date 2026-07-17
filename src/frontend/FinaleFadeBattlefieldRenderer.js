import { TEAM } from '../data/gameConfig.js';
import { EFFECT_TYPE } from '../data/gameTypes.js';
import { CombatRangeBattlefieldRenderer } from './CombatRangeBattlefieldRenderer.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const FADE_BANDS = 64;
const FADE_EDGE_WIDTH = 0.1;
const FADE_COLOR = '#060a0e';

export class FinaleFadeBattlefieldRenderer extends CombatRangeBattlefieldRenderer {
  render(model) {
    super.render(model);
    const effect = this.activeGridFade();
    if (effect) this.drawBattlefieldFade(effect);
  }

  drawEffect(effect, now) {
    if (effect.type === EFFECT_TYPE.GRID_FADE) return;
    super.drawEffect(effect, now);
  }

  activeGridFade() {
    const now = this.now();
    return [...(this.model?.effects ?? [])].reverse().find((effect) => effect.type === EFFECT_TYPE.GRID_FADE
      && now >= effect.start) ?? null;
  }

  drawBattlefieldFade(effect) {
    const now = this.now();
    const progress = clamp01((now - effect.start) / effect.duration);
    const playerLoses = effect.losingTeam === TEAM.PLAYER;
    const portrait = Boolean(this.isPortrait);
    const axisLength = portrait ? this.canvas.height : this.canvas.width;
    const crossLength = portrait ? this.canvas.width : this.canvas.height;
    const sweep = progress * (1 + FADE_EDGE_WIDTH);
    const bandSize = axisLength / FADE_BANDS;
    const ctx = this.context;

    ctx.save();
    ctx.fillStyle = FADE_COLOR;
    for (let index = 0; index < FADE_BANDS; index += 1) {
      const normalized = (index + 0.5) / FADE_BANDS;
      const distance = portrait
        ? (playerLoses ? 1 - normalized : normalized)
        : (playerLoses ? normalized : 1 - normalized);
      const alpha = clamp01((sweep - distance) / FADE_EDGE_WIDTH);
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      if (portrait) ctx.fillRect(0, index * bandSize, crossLength, bandSize + 1);
      else ctx.fillRect(index * bandSize, 0, bandSize + 1, crossLength);
    }
    ctx.restore();
  }
}
