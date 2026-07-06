import { GAME_CONFIG, UNIT_TYPES } from '../data/gameConfig.js';

const layouts = [
  { name: 'line', rows: [0, 1, 2, 3, 4, 5, 6, 7], playerColumns: [3, 2, 1, 0], enemyColumns: [10, 11, 12, 13] },
  { name: 'center', rows: [3, 4, 2, 5, 1, 6, 0, 7], playerColumns: [4, 3, 2, 1, 0], enemyColumns: [9, 10, 11, 12, 13] },
  { name: 'cluster', rows: [3, 4, 2, 5, 1, 6, 0, 7], playerColumns: [4, 4, 3, 3, 2], enemyColumns: [9, 9, 10, 10, 11] },
];

function formationFor(typeKey, budget, side, layout, offset = 0) {
  const count = Math.max(1, Math.floor(budget / UNIT_TYPES[typeKey].cost));
  const result = [];
  const occupied = new Set();
  for (let i = 0; i < count; i += 1) {
    const row = layout.rows[(i + offset) % layout.rows.length];
    const columns = side === 'player' ? layout.playerColumns : layout.enemyColumns;
    let column = columns[Math.floor(i / layout.rows.length) % columns.length];
    while (occupied.has(`${row}:${column}`)) column += side === 'player' ? -1 : 1;
    if (column < 0 || column >= GAME_CONFIG.columns) break;
    occupied.add(`${row}:${column}`);
    result.push({ type: typeKey, row, column });
  }
  return result;
}

function mixedFormation(testKey, budget, side, layout, offset = 0) {
  const result = [];
  let remaining = budget;
  const add = (key) => {
    if (UNIT_TYPES[key].cost > remaining) return false;
    const index = result.length;
    const row = layout.rows[(index + offset) % layout.rows.length];
    const columns = side === 'player' ? layout.playerColumns : layout.enemyColumns;
    const column = columns[Math.floor(index / layout.rows.length) % columns.length];
    result.push({ type: key, row, column });
    remaining -= UNIT_TYPES[key].cost;
    return true;
  };
  add(testKey);
  while (add('grunt')) {}
  return result;
}

export class ScenarioFactory {
  constructor({ duelBudget = 280, armyBudget = 220 } = {}) {
    this.duelBudget = duelBudget;
    this.armyBudget = armyBudget;
  }

  matchupScenarios(a, b) {
    return layouts.flatMap((layout, layoutIndex) => [0, 1].map((offset) => ({
      id: `matchup:${a}:${b}:${layout.name}:${offset}`,
      playerFormation: formationFor(a, this.duelBudget, 'player', layout, offset),
      enemyFormation: formationFor(b, this.duelBudget, 'enemy', layout, layoutIndex + offset),
    })));
  }

  contributionScenarios(testKey) {
    return layouts.flatMap((layout, layoutIndex) => [0, 1].map((offset) => ({
      id: `contribution:${testKey}:${layout.name}:${offset}`,
      test: {
        playerFormation: mixedFormation(testKey, this.armyBudget, 'player', layout, offset),
        enemyFormation: mixedFormation('grunt', this.armyBudget, 'enemy', layout, layoutIndex + offset),
      },
      baseline: {
        playerFormation: mixedFormation('grunt', this.armyBudget, 'player', layout, offset),
        enemyFormation: mixedFormation('grunt', this.armyBudget, 'enemy', layout, layoutIndex + offset),
      },
    })));
  }
}
