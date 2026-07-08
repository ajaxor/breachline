import { GAME_CONFIG } from './gameConfig.js';

const midpoint = Math.floor(GAME_CONFIG.columns / 2);

export const PLAYER_DEPLOYMENT_ZONE = Object.freeze(
  Array.from({ length: midpoint }, (_, column) => column),
);

export const ENEMY_DEPLOYMENT_ZONE = Object.freeze(
  Array.from({ length: GAME_CONFIG.columns - midpoint }, (_, index) => midpoint + index),
);
