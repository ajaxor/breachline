import { GAME_CONFIG, PLAYER_UNIT_TYPES, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../data/gameConfig.js';
import { MISSION_STATUS, RESULT_TYPE } from '../data/gameTypes.js';
import { createCampaign } from './CampaignFactory.js';
import { SupplyDeploymentPolicy } from './DeploymentPolicies.js';
import { GameModel } from './GameModel.js';
import { createSeededRandom } from './SeededRandom.js';

const cloneFormation = (formation) => formation.map((unit) => ({ ...unit }));
const byName = (left, right) => left.name.localeCompare(right.name);

export class StrategyGameModel extends GameModel {
  constructor(options = {}) {
    const sessionRandom = options.random ?? Math.random;
    super({ ...options, random: sessionRandom, createDeploymentPolicy: (model) => new SupplyDeploymentPolicy(model) });
    this.sessionRandom = sessionRandom;
    this.supply = Object.fromEntries(PLAYER_UNIT_TYPES.map((type) => [type.key, 0]));
    this.currentDraftBudget = this.mission.draftBudget;
    this.campaignSettings = { difficulty: 1, length: GAME_CONFIG.missionCount };
    this.isSandbox = false;
    this.lastBattle = null;
  }

  get totalSupply() { return this.isSandbox ? Infinity : Object.values(this.supply).reduce((sum, count) => sum + count, 0); }
  get deployedSupply() { return this.placement.length; }
  get rosterTypes() { return (this.isSandbox ? Object.values(UNIT_TYPES) : super.rosterTypes).slice().sort(byName); }
  get canRetry() { return this.isSandbox || this.totalSupply > 0; }

  configureCampaign({ difficulty = 1, length = GAME_CONFIG.missionCount } = {}) {
    this.isSandbox = false;
    this.random = this.sessionRandom;
    this.campaignSettings = { difficulty, length };
    this.campaign = createCampaign(this.sessionRandom, { difficulty, missionCount: length });
    this.selectedMission = 0;
    this.roster = Object.fromEntries(PLAYER_UNIT_TYPES.map((type) => [type.key, false]));
    this.supply = Object.fromEntries(PLAYER_UNIT_TYPES.map((type) => [type.key, 0]));
    this.selectedUnitType = null;
    this.pendingDrafts = 0;
    this.draftChoices = [];
    this.lastBattle = null;
    this.resetBattle();
    this.currentDraftBudget = this.mission.draftBudget;
  }

  configureSandbox() {
    this.isSandbox = true;
    this.random = this.sessionRandom;
    this.campaign = [{ index: 0, playerBudget: 0, enemyBudget: 0, draftBudget: 0, enemyFormation: [], status: MISSION_STATUS.AVAILABLE }];
    this.selectedMission = 0;
    this.roster = Object.fromEntries(Object.keys(UNIT_TYPES).map((key) => [key, true]));
    this.supply = Object.fromEntries(Object.keys(UNIT_TYPES).map((key) => [key, 999]));
    this.selectedUnitType = this.rosterTypes[0]?.key ?? null;
    this.pendingDrafts = 0;
    this.draftChoices = [];
    this.lastBattle = null;
    this.resetBattle();
  }

  beginDrafts(count = 1, draftBudget = null) {
    const nextMission = this.campaign[Math.min(this.selectedMission + 1, this.campaign.length - 1)];
    const defaultBudget = this.mission.status === MISSION_STATUS.CLEARED ? nextMission.draftBudget : this.mission.draftBudget;
    this.currentDraftBudget = draftBudget ?? defaultBudget;
    this.pendingDrafts += count;
    this.rollDraftChoices();
    return this.draftChoices;
  }

  rollDraftChoices() {
    if (this.pendingDrafts <= 0) { this.draftChoices = []; return this.draftChoices; }
    const lockedTypes = PLAYER_UNIT_TYPES.filter((type) => !this.roster[type.key]);
    const preferredPool = lockedTypes.length ? lockedTypes : PLAYER_UNIT_TYPES;
    const choices = [];
    const addDistinctRoles = (pool) => {
      for (const type of this.shuffle(pool)) {
        if (choices.length >= 3) break;
        if (!choices.some((choice) => choice.role === type.role)) choices.push(type);
      }
    };
    addDistinctRoles(preferredPool);
    if (choices.length < 3) addDistinctRoles(PLAYER_UNIT_TYPES);
    this.draftChoices = choices.map((type) => ({ ...type, draftCount: this.calculateDraftCount(type) }));
    return this.draftChoices;
  }

  calculateDraftCount(type) { return Math.max(1, Math.round((this.currentDraftBudget / type.cost) * (0.9 + this.random() * 0.2))); }

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

  setSelectedUnitType(type) {
    if (!UNIT_TYPES[type] || (!this.isSandbox && (hasUnitTag(type, UNIT_TAG.AI_ONLY) || !this.roster[type]))) return false;
    this.selectedUnitType = type;
    return true;
  }

  togglePlacement(row, column) {
    if (!this.isSandbox) return super.togglePlacement(row, column);
    const isPlayerZone = GAME_CONFIG.playerZone.includes(column);
    const isEnemyZone = GAME_CONFIG.enemyZone.includes(column);
    if (!isPlayerZone && !isEnemyZone) return false;
    const formation = isPlayerZone ? this.placement : this.mission.enemyFormation;
    const existing = formation.findIndex((unit) => unit.row === row && unit.column === column);
    if (existing >= 0) formation.splice(existing, 1);
    else formation.push({ row, column, type: this.selectedUnitType });
    return true;
  }

  clearPlacement() {
    super.clearPlacement();
    if (this.isSandbox && this.mission) this.mission.enemyFormation = [];
  }

  startBattle() {
    if (this.placement.length === 0 || (this.isSandbox && this.mission.enemyFormation.length === 0)) return false;
    const seed = Math.floor(this.sessionRandom() * 0x100000000) >>> 0;
    const playerFormation = cloneFormation(this.placement);
    const enemyFormation = cloneFormation(this.mission.enemyFormation);
    this.random = createSeededRandom(seed);
    const started = this.setupBattle({ playerFormation, enemyFormation, missionLabel: this.isSandbox ? 'Sandbox Battle' : `Mission ${this.selectedMission + 1}` });
    if (!started) { this.random = this.sessionRandom; return false; }
    if (!this.isSandbox) this.deploymentPolicy.commitBattle(playerFormation);
    this.lastBattle = { seed, playerFormation, enemyFormation, missionLabel: this.isSandbox ? 'Sandbox Battle' : `Mission ${this.selectedMission + 1}` };
    return true;
  }

  replayLastBattle() {
    if (!this.lastBattle) return false;
    this.random = createSeededRandom(this.lastBattle.seed);
    return this.setupBattle({ playerFormation: cloneFormation(this.lastBattle.playerFormation), enemyFormation: cloneFormation(this.lastBattle.enemyFormation), missionLabel: `${this.lastBattle.missionLabel} Replay` });
  }

  selectMission(index) {
    const previousMission = this.selectedMission;
    if (!super.selectMission(index)) return false;
    if (previousMission !== index) this.clearPlacement();
    return true;
  }

  pruneDepletedRoster() {
    if (this.isSandbox) return;
    for (const type of PLAYER_UNIT_TYPES) if ((this.supply[type.key] ?? 0) <= 0) this.roster[type.key] = false;
    if (this.selectedUnitType && !this.roster[this.selectedUnitType]) this.selectedUnitType = this.rosterTypes[0]?.key ?? null;
  }

  determineResult() {
    const result = super.determineResult();
    if (result?.cssClass === RESULT_TYPE.DRAW) return { cssClass: RESULT_TYPE.ENEMY_WIN, text: result.text.replace('DRAW', 'DEFEAT'), playerWon: false };
    return result;
  }

  finishBattle(result) { super.finishBattle(result); this.pruneDepletedRoster(); }

  returnToDeployment(missionIndex = this.selectedMission) {
    this.random = this.sessionRandom;
    this.clearPlacement();
    super.returnToDeployment(missionIndex);
  }
}
