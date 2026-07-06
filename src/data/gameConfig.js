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

export const UNIT_TAG = Object.freeze({
  GO_AROUND: 'go-around',
  STATIONARY: 'stationary',
  ATTACK_SIDEWAYS: 'attack-sideways',
  ATTACK_RADIUS: 'attack-radius',
  STEALTH: 'stealth',
  AI_ONLY: 'ai-only',
  FLYING: 'flying',
});

export const UNIT_ROLE = Object.freeze({
  TROOPER: 'trooper',
  SUPPORT: 'support',
  STRUCTURE: 'structure',
});

const unit = (definition) => {
  const tags = new Set(definition.tags ?? []);
  if (definition.role === UNIT_ROLE.STRUCTURE) {
    tags.add(UNIT_TAG.STATIONARY);
    tags.add(UNIT_TAG.AI_ONLY);
  }
  return Object.freeze({ ...definition, tags: Object.freeze([...tags]) });
};

export const UNIT_TYPES = Object.freeze({
  grunt: unit({ key: 'grunt', name: 'Ivan', role: UNIT_ROLE.TROOPER, cost: 20, hp: 40, attack: 10, range: 1, moveInterval: 1, behavior: 'A dependable lane fighter who stops behind anything in his way.', shape: 'square' }),
  tank: unit({ key: 'tank', name: 'Big Mabel', role: UNIT_ROLE.TROOPER, cost: 40, hp: 100, attack: 15, range: 1, moveInterval: 2, behavior: 'A slow armored wall with a very persuasive wrench.', shape: 'hex' }),
  sniper: unit({ key: 'sniper', name: 'Long-Eyed Larry', role: UNIT_ROLE.TROOPER, cost: 30, hp: 20, attack: 14, range: 4, moveInterval: 2, behavior: 'Picks off distant targets, provided they stay in his lane.', shape: 'triangle' }),
  bomber: unit({ key: 'bomber', name: 'Pop-Rocket Pete', role: UNIT_ROLE.TROOPER, cost: 25, hp: 25, attack: 26, range: 1, onAttack: 'detonate', moveInterval: 1, behavior: 'Detonates on contact and splashes every adjacent foe.', shape: 'diamond' }),
  healer: unit({ key: 'healer', name: 'Nurse Hex', role: UNIT_ROLE.SUPPORT, cost: 25, hp: 30, attack: 0, range: 2, healAmount: 9, action: 'heal', moveInterval: 1, tags: [UNIT_TAG.ATTACK_RADIUS], behavior: 'Repairs the nearest damaged ally in any direction.', shape: 'circle' }),
  sidestepper: unit({ key: 'sidestepper', name: 'Sidewinder Sid', role: UNIT_ROLE.TROOPER, cost: 28, hp: 34, attack: 9, range: 2, moveInterval: 1, tags: [UNIT_TAG.GO_AROUND, UNIT_TAG.ATTACK_SIDEWAYS], behavior: 'Slips around blockers and can strike into neighboring lanes.', shape: 'chevron' }),
  infiltrator: unit({ key: 'infiltrator', name: 'Sneaky Rita', role: UNIT_ROLE.TROOPER, cost: 34, hp: 24, attack: 13, range: 1, moveInterval: 1, tags: [UNIT_TAG.GO_AROUND, UNIT_TAG.STEALTH], behavior: 'Transparent and untargetable until an enemy gets adjacent.', shape: 'kite' }),
  flyer: unit({ key: 'flyer', name: 'Buzzby', role: UNIT_ROLE.TROOPER, cost: 36, hp: 28, attack: 11, range: 2, moveInterval: 1, tags: [UNIT_TAG.FLYING, UNIT_TAG.ATTACK_SIDEWAYS], behavior: 'Hops over occupied cells and peppers nearby lanes.', shape: 'wing' }),
  mortar: unit({ key: 'mortar', name: 'Mortar Myrtle', role: UNIT_ROLE.TROOPER, cost: 42, hp: 26, attack: 18, range: 3, moveInterval: 2, tags: [UNIT_TAG.ATTACK_RADIUS], behavior: 'Lobs shells at targets anywhere within her circular reach.', shape: 'star' }),
  tollbooth: unit({ key: 'tollbooth', name: 'Tollbooth Tony', role: UNIT_ROLE.STRUCTURE, cost: 35, hp: 85, attack: 8, range: 1, moveInterval: 1, behavior: 'An enemy-only roadblock that collects payment in dents.', shape: 'octagon' }),
  sentry: unit({ key: 'sentry', name: 'Auntie Flak', role: UNIT_ROLE.STRUCTURE, cost: 50, hp: 55, attack: 12, range: 3, moveInterval: 1, tags: [UNIT_TAG.ATTACK_RADIUS], behavior: 'An enemy-only stationary turret with all-around coverage.', shape: 'burst' }),
});

export const hasUnitTag = (typeOrKey, tag) => {
  const type = typeof typeOrKey === 'string' ? UNIT_TYPES[typeOrKey] : typeOrKey;
  return Boolean(type?.tags.includes(tag));
};

export const PLAYER_UNIT_TYPES = Object.freeze(
  Object.values(UNIT_TYPES).filter((type) => !hasUnitTag(type, UNIT_TAG.AI_ONLY)),
);

export const ENEMY_UNIT_TYPES = Object.freeze(Object.values(UNIT_TYPES));

export const TEAM = Object.freeze({ PLAYER: 'player', ENEMY: 'enemy' });
export const MODE = Object.freeze({ DEPLOY: 'deploy', BATTLE: 'battle' });
