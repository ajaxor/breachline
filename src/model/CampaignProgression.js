import { MODE } from '../data/gameConfig.js';
import { COMBAT_EVENT, MISSION_STATUS } from '../data/gameTypes.js';

export class CampaignProgression {
  selectMission(model, index) {
    const mission = model.campaign[index];
    if (!mission || mission.status === MISSION_STATUS.LOCKED || (model.mode === MODE.BATTLE && !model.battleOver)) return false;
    model.selectedMission = index;
    return true;
  }

  finishBattle(model, result) {
    model.battleOver = true;
    if (result.playerWon) {
      model.mission.status = MISSION_STATUS.CLEARED;
      const nextMission = model.campaign[model.selectedMission + 1];
      if (nextMission?.status === MISSION_STATUS.LOCKED) nextMission.status = MISSION_STATUS.AVAILABLE;
    }
    model.emitCombatEvent({ type: COMBAT_EVENT.BATTLE_FINISHED, result });
  }
}
