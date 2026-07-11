import { GAME_CONFIG, TEAM } from '../data/gameConfig.js';
import { COMBAT_EVENT } from '../data/gameTypes.js';
import { CombatEventPresenter } from './CombatEventPresenter.js';

function centerLineTarget(target) {
  if (!target?.lineObjective) return target;
  return {
    ...target,
    column: target.team === TEAM.PLAYER ? -0.75 : GAME_CONFIG.columns - 0.25,
  };
}

export class CenteredCombatEventPresenter extends CombatEventPresenter {
  present(model, event) {
    if (event.type === COMBAT_EVENT.UNIT_ATTACKED || event.type === COMBAT_EVENT.SPLASH_HIT) {
      super.present(model, { ...event, target: centerLineTarget(event.target) });
      return;
    }
    super.present(model, event);
  }
}
