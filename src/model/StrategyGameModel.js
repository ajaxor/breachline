import { GAME_CONFIG, MODE, PLAYER_UNIT_TYPES, UNIT_ROLE, UNIT_TAG, UNIT_TYPES, hasUnitTag, unitTechWeight } from '../data/gameConfig.js';
import { MISSION_STATUS, RESULT_TYPE } from '../data/gameTypes.js';
import { createCampaign } from './CampaignFactory.js';
import { SupplyDeploymentPolicy } from './DeploymentPolicies.js';
import { GameModel } from './GameModel.js';
import { createSeededRandom } from './SeededRandom.js';

const cloneFormation = (formation) => formation.map((unit) => ({ ...unit }));
const ROLE_ORDER = new Map(Object.values(UNIT_ROLE).map((role, index) => [role, index]));
const byRoleThenName = (left, right) => (ROLE_ORDER.get(left.role) - ROLE_ORDER.get(right.role)) || left.name.localeCompare(right.name);
const choiceUnits = (choice) => choice.units ?? [choice];
const choiceRoles = (choice) => new Set(choiceUnits(choice).map((unit) => unit.role));
const isSupportPair = (first, second) => first.role === UNIT_ROLE.SUPPORT && second.role === UNIT_ROLE.SUPPORT;
const PAIR_OFFER_CHANCE = 0.25;

export class StrategyGameModel extends GameModel {
  constructor(options = {}) {
    const sessionRandom = options.random ?? Math.random;
    super({ ...options, random: sessionRandom, createDeploymentPolicy: (model) => new SupplyDeploymentPolicy(model) });
    this.sessionRandom = sessionRandom;
    this.supply = Object.fromEntries(PLAYER_UNIT_TYPES.map((type) => [type.key, 0]));
    this.currentDraftBudget = this.mission.draftBudget;
    this.currentDraftMissionIndex = this.mission.index;
    this.campaignSettings = { difficulty: 1, length: GAME_CONFIG.missionCount };
    this.isSandbox = false;
    this.lastBattle = null;
    this.sandboxGeneratorMissionIndex = 0;
    this.sandboxGeneratedMissionIndex = null;
  }

  get totalSupply() { return this.isSandbox ? Infinity : Object.values(this.supply).reduce((sum, count) => sum + count, 0); }
  get deployedSupply() { return this.placement.length; }
  get rosterTypes() { return (this.isSandbox ? Object.values(UNIT_TYPES) : super.rosterTypes).slice().sort(byRoleThenName); }
  get canRetry() { return this.isSandbox || this.totalSupply > 0; }
  get sandboxGeneratorLabel() {
    if (!this.isSandbox) return '';
    const next = this.sandboxGeneratorMissionIndex + 1;
    return this.sandboxGeneratedMissionIndex === null ? `Generate M${next}` : `Generate M${next}`;
  }

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
    this.sandboxGeneratorMissionIndex = 0;
    this.sandboxGeneratedMissionIndex = null;
    this.resetBattle();
    this.currentDraftBudget = this.mission.draftBudget;
    this.currentDraftMissionIndex = this.mission.index;
  }

  configureSandbox({ difficulty = 1, length = GAME_CONFIG.missionCount } = {}) {
    this.isSandbox = true;
    this.random = this.sessionRandom;
    this.campaignSettings = { difficulty, length };
    this.campaign = [{ index: 0, playerBudget: 0, enemyBudget: 0, wallBudget: 0, structureBudget: 0, draftBudget: 0, enemyFormation: [], status: MISSION_STATUS.AVAILABLE }];
    this.selectedMission = 0;
    this.roster = Object.fromEntries(Object.keys(UNIT_TYPES).map((key) => [key, true]));
    this.supply = Object.fromEntries(Object.keys(UNIT_TYPES).map((key) => [key, 999]));
    this.selectedUnitType = this.rosterTypes[0]?.key ?? null;
    this.pendingDrafts = 0;
    this.draftChoices = [];
    this.lastBattle = null;
    this.sandboxGeneratorMissionIndex = 0;
    this.sandboxGeneratedMissionIndex = null;
    this.resetBattle();
    this.currentDraftMissionIndex = 0;
  }

  generateSandboxCampaignDeployment() {
    if (!this.isSandbox || this.mode !== MODE.DEPLOY) return false;
    const length = Math.max(1, this.campaignSettings.length || GAME_CONFIG.missionCount);
    const missionIndex = this.sandboxGeneratorMissionIndex % length;
    const generatedCampaign = createCampaign(this.sessionRandom, { difficulty: this.campaignSettings.difficulty, missionCount: length });
    const generatedMission = generatedCampaign[missionIndex];
    this.mission.enemyBudget = generatedMission.enemyBudget;
    this.mission.wallBudget = generatedMission.wallBudget;
    this.mission.structureBudget = generatedMission.structureBudget;
    this.mission.enemyFormation = cloneFormation(generatedMission.enemyFormation);
    this.sandboxGeneratedMissionIndex = missionIndex;
    this.sandboxGeneratorMissionIndex = (missionIndex + 1) % length;
    this.lastBattle = null;
    return true;
  }

  beginDrafts(count = 1, draftBudget = null) {
    const nextMission = this.campaign[Math.min(this.selectedMission + 1, this.campaign.length - 1)];
    const isPostMissionDraft = this.mission.status === MISSION_STATUS.CLEARED;
    const defaultBudget = isPostMissionDraft ? nextMission.draftBudget : this.mission.draftBudget;
    this.currentDraftBudget = draftBudget ?? defaultBudget;
    this.currentDraftMissionIndex = isPostMissionDraft ? nextMission.index : this.mission.index;
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

  draftTechWeight(type) {
    const missionCount = this.campaignSettings.length || this.campaign.length || GAME_CONFIG.missionCount;
    return this.isSandbox ? 1 : unitTechWeight(type, this.currentDraftMissionIndex, missionCount);
  }

  weightedChoice(items, weightForItem) {
    if (!items.length) return null;
    const entries = items.map((item) => [item, Math.max(0.0001, weightForItem(item))]);
    let roll = this.random() * entries.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [item, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return item;
    }
    return entries.at(-1)[0];
  }

  rollDraftChoices() {
    if (this.pendingDrafts <= 0) { this.draftChoices = []; return this.draftChoices; }
    const openingDraft = !this.isSandbox && this.currentDraftMissionIndex === 0;
    const eligibleTypes = openingDraft ? PLAYER_UNIT_TYPES.filter((type) => type.techLevel === 1) : PLAYER_UNIT_TYPES;
    const lockedTypes = eligibleTypes.filter((type) => !this.roster[type.key]);
    const preferredPool = lockedTypes.length ? lockedTypes : eligibleTypes;
    const singlePool = preferredPool.filter((type) => type.role !== UNIT_ROLE.SUPPORT);
    const pairPool = openingDraft ? [] : (preferredPool.length >= 2 ? preferredPool : PLAYER_UNIT_TYPES);
    const choices = [];
    const usedRoles = new Set();
    const usedUnitKeys = new Set();

    const addChoice = (choice) => {
      choices.push(choice);
      for (const role of choiceRoles(choice)) usedRoles.add(role);
      for (const unit of choiceUnits(choice)) usedUnitKeys.add(unit.key);
    };

    const rolePenalty = (types) => {
      const roles = types.map((type) => type.role);
      const repeatedRoles = roles.length - new Set(roles).size;
      const usedRoleCount = roles.filter((role) => usedRoles.has(role)).length;
      const usedUnitCount = types.filter((type) => usedUnitKeys.has(type.key)).length;
      return usedRoleCount * 8 + repeatedRoles * 3 + usedUnitCount;
    };

    const weightedDraftScore = (types) => {
      const techWeight = types.reduce((sum, type) => sum + this.draftTechWeight(type), 0) / types.length;
      return techWeight / (1 + rolePenalty(types) * 2);
    };

    const bestSingle = () => {
      const candidates = this.shuffle(singlePool.length ? singlePool : preferredPool);
      return this.weightedChoice(candidates, (type) => weightedDraftScore([type]));
    };

    const bestPair = () => {
      const pairs = [];
      for (let firstIndex = 0; firstIndex < pairPool.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < pairPool.length; secondIndex += 1) {
          const first = pairPool[firstIndex];
          const second = pairPool[secondIndex];
          if (isSupportPair(first, second)) continue;
          pairs.push([first, second]);
        }
      }
      return this.weightedChoice(this.shuffle(pairs), weightedDraftScore);
    };

    for (let index = 0; index < 3; index += 1) {
      const shouldPair = pairPool.length >= 2 && (this.random() < PAIR_OFFER_CHANCE || singlePool.length === 0);
      if (shouldPair) {
        const pair = bestPair();
        if (pair) { addChoice(this.createPairDraft(pair[0], pair[1])); continue; }
      }

      const single = bestSingle();
      if (single) addChoice(this.createSingleDraft(single));
    }

    while (choices.length < 3 && pairPool.length >= 2) {
      const pair = bestPair();
      if (!pair) break;
      addChoice(this.createPairDraft(pair[0], pair[1]));
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
    if (isEnemyZone && hasUnitTag(this.selectedUnitType, UNIT_TAG.PLAYER_ONLY)) return false;
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
