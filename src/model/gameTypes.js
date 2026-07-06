export const MISSION_STATUS = Object.freeze({
  LOCKED: 'locked',
  AVAILABLE: 'available',
  CLEARED: 'cleared',
});

export const UNIT_ACTION = Object.freeze({
  ATTACK: 'attack',
  HEAL: 'heal',
});

export const ATTACK_EFFECT = Object.freeze({
  DETONATE: 'detonate',
});

export const EFFECT_TYPE = Object.freeze({
  HEAL: 'heal',
  TEXT: 'text',
  RANGED: 'ranged',
  MELEE: 'melee',
  EXPLOSION: 'explosion',
  DEATH: 'death',
});

export const RESULT_TYPE = Object.freeze({
  DRAW: 'draw',
  PLAYER_WIN: 'player-win',
  ENEMY_WIN: 'enemy-win',
});

export const LOG_TYPE = Object.freeze({
  SYSTEM: 'sys',
  HIT: 'hit',
  KILL: 'kill',
  PLAYER_LOSS: 'kill p-kill',
});
