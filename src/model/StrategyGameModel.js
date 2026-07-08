import { GAME_CONFIG, PLAYER_UNIT_TYPES, UNIT_ROLE, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../data/gameConfig.js';
import { MISSION_STATUS, RESULT_TYPE } from '../data/gameTypes.js';
import { createCampaign } from './CampaignFactory.js';
import { SupplyDeploymentPolicy } from './DeploymentPolicies.js';
import { GameModel } from './GameModel.js';
import { createSeededRandom } from './SeededRandom.js';

const cloneFormation = (formation) => formation.map((unit) => ({ ...unit }));
const ROLE_ORDER = new Map(Object.values(UNIT_ROLE).map((role, index) => [role, index]));
const byRoleThenName = (left, right) => (ROLE_ORDER.get(left.role) - ROLE_ORDER.get(right.role)) || left.name.localeCompare(right.name);

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
  get rosterTypes() { return (this.isSandbox ? Object.values(UNIT_TYPES) : super.rosterTypes).slice().sort(byRoleThenName); }
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

  createDraftAward(type, budget = this.currentDraftBudget) {
    return { ...type, draftCount: this.calculateDraftCount(type, budget) };
  }

  createSingleDraft(type) {
    const award = this.createDraftAward(type);
    return { ...award, units: [award], isPair: false };
  }

  createPairDraft(first, second) {
    const firstAward = this.createDraftAward(first, this.currentDraftBudget / 2);
    const secondAward = this.createDraftAward(second, this.currentDraftBudget / 2);
    return {
      key: `${first.key}+${second.key}`,
      name: `${first.name} / ${second.name}`,
      isPair: true,
      units: [firstAward, secondAward],
    };
  }

  rollDraftChoices() {
    if (this.pendingDrafts <= 0) { this.draftChoices = []; return this.draftChoices; }
    const lockedTypes = PLAYER_UNIT_TYPES.filter((type) => !this.roster[type.key]);
    const preferredPool = lockedTypes.length ? lockedTypes : PLAYER_UNIT_TYPES;
    const singlePool = preferredPool.filter((type) => type.role !== UNIT_ROLE.SUPPORT);
    const pairPool = preferredPool.length >= 2 ? preferredPool : PLAYER_UNIT_TYPES;
    const supportPool = pairPool.filter((type) => type.role === UNIT_ROLE.SUPPORT);
    const choices = [];
    const usedSingleRoles = new Set();

    for (let index = 0; index < 3; index += 1) {
      const shouldPair = pairPool.length >= 2 && (this.random() < 0.45 || singlePool.length === 0);
      if (shouldPair) {
        const firstCandidates = this.shuffle(pairPool);
        const first = firstCandidates.find((type) => !choices.some((choice) => choice.units.some((unit) => unit.key === type.key))) ?? firstCandidates[0];
        const preferSupport = supportPool.length > 0 && !choices.some((choice) => choice.units.some((unit) => unit.role === UNIT_ROLE.SUPPORT));
        const secondCandidates = this.shuffle(preferSupport ? supportPool : pairPool).filter((type) => type.key !== first.key);
        const second = secondCandidates[0] ?? this.shuffle(pairPool).find((type) => type.key !== first.key);
        if (first && second) { choices.push(this.createPairDraft(first, second)); continue; }
      }

      const candidates = this.shuffle(singlePool);
      const single = candidates.find((type) => !usedSingleRoles.has(type.role)) ?? candidates[0];
      if (single) {
        choices.push(this.createSingleDraft(single));
        usedSingleRoles.add(single.role);
      }
    }

    while (choices.length < 3 && pairPool.length >= 2) {
      const [first, second] = this.shuffle(pairPool).slice(0, 2);
      choices.push(this.createPairDraft(first, second));
    }
    this.draftChoices = choices;
    return this.draftChoices;
  }

  calculateDraftCount(type, budget = this.currentDraftBudget) { return Math.max(1, Math.round((budget / type.cost) * (0.9 + this.random() * 0.2))); }

  chooseDraft(choiceKey) {
    const choice = this.draftChoices.find((draft) => draft.key === choiceKey);
    if (!choice || this.pendingDrafts <= 0) return false;
    for (const unit of choice.units ?? [choice]) {
      this.roster[unit.key] = true;
      this.supply[unit.key] += unit.draftCount;
      if (!this.selectedUnitType) this.selectedUnitType = unit.key;
    }
    this.pendingDrafts -= 1;
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

  finishBattle(result) {
    const finished = super.finishBattle(result);
    if (!this.isSandbox) {
      for (const type of PLAYER_UNIT_TYPES) if ((this.supply[type.key] ?? 0) <= 0) this.roster[type.key] = false;
      if (this.selectedUnitType && !this.roster[this.selectedUnitType]) this.selectedUnitType = this.rosterTypes[0]?.key ?? null;
    }
    return finished;
  }

  replayLastBattle() {
    if (!this.lastBattle) return false;
    this.random = createSeededRandom(this.lastBattle.seed);
    return this.setupBattle({ playerFormation: cloneFormation(this.lastBattle.playerFormation), enemyFormation: cloneFormation(this.lastBattle.enemyFormation), missionLabel: `${this.lastBattle.missionLabel} Replay` });
  }
}
