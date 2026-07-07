import { AURA_EFFECT, GAME_CONFIG, MODE, PLAYER_UNIT_TYPES, TEAM, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../data/gameConfig.js';
import { COMBAT_EVENT, RESULT_TYPE } from '../data/gameTypes.js';
import { BattleUnitFactory } from './BattleUnitFactory.js';
import { CampaignProgression } from './CampaignProgression.js';
import { createCampaign } from './CampaignFactory.js';
import { CombatActionResolver } from './CombatActionResolver.js';
import { BudgetDeploymentPolicy } from './DeploymentPolicies.js';
import { SpatialIndex } from './SpatialIndex.js';
import { gridDistance } from './TargetingPolicy.js';

const snapshot = (unit) => ({ id: unit.id, team: unit.team, type: unit.type, row: unit.row, column: unit.column });

export class GameModel {
  constructor({ random = Math.random, now = () => performance.now(), unitFactory = new BattleUnitFactory(), actionResolver = new CombatActionResolver(), campaignProgression = new CampaignProgression(), eventPresenter = null, createDeploymentPolicy = (model) => new BudgetDeploymentPolicy(model) } = {}) {
    this.random = random;
    this.now = now;
    this.unitFactory = unitFactory;
    this.actionResolver = actionResolver;
    this.campaignProgression = campaignProgression;
    this.eventPresenter = eventPresenter;
    this.campaign = createCampaign(random);
    this.selectedMission = 0;
    this.roster = Object.fromEntries(PLAYER_UNIT_TYPES.map((type) => [type.key, false]));
    this.selectedUnitType = null;
    this.pendingDrafts = 0;
    this.draftChoices = [];
    this.placement = [];
    this.deploymentPolicy = createDeploymentPolicy(this);
    this.resetBattle();
  }

  get mission() { return this.campaign[this.selectedMission]; }
  get budget() { return this.mission.playerBudget; }
  get spentBudget() { return this.placement.reduce((sum, unit) => sum + UNIT_TYPES[unit.type].cost, 0); }
  get canLaunch() { return this.deploymentPolicy.canLaunch; }
  get livingPlayerCount() { return this.units.filter((unit) => unit.alive && unit.team === TEAM.PLAYER).length; }
  get livingEnemyCount() { return this.units.filter((unit) => unit.alive && unit.team === TEAM.ENEMY).length; }
  get rosterTypes() { return PLAYER_UNIT_TYPES.filter((type) => this.roster[type.key]); }

  resetBattle() {
    this.mode = MODE.DEPLOY;
    this.units = [];
    this.effects = [];
    this.logEntries = [];
    this.combatEvents = [];
    this.tickCount = 0;
    this.activeTeam = TEAM.PLAYER;
    this.battleOver = false;
    this.nextUnitId = 1;
    this.playerBaseHp = GAME_CONFIG.baseHp;
    this.enemyBaseHp = GAME_CONFIG.baseHp;
    this.result = null;
    this.spatialIndex = new SpatialIndex();
    this.turnQueue = null;
    this.consecutiveTurnPasses = 0;
  }

  beginDrafts(count = 1) { this.pendingDrafts += count; this.rollDraftChoices(); return this.draftChoices; }

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
    this.draftChoices = choices;
    return this.draftChoices;
  }

  chooseDraft(typeKey) {
    if (!this.draftChoices.some((type) => type.key === typeKey) || this.pendingDrafts <= 0) return false;
    this.roster[typeKey] = true;
    this.pendingDrafts -= 1;
    if (!this.selectedUnitType) this.selectedUnitType = typeKey;
    this.rollDraftChoices();
    return true;
  }

  deployedCount(typeKey) { return this.placement.filter((unit) => unit.type === typeKey).length; }
  availableCount(typeKey) { return this.deploymentPolicy.availableCount(typeKey); }
  selectMission(index) { return this.campaignProgression.selectMission(this, index); }
  setSelectedUnitType(type) { if (!UNIT_TYPES[type] || hasUnitTag(type, UNIT_TAG.AI_ONLY) || !this.roster[type]) return false; this.selectedUnitType = type; return true; }
  enemyPlanAt(row, column) { if (this.mode !== MODE.DEPLOY) return null; return this.mission.enemyFormation.find((unit) => unit.row === row && unit.column === column) ?? null; }
  togglePlacement(row, column) { return this.deploymentPolicy.togglePlacement(row, column); }
  clearPlacement() { this.placement = []; }

  startBattle() {
    if (!this.canLaunch) return false;
    const committedFormation = this.placement.map((unit) => ({ ...unit }));
    const started = this.setupBattle({ playerFormation: committedFormation, enemyFormation: this.mission.enemyFormation, missionLabel: `Mission ${this.selectedMission + 1}` });
    if (started) this.deploymentPolicy.commitBattle(committedFormation);
    return started;
  }

  setupBattle({ playerFormation, enemyFormation, missionLabel = 'Battle' }) {
    if (!Array.isArray(playerFormation) || !Array.isArray(enemyFormation) || playerFormation.length === 0) return false;
    this.resetBattle();
    this.mode = MODE.BATTLE;
    const startedAt = this.now();
    this.units = [...playerFormation.map((plan) => this.unitFactory.create(plan, TEAM.PLAYER, this.nextUnitId++, startedAt)), ...enemyFormation.map((plan) => this.unitFactory.create(plan, TEAM.ENEMY, this.nextUnitId++, startedAt))];
    this.spatialIndex = new SpatialIndex(this.units);
    this.refreshStealth();
    this.emitCombatEvent({ type: COMBAT_EVENT.BATTLE_STARTED, label: missionLabel, playerCount: this.livingPlayerCount, enemyCount: this.livingEnemyCount, at: startedAt });
    return true;
  }

  tick() {
    if (this.mode !== MODE.BATTLE || this.battleOver) return this.result;
    this.turnQueue = null;
    this.consecutiveTurnPasses = 0;
    this.tickCount += 1;
    const now = this.now();
    this.effects = this.effects.filter((effect) => now - effect.start < effect.duration);
    const duration = Math.max(110, Math.min(480, GAME_CONFIG.tickIntervalMs * 0.85));
    const actingUnits = this.units.filter((unit) => unit.alive);
    actingUnits.forEach((unit) => { unit.previousRow = unit.row; unit.previousColumn = unit.column; unit.animationStartedAt = now; unit.animationDuration = duration; unit.movedThisTurn = false; unit.actedThisTick = false; });
    this.spatialIndex = new SpatialIndex(this.units);
    this.refreshStealth();
    this.processActionQueue(this.shuffle(actingUnits), now, duration);
    this.refreshStealth();
    this.result = this.determineResult();
    if (this.result) this.finishBattle(this.result);
    return this.result;
  }

  stepTurn() {
    if (this.mode !== MODE.BATTLE || this.battleOver) return { result: this.result, roundComplete: true, acted: false };
    const now = this.now();
    const duration = Math.max(110, Math.min(480, GAME_CONFIG.tickIntervalMs * 0.85));
    this.effects = this.effects.filter((effect) => now - effect.start < effect.duration);
    if (!this.turnQueue) {
      this.tickCount += 1;
      const livingUnits = this.units.filter((unit) => unit.alive);
      livingUnits.forEach((unit) => { unit.actedThisTick = false; });
      this.turnQueue = this.shuffle(livingUnits);
      this.consecutiveTurnPasses = 0;
      this.spatialIndex = new SpatialIndex(this.units);
      this.refreshStealth();
    }

    while (this.turnQueue.length > 0 && this.consecutiveTurnPasses < this.turnQueue.length) {
      const unit = this.turnQueue.shift();
      if (!unit.alive) continue;
      unit.previousRow = unit.row;
      unit.previousColumn = unit.column;
      unit.animationStartedAt = now;
      unit.animationDuration = duration;
      unit.movedThisTurn = false;
      if (!this.processUnit(unit, now, duration)) {
        this.turnQueue.push(unit);
        this.consecutiveTurnPasses += 1;
        continue;
      }

      unit.actedThisTick = true;
      this.consecutiveTurnPasses = 0;
      this.refreshStealth();
      this.result = this.determineResult();
      if (this.result) {
        this.turnQueue = null;
        this.finishBattle(this.result);
        return { result: this.result, roundComplete: true, acted: true };
      }
      const roundComplete = this.turnQueue.length === 0;
      if (roundComplete) this.turnQueue = null;
      return { result: null, roundComplete, acted: true };
    }

    this.turnQueue = null;
    this.consecutiveTurnPasses = 0;
    this.refreshStealth();
    this.result = this.determineResult();
    if (this.result) this.finishBattle(this.result);
    return { result: this.result, roundComplete: true, acted: false };
  }

  processActionQueue(units, now, duration) { return this.actionResolver.processQueue(this, units, now, duration); }
  processUnit(unit, now, duration) { return this.actionResolver.processUnit(this, unit, now, duration); }
  processFlyingUnit(unit, type, now, duration) { return this.actionResolver.processFlyingUnit(this, unit, type, now, duration); }
  canActAfterMovement(unit, type = UNIT_TYPES[unit.type]) { return this.actionResolver.canActAfterMovement(unit, type); }
  tryCombatAction(unit, type, now, duration) { return this.actionResolver.tryCombatAction(this, unit, type, now, duration); }
  isInAttackPattern(attacker, target, type = UNIT_TYPES[attacker.type]) { return this.actionResolver.targeting.isInAttackPattern(attacker, target, type); }
  canTarget(attacker, target, type = UNIT_TYPES[attacker.type]) { return this.actionResolver.targeting.canTarget(attacker, target, type); }
  attackUnit(attacker, target, enemies, now, duration) { return this.actionResolver.attackUnit(this, attacker, target, enemies, now, duration); }
  moveUnit(unit, now, duration) { return this.actionResolver.movement.move(this, unit, now, duration); }

  breach(unit, direction, now) {
    this.spatialIndex.remove(unit);
    unit.breached = true;
    unit.column = direction > 0 ? GAME_CONFIG.columns - 1 : 0;
    this.emitCombatEvent({ type: COMBAT_EVENT.UNIT_BREACHED, unit: snapshot(unit), targetBase: unit.team === TEAM.PLAYER ? 'hostile' : 'home', at: now });
  }

  attackBase(unit, now) {
    const type = UNIT_TYPES[unit.type];
    const damage = Math.max(type.attack, 4);
    if (unit.team === TEAM.PLAYER) this.enemyBaseHp = Math.max(0, this.enemyBaseHp - damage);
    else this.playerBaseHp = Math.max(0, this.playerBaseHp - damage);
    this.emitCombatEvent({ type: COMBAT_EVENT.BASE_ATTACKED, unit: snapshot(unit), targetBase: unit.team === TEAM.PLAYER ? 'hostile' : 'home', damage, at: now });
  }

  refreshStealth() {
    const living = this.units.filter((unit) => unit.alive);
    for (const unit of living) {
      const naturallyStealthed = hasUnitTag(unit.type, UNIT_TAG.STEALTH);
      const jammedStealth = living.some((source) => {
        if (source.team !== unit.team || source.breached) return false;
        const aura = UNIT_TYPES[source.type].aura;
        return aura?.effect === AURA_EFFECT.STEALTH && gridDistance(source, unit) <= aura.range;
      });
      const stealthGranted = naturallyStealthed || jammedStealth;
      unit.stealthed = stealthGranted && !this.spatialIndex.nearby(unit.row, unit.column, 1).some((other) => other.team !== unit.team && gridDistance(unit, other) <= 1);
    }
  }

  addDeathEffect(unit, now) { this.emitCombatEvent({ type: COMBAT_EVENT.UNIT_DESTROYED, unit: snapshot(unit), at: now, silent: true }); }
  killUnit(unit, now) { unit.alive = false; this.spatialIndex.remove(unit); this.emitCombatEvent({ type: COMBAT_EVENT.UNIT_DESTROYED, unit: snapshot(unit), at: now }); }

  determineResult() {
    if (this.playerBaseHp <= 0 && this.enemyBaseHp <= 0) return { cssClass: RESULT_TYPE.DRAW, text: 'DRAW — BOTH BASES FALL SIMULTANEOUSLY', playerWon: false };
    if (this.enemyBaseHp <= 0) return { cssClass: RESULT_TYPE.PLAYER_WIN, text: 'VICTORY — HOSTILE BASE DESTROYED', playerWon: true };
    if (this.playerBaseHp <= 0) return { cssClass: RESULT_TYPE.ENEMY_WIN, text: 'DEFEAT — YOUR BASE IS DESTROYED', playerWon: false };
    if (this.livingPlayerCount === 0 && this.livingEnemyCount === 0) return { cssClass: RESULT_TYPE.DRAW, text: 'DRAW — MUTUAL ANNIHILATION', playerWon: false };
    if (this.livingPlayerCount === 0) return { cssClass: RESULT_TYPE.ENEMY_WIN, text: 'DEFEAT — YOUR FORCE ELIMINATED', playerWon: false };
    if (this.livingEnemyCount === 0) return { cssClass: RESULT_TYPE.PLAYER_WIN, text: 'VICTORY — HOSTILE FORCE ELIMINATED', playerWon: true };
    return null;
  }

  finishBattle(result) { return this.campaignProgression.finishBattle(this, result); }
  returnToDeployment(missionIndex = this.selectedMission) { this.resetBattle(); this.selectedMission = missionIndex; }
  emitCombatEvent(event) { this.combatEvents.push(event); this.eventPresenter?.present(this, event); }
  addLog(message, cssClass = '') { this.logEntries.push({ message, cssClass }); if (this.logEntries.length > GAME_CONFIG.maxLogEntries) this.logEntries.splice(0, this.logEntries.length - GAME_CONFIG.maxLogEntries); }
  point(unit) { return { row: unit.row, column: unit.column }; }
  occupantAt(row, column) { return this.spatialIndex.occupantAt(row, column); }
  shuffle(items) { const copy = items.slice(); for (let i = copy.length - 1; i > 0; i -= 1) { const j = Math.floor(this.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; }
}
