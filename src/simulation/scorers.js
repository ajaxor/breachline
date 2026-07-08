import { GAME_CONFIG } from '../data/gameConfig.js';

const outcome = (result) => result.winner === 'player' ? 1 : result.winner === 'enemy' ? 0 : 0.5;
const margin = (result) => (
  result.playerLivingValue
  - result.enemyLivingValue
  + result.playerBaseHp
  - result.enemyBaseHp
) / 300;
const playerBaseDamage = (result) => (GAME_CONFIG.baseHp - result.enemyBaseHp) / GAME_CONFIG.baseHp;
const enemyBaseDamage = (result) => (GAME_CONFIG.baseHp - result.playerBaseHp) / GAME_CONFIG.baseHp;

export const defaultScorers = [
  {
    key: 'matchupWinRate',
    label: 'Mirrored equal-budget win rate',
    scoreUnit: ({ matchups }) => matchups.length
      ? matchups.reduce((sum, item) => sum + item.score, 0) / matchups.length
      : 0.5,
  },
  {
    key: 'matchupMargin',
    label: 'Average surviving/base margin',
    scoreUnit: ({ matchups }) => matchups.length
      ? matchups.reduce((sum, item) => sum + item.margin, 0) / matchups.length
      : 0,
  },
  {
    key: 'marginalContribution',
    label: 'Performance lift over Riflemen',
    scoreUnit: ({ contributions }) => contributions.length
      ? contributions.reduce((sum, item) => sum + item.lift, 0) / contributions.length
      : 0,
  },
  {
    key: 'objectivePressure',
    label: 'Base-damage lift over Riflemen',
    scoreUnit: ({ contributions }) => contributions.length
      ? contributions.reduce((sum, item) => sum + item.objectivePressure, 0) / contributions.length
      : 0,
  },
  {
    key: 'timeoutRate',
    label: 'Timeout rate',
    scoreUnit: ({ allResults }) => allResults.length
      ? allResults.filter((result) => result.winner === 'timeout').length / allResults.length
      : 0,
  },
];

export function summarizePair(first, second) {
  return {
    score: (outcome(first) + (1 - outcome(second))) / 2,
    margin: (margin(first) - margin(second)) / 2,
  };
}

export function contributionLift(test, mirrorTest, baseline, mirrorBaseline) {
  const testScore = ((outcome(test) + (1 - outcome(mirrorTest))) / 2)
    + (margin(test) - margin(mirrorTest)) / 4;
  const baselineScore = ((outcome(baseline) + (1 - outcome(mirrorBaseline))) / 2)
    + (margin(baseline) - margin(mirrorBaseline)) / 4;
  return testScore - baselineScore;
}

export function objectivePressureLift(test, mirrorTest, baseline, mirrorBaseline) {
  const testPressure = (playerBaseDamage(test) + enemyBaseDamage(mirrorTest)) / 2;
  const baselinePressure = (playerBaseDamage(baseline) + enemyBaseDamage(mirrorBaseline)) / 2;
  return testPressure - baselinePressure;
}
