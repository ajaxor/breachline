import { GAME_CONFIG, MODE, PLAYER_UNIT_TYPES, TEAM, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../data/gameConfig.js';
import { createCampaign } from './CampaignFactory.js';

const gridDistance = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.column - b.column));
const laneDistance = (a, b) => Math.abs(a.column - b.column);

export class GameModel {
  constructor({ random = Math.random, now = () => performance.now() } = {}) {
    this.random = random;
    this.now = now;
    this.campaign = createCampaign(random);
    this.selectedMission = 0;
    this.selectedUnitType = PLAYER_UNIT_TYPES[0].key;
    this.placement = [];
    this.resetBattle();
  }

  get mission() { return this.campaign[this.selectedMission]; }
  get budget() { return this.mission.playerBudget; }
  get spentBudget() { return this.placement.reduce((sum, unit) => sum + UNIT_TYPES[unit.type].cost, 0); }
  get canLaunch() { return this.placement.length > 0 && this.spentBudget <= this.budget; }
  get livingPlayerCount() { return this.units.filter((unit) => unit.alive && unit.team === TEAM.PLAYER).length; }
  get livingEnemyCount() { return this.units.filter((unit) => unit.alive && unit.team === TEAM.ENEMY).length; }

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
  }

  selectMission(index) {
    const mission = this.campaign[index];
    if (!mission || mission.status === 'locked' || (this.mode === MODE.BATTLE && !this.battleOver)) return false;
    this.selectedMission = index;
    return true;
  }

  setSelectedUnitType(type) {
    if (!UNIT_TYPES[type] || hasUnitTag(type, UNIT_TAG.AI_ONLY)) return false;
    this.selectedUnitType = type;
    return true;
  }

  togglePlacement(row, column) {
    if (this.mode !== MODE.DEPLOY || !GAME_CONFIG.playerZone.includes(column)) return false;
    const existing = this.placement.findIndex((unit) => unit.row === row && unit.column === column);
    if (existing >= 0) {
      this.placement.splice(existing, 1);
      return true;
    }
    const type = UNIT_TYPES[this.selectedUnitType];
    if (!type || hasUnitTag(type, UNIT_TAG.AI_ONLY) || this.spentBudget + type.cost > this.budget) return false;
    this.placement.push({ row, column, type: this.selectedUnitType });
    return true;
  }

  clearPlacement() { this.placement = []; }

  startBattle() {
    if (!this.canLaunch) return false;
    this.resetBattle();
    this.mode = MODE.BATTLE;
    const startedAt = this.now();
    const createUnit = (plan, team) => {
      const type = UNIT_TYPES[plan.type];
      return {
        id: this.nextUnitId++, team, type: plan.type, row: plan.row, column: plan.column,
        previousRow: plan.row, previousColumn: plan.column, animationStartedAt: startedAt,
        animationDuration: 1, breached: false, movedThisTurn: false, turnCount: 0,
        hp: type.hp, maxHp: type.hp, alive: true,
        stealthed: hasUnitTag(type, UNIT_TAG.STEALTH),
      };
    };
    this.units = [
      ...this.placement.map((plan) => createUnit(plan, TEAM.PLAYER)),
      ...this.mission.enemyFormation.map((plan) => createUnit(plan, TEAM.ENEMY)),
    ];
    this.refreshStealth();
    this.addLog(`Mission ${this.selectedMission + 1} begins. Your force: ${this.livingPlayerCount} units. Hostile force: ${this.livingEnemyCount} units.`, 'sys');
    return true;
  }

  tick() {
    if (this.mode !== MODE.BATTLE || this.battleOver) return this.result;
    this.tickCount += 1;
    const actingTeam = this.activeTeam;
    const now = this.now();
    const duration = Math.max(110, Math.min(480, GAME_CONFIG.tickIntervalMs * 0.85));
    const actingUnits = this.units.filter((unit) => unit.alive && unit.team === actingTeam);
    actingUnits.forEach((unit) => {
      unit.previousRow = unit.row;
      unit.previousColumn = unit.column;
      unit.animationStartedAt = now;
      unit.animationDuration = duration;
      unit.movedThisTurn = false;
      unit.turnCount += 1;
    });
    this.shuffle(actingUnits).forEach((unit) => this.processUnit(unit, now, duration));
    this.refreshStealth();
    this.result = this.determineResult();
    if (this.result) this.finishBattle(this.result);
    else this.activeTeam = actingTeam === TEAM.PLAYER ? TEAM.ENEMY : TEAM.PLAYER;
    return this.result;
  }

  processUnit(unit, now, duration) {
    if (!unit.alive) return;
    const type = UNIT_TYPES[unit.type];
    if (unit.breached) {
      if (this.canActAfterMovement(unit, type)) this.attackBase(unit, now, duration);
      return;
    }

    if (this.tryCombatAction(unit, type, now, duration)) return;

    if (unit.turnCount % type.moveInterval === 0) {
      unit.movedThisTurn = this.moveUnit(unit, now, duration);
      if (unit.movedThisTurn && hasUnitTag(type, UNIT_TAG.FAST_ATTACK)) {
        if (unit.breached) this.attackBase(unit, now, duration);
        else this.tryCombatAction(unit, type, now, duration);
      }
    }
  }

  canActAfterMovement(unit, type = UNIT_TYPES[unit.type]) {
    return !unit.movedThisTurn || hasUnitTag(type, UNIT_TAG.FAST_ATTACK);
  }

  tryCombatAction(unit, type, now, duration) {
    if (!this.canActAfterMovement(unit, type)) return false;
    const enemies = this.units.filter((candidate) => candidate.alive && candidate.team !== unit.team);
    const allies = this.units.filter((candidate) => candidate.alive && candidate.team === unit.team && candidate.id !== unit.id);

    if (type.action === 'heal') {
      const target = allies
        .filter((ally) => ally.hp < ally.maxHp && this.isInAttackPattern(unit, ally, type))
        .sort((a, b) => gridDistance(unit, a) - gridDistance(unit, b))[0];
      if (!target) return false;
      const healed = Math.min(type.healAmount, target.maxHp - target.hp);
      target.hp += healed;
      this.effects.push(
        { type: 'heal', from: this.point(unit), to: this.point(target), start: now, duration },
        { type: 'text', ...this.point(target), text: `+${healed}`, color: '#4ade80', start: now, duration: duration * 1.3 },
      );
      this.addLog(`${type.name} #${unit.id} restores ${healed} HP to ${UNIT_TYPES[target.type].name} #${target.id}.`, 'hit');
      return true;
    }

    if (type.attack <= 0) return false;
    const target = enemies
      .filter((enemy) => this.canTarget(unit, enemy, type))
      .sort((a, b) => gridDistance(unit, a) - gridDistance(unit, b))[0];
    if (!target) return false;
    this.attackUnit(unit, target, enemies, now, duration);
    return true;
  }

  isInAttackPattern(attacker, target, type = UNIT_TYPES[attacker.type]) {
    if (hasUnitTag(type, UNIT_TAG.ATTACK_RADIUS)) return gridDistance(attacker, target) <= type.range;
    if (hasUnitTag(type, UNIT_TAG.ATTACK_SIDEWAYS)) {
      return Math.abs(attacker.row - target.row) <= 1 && gridDistance(attacker, target) <= type.range;
    }
    return attacker.row === target.row && laneDistance(attacker, target) <= type.range;
  }

  canTarget(attacker, target, type = UNIT_TYPES[attacker.type]) {
    if (!this.isInAttackPattern(attacker, target, type)) return false;
    return !hasUnitTag(target.type, UNIT_TAG.STEALTH) || gridDistance(attacker, target) <= 1;
  }

  attackUnit(attacker, target, enemies, now, duration) {
    const type = UNIT_TYPES[attacker.type];
    this.effects.push({ type: type.range > 1 ? 'ranged' : 'melee', attackerId: attacker.id, team: attacker.team, from: this.point(attacker), to: this.point(target), start: now, duration });
    target.hp -= type.attack;
    this.effects.push({ type: 'text', ...this.point(target), text: `-${type.attack}`, color: '#ff5d5d', start: now, duration: duration * 1.3 });
    this.addLog(`${type.name} #${attacker.id} hits ${UNIT_TYPES[target.type].name} #${target.id} for ${type.attack}.`, 'hit');

    if (type.onAttack === 'detonate') {
      this.effects.push({ type: 'explosion', ...this.point(attacker), start: now, duration: Math.max(duration, 320) });
      for (const enemy of enemies) {
        if (enemy.id === target.id || !enemy.alive || gridDistance(attacker, enemy) > 1) continue;
        const splash = Math.round(type.attack * 0.55);
        enemy.hp -= splash;
        this.effects.push({ type: 'text', ...this.point(enemy), text: `-${splash}`, color: '#ff5d5d', start: now, duration: duration * 1.3 });
        this.addLog(`Splash blast hits ${UNIT_TYPES[enemy.type].name} #${enemy.id} for ${splash}.`, 'hit');
        if (enemy.hp <= 0) this.killUnit(enemy, now, duration);
      }
      attacker.alive = false;
      this.addLog(`${type.name} #${attacker.id} detonates and is destroyed.`, attacker.team === TEAM.PLAYER ? 'kill p-kill' : 'kill');
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

    if (!this.occupantAt(unit.row, nextColumn)) {
      unit.column = nextColumn;
      return true;
    }

    if (hasUnitTag(type, UNIT_TAG.FLYING)) {
      let landingColumn = nextColumn + direction;
      while (landingColumn >= 0 && landingColumn < GAME_CONFIG.columns && this.occupantAt(unit.row, landingColumn)) landingColumn += direction;
      if (landingColumn < 0 || landingColumn >= GAME_CONFIG.columns) {
        this.breach(unit, direction, now, duration);
        return true;
      }
      unit.column = landingColumn;
      return true;
    }

    if (hasUnitTag(type, UNIT_TAG.GO_AROUND)) {
      for (const row of [unit.row - 1, unit.row + 1]) {
        if (row >= 0 && row < GAME_CONFIG.rows && !this.occupantAt(row, nextColumn)) {
          unit.row = row;
          unit.column = nextColumn;
          return true;
        }
      }
    }
    return false;
  }

  breach(unit, direction, now, duration) {
    unit.breached = true;
    unit.column = direction > 0 ? GAME_CONFIG.columns - 1 : 0;
    this.effects.push({ type: 'text', ...this.point(unit), text: 'BREACH!', color: '#fbbf24', start: now, duration: Math.max(duration * 1.6, 400) });
    this.addLog(`${UNIT_TYPES[unit.type].name} #${unit.id} breaks through and begins sieging the ${unit.team === TEAM.PLAYER ? 'hostile' : 'home'} base!`, 'sys');
  }

  attackBase(unit, now, duration) {
    const type = UNIT_TYPES[unit.type];
    const damage = Math.max(type.attack, 4);
    if (unit.team === TEAM.PLAYER) this.enemyBaseHp = Math.max(0, this.enemyBaseHp - damage);
    else this.playerBaseHp = Math.max(0, this.playerBaseHp - damage);
    this.effects.push({ type: 'text', ...this.point(unit), text: `-${damage}`, color: '#fbbf24', start: now, duration: duration * 1.2 });
    this.addLog(`${type.name} #${unit.id} strikes the ${unit.team === TEAM.PLAYER ? 'hostile' : 'home'} base for ${damage}.`, unit.team === TEAM.PLAYER ? 'kill' : 'kill p-kill');
  }

  refreshStealth() {
    const living = this.units.filter((unit) => unit.alive);
    for (const unit of living) {
      if (!hasUnitTag(unit.type, UNIT_TAG.STEALTH)) {
        unit.stealthed = false;
        continue;
      }
      unit.stealthed = !living.some((other) => other.team !== unit.team && gridDistance(unit, other) <= 1);
    }
  }

  killUnit(unit, now, duration) {
    unit.alive = false;
    this.effects.push({ type: 'death', ...this.point(unit), shape: UNIT_TYPES[unit.type].shape, color: unit.team === TEAM.PLAYER ? '#38bdf8' : '#ff5d5d', start: now, duration: Math.max(duration, 300) });
    this.addLog(`${UNIT_TYPES[unit.type].name} #${unit.id} destroyed.`, unit.team === TEAM.PLAYER ? 'kill p-kill' : 'kill');
  }

  determineResult() {
    if (this.playerBaseHp <= 0 && this.enemyBaseHp <= 0) return { cssClass: 'draw', text: 'DRAW — BOTH BASES FALL SIMULTANEOUSLY', playerWon: false };
    if (this.enemyBaseHp <= 0) return { cssClass: 'player-win', text: 'VICTORY — HOSTILE BASE DESTROYED', playerWon: true };
    if (this.playerBaseHp <= 0) return { cssClass: 'enemy-win', text: 'DEFEAT — YOUR BASE IS DESTROYED', playerWon: false };
    if (this.livingPlayerCount === 0 && this.livingEnemyCount === 0) return { cssClass: 'draw', text: 'DRAW — MUTUAL ANNIHILATION', playerWon: false };
    if (this.livingPlayerCount === 0) return { cssClass: 'enemy-win', text: 'DEFEAT — YOUR FORCE ELIMINATED', playerWon: false };
    if (this.livingEnemyCount === 0) return { cssClass: 'player-win', text: 'VICTORY — HOSTILE FORCE ELIMINATED', playerWon: true };
    return null;
  }

  finishBattle(result) {
    this.battleOver = true;
    if (result.playerWon) {
      this.mission.status = 'cleared';
      const nextMission = this.campaign[this.selectedMission + 1];
      if (nextMission?.status === 'locked') nextMission.status = 'available';
    }
    this.addLog(result.text, 'sys');
  }

  returnToDeployment(missionIndex = this.selectedMission) {
    this.resetBattle();
    this.selectedMission = missionIndex;
  }

  addLog(message, cssClass = '') { this.logEntries.push({ message, cssClass }); }
  point(unit) { return { row: unit.row, column: unit.column }; }
  occupantAt(row, column) { return this.units.find((unit) => unit.alive && !unit.breached && unit.row === row && unit.column === column); }
  shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}
