import { TEAM, UNIT_TYPES } from '../data/gameConfig.js';
import { RESULT_TYPE } from '../data/gameTypes.js';
import { GameModel } from '../model/GameModel.js';

export class BattleSimulator {
  constructor({ maxTicks = 500 } = {}) {
    this.maxTicks = maxTicks;
  }

  run({ playerFormation, enemyFormation, random = Math.random }) {
    let clock = 0;
    const model = new GameModel({ random, now: () => clock++ });
    if (!model.setupBattle({ playerFormation, enemyFormation, missionLabel: 'Simulation' })) {
      throw new Error('Could not start simulated battle.');
    }

    while (!model.battleOver && model.tickCount < this.maxTicks) model.tick();

    const livingValue = (team) => model.units
      .filter((unit) => unit.alive && unit.team === team)
      .reduce((sum, unit) => sum + UNIT_TYPES[unit.type].cost * Math.max(0, unit.hp) / unit.maxHp, 0);

    return {
      winner: model.battleOver
        ? model.result?.cssClass === RESULT_TYPE.PLAYER_WIN
          ? TEAM.PLAYER
          : model.result?.cssClass === RESULT_TYPE.ENEMY_WIN
            ? TEAM.ENEMY
            : RESULT_TYPE.DRAW
        : 'timeout',
      ticks: model.tickCount,
      playerBaseHp: model.playerBaseHp,
      enemyBaseHp: model.enemyBaseHp,
      playerLivingValue: livingValue(TEAM.PLAYER),
      enemyLivingValue: livingValue(TEAM.ENEMY),
    };
  }
}
