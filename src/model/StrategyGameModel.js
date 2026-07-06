import { PLAYER_UNIT_TYPES } from '../data/gameConfig.js';
import { MISSION_STATUS } from '../data/gameTypes.js';
import { SupplyDeploymentPolicy } from './DeploymentPolicies.js';
import { GameModel } from './GameModel.js';

export class StrategyGameModel extends GameModel {
  constructor(options = {}) {
    super({
      ...options,
      createDeploymentPolicy: (model) => new SupplyDeploymentPolicy(model),
    });
    this.supply = Object.fromEntries(PLAYER_UNIT_TYPES.map((type) => [type.key, 0]));
    this.currentDraftBudget = this.mission.draftBudget;
  }

  get totalSupply() { return Object.values(this.supply).reduce((sum, count) => sum + count, 0); }
  get deployedSupply() { return this.placement.length; }

  beginDrafts(count = 1, draftBudget = null) {
    const nextMission = this.campaign[Math.min(this.selectedMission + 1, this.campaign.length - 1)];
    const defaultBudget = this.mission.status === MISSION_STATUS.CLEARED ? nextMission.draftBudget : this.mission.draftBudget;
    this.currentDraftBudget = draftBudget ?? defaultBudget;
    this.pendingDrafts += count;
    this.rollDraftChoices();
    return this.draftChoices;
  }

  rollDraftChoices() {
    if (this.pendingDrafts <= 0) {
      this.draftChoices = [];
      return this.draftChoices;
    }
    const lockedTypes = PLAYER_UNIT_TYPES.filter((type) => !this.roster[type.key]);
    const pool = lockedTypes.length ? lockedTypes : PLAYER_UNIT_TYPES;
    this.draftChoices = this.shuffle(pool).slice(0, 3).map((type) => ({
      ...type,
      draftCount: this.calculateDraftCount(type),
    }));
    return this.draftChoices;
  }

  calculateDraftCount(type) {
    const modifier = 0.9 + this.random() * 0.2;
    return Math.max(1, Math.round((this.currentDraftBudget / type.cost) * modifier));
  }

  chooseDraft(typeKey) {
    const choice = this.draftChoices.find((type) => type.key === typeKey);
    if (!choice || this.pendingDrafts <= 0) return false;
    this.roster[typeKey] = true;
    this.supply[typeKey] += choice.draftCount;
    this.pendingDrafts -= 1;
    if (!this.selectedUnitType) this.selectedUnitType = typeKey;
    this.rollDraftChoices();
    return true;
  }

  selectMission(index) {
    const previousMission = this.selectedMission;
    if (!super.selectMission(index)) return false;
    if (previousMission !== index) this.clearPlacement();
    return true;
  }

  pruneDepletedRoster() {
    for (const type of PLAYER_UNIT_TYPES) {
      if ((this.supply[type.key] ?? 0) <= 0) this.roster[type.key] = false;
    }
    if (this.selectedUnitType && !this.roster[this.selectedUnitType]) {
      this.selectedUnitType = this.rosterTypes[0]?.key ?? null;
    }
  }

  finishBattle(result) {
    super.finishBattle(result);
    this.pruneDepletedRoster();
  }

  returnToDeployment(missionIndex = this.selectedMission) {
    this.clearPlacement();
    super.returnToDeployment(missionIndex);
  }
}
