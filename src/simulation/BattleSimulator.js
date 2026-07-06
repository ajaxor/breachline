import { GameModel } from '../model/GameModel.js';
import { TEAM, UNIT_TYPES } from '../data/gameConfig.js';

export class BattleSimulator {
  constructor({ maxTicks = 500 } = {}) {
    this.maxTicks = maxTicks;
  }

  run({ playerFormation, enemyFormation, random = Math.random }) {
    let clock = 0;
    const model = new GameModel({ random, now: () => clock++ });
    model.campaign[0] = {
      ...model.campaign[0],
      playerBudget: Number.MAX_SAFE_INTEGER,
      enemyFormation,
      status: 'available',
    };
    model.selectedMission = 0;
    model.placement = playerFormation.map((unit) => ({ ...unit }));
    if (!model.startBattle()) throw new Error('Could not start simulated battle.');

    while (!model.battleOver && model.tickCount < this.maxTicks) model.tick();

    const livingValue = (team) => model.units
      .filter((unit) => unit.alive && unit.team === team)
      .reduce((sum, unit) => sum + UNIT_TYPES[unit.type].cost * Math.max(0, unit.hp) / unit.maxHp, 0);

    return {
      winner: model.battleOver
        ? model.result?.cssClass === 'player-win'
          ? TEAM.PLAYER
          : model.result?.cssClass === 'enemy-win'
            ? TEAM.ENEMY
            : 'draw'
        : 'timeout',
      ticks: model.tickCount,
      playerBaseHp: model.playerBaseHp,
      enemyBaseHp: model.enemyBaseHp,
      playerLivingValue: livingValue(TEAM.PLAYER),
      enemyLivingValue: livingValue(TEAM.ENEMY),
    };
  }
}
