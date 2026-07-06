import { GAME_CONFIG, MODE, PLAYER_UNIT_TYPES, TEAM, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../data/gameConfig.js';
import { EFFECT_TYPE, LOG_TYPE, RESULT_TYPE } from '../data/gameTypes.js';
import { BattleUnitFactory } from './BattleUnitFactory.js';
import { CampaignProgression } from './CampaignProgression.js';
import { createCampaign } from './CampaignFactory.js';
import { CombatActionResolver } from './CombatActionResolver.js';
import { BudgetDeploymentPolicy } from './DeploymentPolicies.js';
import { SpatialIndex } from './SpatialIndex.js';

export class GameModel {
  constructor({
    random = Math.random,
    now = () => performance.now(),
    unitFactory = new BattleUnitFactory(),
    actionResolver = new CombatActionResolver(),
    campaignProgression = new CampaignProgression(),
    createDeploymentPolicy = (model) => new BudgetDeploymentPolicy(model),
  } = {}) {
    this.random = random;
    this.now = now;
    this.unitFactory = unitFactory;
    this.actionResolver = actionResolver;
    this.campaignProgression = campaignProgression;
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
    this.tickCount = 0;
    this.activeTeam = TEAM.PLAYER;
    this.battleOver = false;
    this.nextUnitId = 1;
    this.playerBaseHp = GAME_CONFIG.baseHp;
    this.enemyBaseHp = GAME_CONFIG.baseHp;
    this.result = null;
    this.spatialIndex = new SpatialIndex();
  }

  beginDrafts(count = 1) {
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
    this.draftChoices = this.shuffle(pool).slice(0, 3);
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

  setSelectedUnitType(type) {
    if (!UNIT_TYPES[type] || hasUnitTag(type, UNIT_TAG.AI_ONLY) || !this.roster[type]) return false;
    this.selectedUnitType = type;
    return true;
  }

  enemyPlanAt(row, column) {
    if (this.mode !== MODE.DEPLOY) return null;
    return this.mission.enemyFormation.find((unit) => unit.row === row && unit.column === column) ?? null;
  }

  togglePlacement(row, column) { return this.deploymentPolicy.togglePlacement(row, column); }
  clearPlacement() { this.placement = []; }

  startBattle() {
    if (!this.canLaunch) return false;
    const committedFormation = this.placement.map((unit) => ({ ...unit }));
    const started = this.setupBattle({
      playerFormation: committedFormation,
      enemyFormation: this.mission.enemyFormation,
      missionLabel: `Mission ${this.selectedMission + 1}`,
    });
    if (started) this.deploymentPolicy.commitBattle(committedFormation);
    return started;
  }

  setupBattle({ playerFormation, enemyFormation, missionLabel = 'Battle' }) {
    if (!Array.isArray(playerFormation) || !Array.isArray(enemyFormation) || playerFormation.length === 0) return false;
    this.resetBattle();
    this.mode = MODE.BATTLE;
    const startedAt = this.now();
    this.units = [
      ...playerFormation.map((plan) => this.unitFactory.create(plan, TEAM.PLAYER, this.nextUnitId++, startedAt)),
      ...enemyFormation.map((plan) => this.unitFactory.create(plan, TEAM.ENEMY, this.nextUnitId++, startedAt)),
    ];
    this.spatialIndex = new SpatialIndex(this.units);
    this.refreshStealth();
    this.addLog(`${missionLabel} begins. Your force: ${this.livingPlayerCount} units. Hostile force: ${this.livingEnemyCount} units.`, LOG_TYPE.SYSTEM);
    return true;
  }

  tick() {
    if (this.mode !== MODE.BATTLE || this.battleOver) return this.result;
    this.tickCount += 1;
    const now = this.now();
    this.effects = this.effects.filter((effect) => now - effect.start < effect.duration);
    const duration = Math.max(110, Math.min(480, GAME_CONFIG.tickIntervalMs * 0.85));
    const actingUnits = this.units.filter((unit) => unit.alive);
    actingUnits.forEach((unit) => {
      unit.previousRow = unit.row;
      unit.previousColumn = unit.column;
      unit.animationStartedAt = now;
      unit.animationDuration = duration;
      unit.movedThisTurn = false;
    });
    this.spatialIndex = new SpatialIndex(this.units);
    this.processActionQueue(this.shuffle(actingUnits), now, duration);
    this.refreshStealth();
    this.result = this.determineResult();
    if (this.result) this.finishBattle(this.result);
    return this.result;
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

  breach(unit, direction, now, duration) {
    this.spatialIndex.remove(unit);
    unit.breached = true;
    unit.column = direction > 0 ? GAME_CONFIG.columns - 1 : 0;
    this.effects.push({ type: EFFECT_TYPE.TEXT, ...this.point(unit), text: 'BREACH!', color: '#fbbf24', start: now, duration: Math.max(duration * 1.6, 400) });
    this.addLog(`${UNIT_TYPES[unit.type].name} #${unit.id} breaks through and begins sieging the ${unit.team === TEAM.PLAYER ? 'hostile' : 'home'} base!`, LOG_TYPE.SYSTEM);
  }

  attackBase(unit, now, duration) {
    const type = UNIT_TYPES[unit.type];
    const damage = Math.max(type.attack, 4);
    if (unit.team === TEAM.PLAYER) this.enemyBaseHp = Math.max(0, this.enemyBaseHp - damage);
    else this.playerBaseHp = Math.max(0, this.playerBaseHp - damage);
    this.effects.push({ type: EFFECT_TYPE.TEXT, ...this.point(unit), text: `-${damage}`, color: '#fbbf24', start: now, duration: duration * 1.2 });
    this.addLog(`${type.name} #${unit.id} strikes the ${unit.team === TEAM.PLAYER ? 'hostile' : 'home'} base for ${damage}.`, unit.team === TEAM.PLAYER ? LOG_TYPE.KILL : LOG_TYPE.PLAYER_LOSS);
  }

  refreshStealth() {
    const living = this.units.filter((unit) => unit.alive);
    for (const unit of living) {
      if (!hasUnitTag(unit.type, UNIT_TAG.STEALTH)) {
        unit.stealthed = false;
        continue;
      }
      unit.stealthed = !this.spatialIndex.nearby(unit.row, unit.column, 1).some((other) => (
        other.team !== unit.team
        && this.actionResolver.targeting.isInAttackPattern(unit, other, { range: 1, tags: [UNIT_TAG.ATTACKS_OTHER_LANES] })
      ));
    }
  }

  addDeathEffect(unit, now, duration) {
    const type = UNIT_TYPES[unit.type];
    this.effects.push({ type: EFFECT_TYPE.DEATH, ...this.point(unit), shape: type.shape, graphic: type.graphic, color: unit.team === TEAM.PLAYER ? '#38bdf8' : '#ff5d5d', seed: unit.id * 2.399963229728653, start: now, duration: Math.max(duration * 1.25, 450) });
  }

  killUnit(unit, now, duration) {
    unit.alive = false;
    this.spatialIndex.remove(unit);
    this.addDeathEffect(unit, now, duration);
    this.addLog(`${UNIT_TYPES[unit.type].name} #${unit.id} destroyed.`, unit.team === TEAM.PLAYER ? LOG_TYPE.PLAYER_LOSS : LOG_TYPE.KILL);
  }

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

  returnToDeployment(missionIndex = this.selectedMission) {
    this.resetBattle();
    this.selectedMission = missionIndex;
  }

  addLog(message, cssClass = '') {
    this.logEntries.push({ message, cssClass });
    if (this.logEntries.length > GAME_CONFIG.maxLogEntries) this.logEntries.splice(0, this.logEntries.length - GAME_CONFIG.maxLogEntries);
  }

  point(unit) { return { row: unit.row, column: unit.column }; }
  occupantAt(row, column) { return this.spatialIndex.occupantAt(row, column); }

  shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}
