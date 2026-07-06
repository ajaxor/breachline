import { GAME_CONFIG, MODE, PLAYER_UNIT_TYPES, TEAM, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../data/gameConfig.js';
import { ATTACK_EFFECT, EFFECT_TYPE, LOG_TYPE, MISSION_STATUS, RESULT_TYPE, UNIT_ACTION } from '../data/gameTypes.js';
import { BattleUnitFactory } from './BattleUnitFactory.js';
import { createCampaign } from './CampaignFactory.js';
import { SpatialIndex } from './SpatialIndex.js';

const gridDistance = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.column - b.column));
const laneDistance = (a, b) => Math.abs(a.column - b.column);

export class GameModel {
  constructor({ random = Math.random, now = () => performance.now(), unitFactory = new BattleUnitFactory() } = {}) {
    this.random = random;
    this.now = now;
    this.unitFactory = unitFactory;
    this.campaign = createCampaign(random);
    this.selectedMission = 0;
    this.roster = Object.fromEntries(PLAYER_UNIT_TYPES.map((type) => [type.key, false]));
    this.selectedUnitType = null;
    this.pendingDrafts = 0;
    this.draftChoices = [];
    this.placement = [];
    this.resetBattle();
  }

  get mission() { return this.campaign[this.selectedMission]; }
  get budget() { return this.mission.playerBudget; }
  get spentBudget() { return this.placement.reduce((sum, unit) => sum + UNIT_TYPES[unit.type].cost, 0); }
  get canLaunch() { return this.placement.length > 0 && this.spentBudget <= this.budget; }
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
  availableCount(typeKey) { return this.roster[typeKey] ? Number.POSITIVE_INFINITY : 0; }

  selectMission(index) {
    const mission = this.campaign[index];
    if (!mission || mission.status === MISSION_STATUS.LOCKED || (this.mode === MODE.BATTLE && !this.battleOver)) return false;
    this.selectedMission = index;
    return true;
  }

  setSelectedUnitType(type) {
    if (!UNIT_TYPES[type] || hasUnitTag(type, UNIT_TAG.AI_ONLY) || !this.roster[type]) return false;
    this.selectedUnitType = type;
    return true;
  }

  enemyPlanAt(row, column) {
    if (this.mode !== MODE.DEPLOY) return null;
    return this.mission.enemyFormation.find((unit) => unit.row === row && unit.column === column) ?? null;
  }

  togglePlacement(row, column) {
    if (this.mode !== MODE.DEPLOY || !GAME_CONFIG.playerZone.includes(column)) return false;
    const existing = this.placement.findIndex((unit) => unit.row === row && unit.column === column);
    if (existing >= 0) {
      this.placement.splice(existing, 1);
      return true;
    }
    const type = UNIT_TYPES[this.selectedUnitType];
    if (!type || hasUnitTag(type, UNIT_TAG.AI_ONLY) || !this.roster[type.key] || this.spentBudget + type.cost > this.budget) return false;
    this.placement.push({ row, column, type: this.selectedUnitType });
    return true;
  }

  clearPlacement() { this.placement = []; }

  startBattle() {
    if (!this.canLaunch) return false;
    return this.setupBattle({
      playerFormation: this.placement,
      enemyFormation: this.mission.enemyFormation,
      missionLabel: `Mission ${this.selectedMission + 1}`,
    });
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

  processActionQueue(units, now, duration) {
    const queue = units.slice();
    let consecutivePasses = 0;
    while (queue.length > 0 && consecutivePasses < queue.length) {
      const unit = queue.shift();
      if (!unit.alive) continue;
      if (this.processUnit(unit, now, duration)) consecutivePasses = 0;
      else {
        queue.push(unit);
        consecutivePasses += 1;
      }
    }
  }

  processUnit(unit, now, duration) {
    if (!unit.alive) return true;
    const type = UNIT_TYPES[unit.type];
    if (unit.breached) {
      this.attackBase(unit, now, duration);
      return true;
    }
    if (hasUnitTag(type, UNIT_TAG.FLYING)) return this.processFlyingUnit(unit, type, now, duration);
    if (this.tryCombatAction(unit, type, now, duration)) return true;
    unit.movedThisTurn = this.moveUnit(unit, now, duration);
    if (!unit.movedThisTurn) return false;
    if (hasUnitTag(type, UNIT_TAG.FAST_ATTACK)) {
      if (unit.breached) this.attackBase(unit, now, duration);
      else this.tryCombatAction(unit, type, now, duration);
    }
    return true;
  }

  processFlyingUnit(unit, type, now, duration) {
    unit.movedThisTurn = this.moveUnit(unit, now, duration);
    if (unit.breached) this.attackBase(unit, now, duration);
    else this.tryCombatAction(unit, type, now, duration);
    return true;
  }

  canActAfterMovement(unit, type = UNIT_TYPES[unit.type]) {
    return !unit.movedThisTurn || hasUnitTag(type, UNIT_TAG.FAST_ATTACK) || hasUnitTag(type, UNIT_TAG.FLYING);
  }

  tryCombatAction(unit, type, now, duration) {
    if (!this.canActAfterMovement(unit, type)) return false;
    const nearby = this.spatialIndex.nearby(unit.row, unit.column, type.range);
    const enemies = nearby.filter((candidate) => candidate.alive && candidate.team !== unit.team);
    const allies = nearby.filter((candidate) => candidate.alive && candidate.team === unit.team && candidate.id !== unit.id);
    if (type.action === UNIT_ACTION.HEAL) {
      const target = allies.filter((ally) => ally.hp < ally.maxHp && this.isInAttackPattern(unit, ally, type)).sort((a, b) => gridDistance(unit, a) - gridDistance(unit, b))[0];
      if (!target) return false;
      const healed = Math.min(type.healAmount, target.maxHp - target.hp);
      target.hp += healed;
      this.effects.push(
        { type: EFFECT_TYPE.HEAL, from: this.point(unit), to: this.point(target), start: now, duration },
        { type: EFFECT_TYPE.TEXT, ...this.point(target), text: `+${healed}`, color: '#4ade80', start: now, duration: duration * 1.3 },
      );
      this.addLog(`${type.name} #${unit.id} restores ${healed} HP to ${UNIT_TYPES[target.type].name} #${target.id}.`, LOG_TYPE.HIT);
      return true;
    }
    if (type.attack <= 0) return false;
    const target = enemies.filter((enemy) => this.canTarget(unit, enemy, type)).sort((a, b) => gridDistance(unit, a) - gridDistance(unit, b))[0];
    if (!target) return false;
    this.attackUnit(unit, target, enemies, now, duration);
    return true;
  }

  isInAttackPattern(attacker, target, type = UNIT_TYPES[attacker.type]) {
    if (hasUnitTag(type, UNIT_TAG.ATTACKS_OTHER_LANES)) return gridDistance(attacker, target) <= type.range;
    return attacker.row === target.row && laneDistance(attacker, target) <= type.range;
  }

  canTarget(attacker, target, type = UNIT_TYPES[attacker.type]) {
    if (!this.isInAttackPattern(attacker, target, type)) return false;
    return !hasUnitTag(target.type, UNIT_TAG.STEALTH) || gridDistance(attacker, target) <= 1;
  }

  attackUnit(attacker, target, enemies, now, duration) {
    const type = UNIT_TYPES[attacker.type];
    this.effects.push({ type: type.range > 1 ? EFFECT_TYPE.RANGED : EFFECT_TYPE.MELEE, attackerId: attacker.id, team: attacker.team, from: this.point(attacker), to: this.point(target), start: now, duration });
    target.hp -= type.attack;
    this.effects.push({ type: EFFECT_TYPE.TEXT, ...this.point(target), text: `-${type.attack}`, color: '#ff5d5d', start: now, duration: duration * 1.3 });
    this.addLog(`${type.name} #${attacker.id} hits ${UNIT_TYPES[target.type].name} #${target.id} for ${type.attack}.`, LOG_TYPE.HIT);
    if (type.onAttack === ATTACK_EFFECT.DETONATE) {
      this.effects.push({ type: EFFECT_TYPE.EXPLOSION, ...this.point(attacker), start: now, duration: Math.max(duration, 320) });
      for (const enemy of enemies) {
        if (enemy.id === target.id || !enemy.alive || gridDistance(attacker, enemy) > 1) continue;
        const splash = Math.round(type.attack * 0.55);
        enemy.hp -= splash;
        this.effects.push({ type: EFFECT_TYPE.TEXT, ...this.point(enemy), text: `-${splash}`, color: '#ff5d5d', start: now, duration: duration * 1.3 });
        this.addLog(`Splash blast hits ${UNIT_TYPES[enemy.type].name} #${enemy.id} for ${splash}.`, LOG_TYPE.HIT);
        if (enemy.hp <= 0) this.killUnit(enemy, now, duration);
      }
      attacker.alive = false;
      this.spatialIndex.remove(attacker);
      this.addDeathEffect(attacker, now, duration);
      this.addLog(`${type.name} #${attacker.id} detonates and is destroyed.`, attacker.team === TEAM.PLAYER ? LOG_TYPE.PLAYER_LOSS : LOG_TYPE.KILL);
    }
    if (target.alive && target.hp <= 0) this.killUnit(target, now, duration);
  }

  moveUnit(unit, now, duration) {
    const type = UNIT_TYPES[unit.type];
    if (hasUnitTag(type, UNIT_TAG.STATIONARY)) return false;
    const direction = unit.team === TEAM.PLAYER ? 1 : -1;
    const nextColumn = unit.column + direction;
    if (nextColumn < 0 || nextColumn >= GAME_CONFIG.columns) {
      this.breach(unit, direction, now, duration);
      return true;
    }
    const previousRow = unit.row;
    const previousColumn = unit.column;
    if (hasUnitTag(type, UNIT_TAG.FLYING)) unit.column = nextColumn;
    else if (!this.occupantAt(unit.row, nextColumn)) unit.column = nextColumn;
    else if (hasUnitTag(type, UNIT_TAG.CAN_MOVE_SIDEWAYS)) {
      const row = [unit.row - 1, unit.row + 1].find((candidate) => candidate >= 0 && candidate < GAME_CONFIG.rows && !this.occupantAt(candidate, nextColumn));
      if (row === undefined) return false;
      unit.row = row;
      unit.column = nextColumn;
    } else return false;
    this.spatialIndex.move(unit, previousRow, previousColumn);
    return true;
  }

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
      unit.stealthed = !this.spatialIndex.nearby(unit.row, unit.column, 1).some((other) => other.team !== unit.team && gridDistance(unit, other) <= 1);
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

  finishBattle(result) {
    this.battleOver = true;
    if (result.playerWon) {
      this.mission.status = MISSION_STATUS.CLEARED;
      const nextMission = this.campaign[this.selectedMission + 1];
      if (nextMission?.status === MISSION_STATUS.LOCKED) nextMission.status = MISSION_STATUS.AVAILABLE;
    }
    this.addLog(result.text, LOG_TYPE.SYSTEM);
  }

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
