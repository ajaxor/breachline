import { PLAYER_UNIT_TYPES } from '../data/gameConfig.js';
import { createSeededRandom } from './SeededRandom.js';
import { BattleSimulator } from './BattleSimulator.js';
import { ScenarioFactory } from './ScenarioFactory.js';
import {
  contributionLift,
  defaultScorers,
  objectivePressureLift,
  summarizePair,
} from './scorers.js';

const swap = ({ playerFormation, enemyFormation }) => ({
  playerFormation: enemyFormation,
  enemyFormation: playerFormation,
});

export class BalanceAnalyzer {
  constructor({
    simulator = new BattleSimulator(),
    scenarios = new ScenarioFactory(),
    scorers = defaultScorers,
  } = {}) {
    this.simulator = simulator;
    this.scenarios = scenarios;
    this.scorers = scorers;
  }

  analyze({ seed = 12345 } = {}) {
    const units = Object.fromEntries(PLAYER_UNIT_TYPES.map((type) => [type.key, {
      type,
      matchups: [],
      contributions: [],
      allResults: [],
    }]));
    let runIndex = 0;
    const run = (scenario) => this.simulator.run({
      ...scenario,
      random: createSeededRandom(seed + runIndex++),
    });

    for (const firstType of PLAYER_UNIT_TYPES) {
      for (const secondType of PLAYER_UNIT_TYPES) {
        if (firstType.key === secondType.key) continue;
        for (const scenario of this.scenarios.matchupScenarios(firstType.key, secondType.key)) {
          const first = run(scenario);
          const second = run(swap(scenario));
          const summary = summarizePair(first, second);
          units[firstType.key].matchups.push({ opponent: secondType.key, ...summary });
          units[firstType.key].allResults.push(first, second);
        }
      }
    }

    for (const type of PLAYER_UNIT_TYPES) {
      for (const scenario of this.scenarios.contributionScenarios(type.key)) {
        const test = run(scenario.test);
        const mirrorTest = run(swap(scenario.test));
        const baseline = run(scenario.baseline);
        const mirrorBaseline = run(swap(scenario.baseline));
        units[type.key].contributions.push({
          lift: contributionLift(test, mirrorTest, baseline, mirrorBaseline),
          objectivePressure: objectivePressureLift(test, mirrorTest, baseline, mirrorBaseline),
        });
        units[type.key].allResults.push(test, mirrorTest, baseline, mirrorBaseline);
      }
    }

    const reportUnits = Object.values(units).map((context) => ({
      key: context.type.key,
      name: context.type.name,
      cost: context.type.cost,
      scores: Object.fromEntries(this.scorers.map((scorer) => [
        scorer.key,
        scorer.scoreUnit(context),
      ])),
      matchups: Object.entries(context.matchups.reduce((map, item) => {
        (map[item.opponent] ??= []).push(item.score);
        return map;
      }, {})).map(([opponent, scores]) => ({
        opponent,
        winRate: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      })),
    }));

    const spread = reportUnits.reduce(
      (sum, unit) => sum + Math.abs(unit.scores.matchupWinRate - 0.5),
      0,
    ) / reportUnits.length;

    return {
      generatedAt: new Date().toISOString(),
      seed,
      simulations: runIndex,
      scorerDefinitions: this.scorers.map(({ key, label }) => ({ key, label })),
      summary: { meanAbsoluteWinRateDeviation: spread },
      units: reportUnits,
    };
  }
}
