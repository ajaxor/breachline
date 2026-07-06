export const GAME_CONFIG = Object.freeze({
  columns: 14,
  rows: 8,
  baseHp: 150,
  missionCount: 10,
  tickIntervalMs: 600,
  startingBudget: 200,
  budgetStep: 25,
  enemyBudgetBonus: 20,
  enemyBudgetStep: 10,
  playerZone: Object.freeze([0, 1, 2]),
  enemyZone: Object.freeze([11, 12, 13]),
});

export const UNIT_TYPES = Object.freeze({
  grunt: Object.freeze({ key: 'grunt', name: 'Grunt', cost: 20, hp: 40, attack: 10, range: 1, moveInterval: 1, behavior: 'Advances and melees the nearest target in reach.', shape: 'square' }),
  tank: Object.freeze({ key: 'tank', name: 'Tank', cost: 40, hp: 100, attack: 15, range: 1, moveInterval: 2, behavior: 'Slow, heavily armored wall. Melee only.', shape: 'hex' }),
  sniper: Object.freeze({ key: 'sniper', name: 'Sniper', cost: 30, hp: 20, attack: 14, range: 4, moveInterval: 2, behavior: 'Fires at the nearest target within long range.', shape: 'triangle' }),
  bomber: Object.freeze({ key: 'bomber', name: 'Bomber', cost: 25, hp: 25, attack: 26, range: 1, moveInterval: 1, behavior: 'Detonates on contact, splashing all adjacent foes.', shape: 'diamond' }),
  healer: Object.freeze({ key: 'healer', name: 'Medic', cost: 25, hp: 30, attack: 0, range: 2, healAmount: 9, moveInterval: 1, behavior: 'Advances; restores HP to the nearest hurt ally in range.', shape: 'circle' }),
});

export const TEAM = Object.freeze({ PLAYER: 'player', ENEMY: 'enemy' });
export const MODE = Object.freeze({ DEPLOY: 'deploy', BATTLE: 'battle' });
