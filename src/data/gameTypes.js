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

export const ATTACK_ANIMATION = Object.freeze({
  MELEE: 'melee',
  LASER: 'laser',
  MISSILE: 'missile',
  LOB: 'lob',
  LIGHTNING: 'lightning',
});

export const MOVEMENT_ANIMATION = Object.freeze({
  MARCH: 'march',
  GLIDE: 'glide',
  HOVER: 'hover',
});

export const DEATH_ANIMATION = Object.freeze({
  EXPLODE: 'explode',
  SPIN_OUT: 'spin-out',
});

export const IDLE_ANIMATION = Object.freeze({
  STILL: 'still',
  HOVER: 'hover',
});

export const EFFECT_TYPE = Object.freeze({
  HEAL: 'heal',
  HEALTH_LOSS: 'health-loss',
  TEXT: 'text',
  RANGED: 'ranged',
  MELEE: 'melee',
  EXPLOSION: 'explosion',
  DEATH: 'death',
});

export const COMBAT_EVENT = Object.freeze({
  BATTLE_STARTED: 'battle-started',
  UNIT_HEALED: 'unit-healed',
  UNIT_ATTACKED: 'unit-attacked',
  UNIT_DODGED: 'unit-dodged',
  UNIT_PUSHED: 'unit-pushed',
  SPLASH_HIT: 'splash-hit',
  UNIT_DETONATED: 'unit-detonated',
  UNIT_BREACHED: 'unit-breached',
  BASE_ATTACKED: 'base-attacked',
  UNIT_DESTROYED: 'unit-destroyed',
  BATTLE_FINISHED: 'battle-finished',
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
