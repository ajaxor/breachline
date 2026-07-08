import {
  ATTACK_ANIMATION,
  DEATH_ANIMATION,
  IDLE_ANIMATION,
  MOVEMENT_ANIMATION,
  UNIT_ACTION,
} from './gameTypes.js';

export const GAME_CONFIG = Object.freeze({
  columns: 14,
  rows: 8,
  baseHp: 150,
  missionCount: 10,
  tickIntervalMs: 600,
  maxLogEntries: 250,
  startingBudget: 200,
  budgetStep: 25,
  enemyBudgetBonus: 20,
  enemyBudgetStep: 10,
  wallBudgetBase: 60,
  wallBudgetStep: 20,
  structureBudgetBase: 80,
  structureBudgetStep: 40,
  startingDraftBudget: 100,
  draftBudgetStep: 40,
  playerZone: Object.freeze([0, 1, 2, 3, 4, 5, 6]),
  enemyZone: Object.freeze([7, 8, 9, 10, 11, 12, 13]),
});

export const UNIT_TAG = Object.freeze({
  AGILE: 'agile', STATIONARY: 'stationary', SWIVEL: 'swivel', FAST_ATTACK: 'fast-attack', STEALTH: 'stealth', AI_ONLY: 'ai-only', FLYING: 'flying', ANTI_AIR: 'anti-air', BOMB: 'bomb', AOE: 'aoe', HEAL: 'heal', SHIELD: 'shield', ENHANCE: 'enhance', STUN_FIELD: 'stun-field', JAMMER: 'jammer', SALVO: 'salvo', PUSH: 'push', CHARGE: 'charge', RELOAD: 'reload', FORMATION: 'formation', THORNS: 'thorns', FACTORY: 'factory', SCATTER: 'scatter',
});

export const AURA_EFFECT = Object.freeze({ SHIELD: 'shield', DAMAGE: 'damage', STUN: 'stun', STEALTH: 'stealth' });
export const UNIT_ROLE = Object.freeze({ MELEE: 'melee', RANGED: 'ranged', SUPPORT: 'support', FLYING: 'flying', SPECIALIST: 'specialist', WALL: 'wall', STRUCTURE: 'structure' });
export const ROLE_SHAPE = Object.freeze({ [UNIT_ROLE.MELEE]: 'square', [UNIT_ROLE.RANGED]: 'triangle', [UNIT_ROLE.SUPPORT]: 'circle', [UNIT_ROLE.FLYING]: 'wing', [UNIT_ROLE.SPECIALIST]: 'diamond', [UNIT_ROLE.WALL]: 'rectangle', [UNIT_ROLE.STRUCTURE]: 'hex' });

const DEFAULT_ANIMATION = Object.freeze({ attack: ATTACK_ANIMATION.MELEE, movement: MOVEMENT_ANIMATION.MARCH, death: DEATH_ANIMATION.EXPLODE, idle: IDLE_ANIMATION.STILL });
const FLYING_ANIMATION = Object.freeze({ attack: ATTACK_ANIMATION.LASER, movement: MOVEMENT_ANIMATION.HOVER, death: DEATH_ANIMATION.SPIN_OUT, idle: IDLE_ANIMATION.HOVER });
const STATIONARY_ANIMATION = Object.freeze({ movement: MOVEMENT_ANIMATION.GLIDE, idle: IDLE_ANIMATION.STILL });

const unit = (definition) => {
  const tags = new Set(definition.tags ?? []);
  if (definition.role === UNIT_ROLE.MELEE && definition.range !== 1) throw new Error(`Melee unit "${definition.key}" must have range 1.`);
  if (definition.role === UNIT_ROLE.WALL && definition.attack > 0) throw new Error(`Wall unit "${definition.key}" must not have an attack value.`);
  if (definition.role === UNIT_ROLE.STRUCTURE && definition.attack <= 0 && !tags.has(UNIT_TAG.FACTORY)) throw new Error(`Structure unit "${definition.key}" must have an attack value unless it produces units.`);
  if (definition.role === UNIT_ROLE.FLYING) tags.add(UNIT_TAG.FLYING);
  if (tags.has(UNIT_TAG.FLYING) && definition.role !== UNIT_ROLE.FLYING) throw new Error(`Flying unit "${definition.key}" must use the Flying role.`);
  if (definition.role === UNIT_ROLE.STRUCTURE || definition.role === UNIT_ROLE.WALL) { tags.add(UNIT_TAG.STATIONARY); tags.add(UNIT_TAG.AI_ONLY); }
  if (tags.has(UNIT_TAG.FLYING)) { tags.delete(UNIT_TAG.FAST_ATTACK); tags.delete(UNIT_TAG.AGILE); }
  const campaign = Object.freeze({ unlockMission: 0, initialWeight: 0, weightGrowth: 0, ...(definition.campaign ?? {}) });
  const animation = Object.freeze({ ...DEFAULT_ANIMATION, ...(tags.has(UNIT_TAG.FLYING) ? FLYING_ANIMATION : {}), ...(tags.has(UNIT_TAG.STATIONARY) ? STATIONARY_ANIMATION : {}), ...(definition.animation ?? {}) });
  const aura = definition.aura ? Object.freeze({ ...definition.aura }) : undefined;
  const production = definition.production ? Object.freeze({ ...definition.production }) : undefined;
  const thorns = definition.thorns ? Object.freeze({ ...definition.thorns }) : undefined;
  return Object.freeze({ ...definition, aura, production, thorns, shape: ROLE_SHAPE[definition.role] ?? 'square', animation, campaign, tags: Object.freeze([...tags]) });
};

export const UNIT_TYPES = Object.freeze({
  grunt: unit({ key: 'grunt', name: 'Grunt', role: UNIT_ROLE.MELEE, cost: 20, hp: 42, attack: 9, range: 1, campaign: { unlockMission: 0, initialWeight: 0.55, weightGrowth: 0.01 }, behavior: 'A dependable melee fighter who stops behind anything in the way.', graphic: 'rifleman' }),
  skitter: unit({ key: 'skitter', name: 'Skitter', role: UNIT_ROLE.MELEE, cost: 12, hp: 24, attack: 5, range: 1, tags: [UNIT_TAG.SCATTER, UNIT_TAG.AI_ONLY], campaign: { unlockMission: 99, initialWeight: 0 }, behavior: 'A weak factory-spawned fighter that scatters into an open side lane when blocked.', graphic: 'rifleman' }),
  gunner: unit({ key: 'gunner', name: 'Gunner', role: UNIT_ROLE.RANGED, cost: 26, hp: 30, attack: 9, range: 2, tags: [UNIT_TAG.ANTI_AIR], campaign: { unlockMission: 0, initialWeight: 0.24, weightGrowth: 0.035 }, behavior: 'A short-range automatic gunner able to engage both ground and flying targets.', graphic: 'gunner', animation: { attack: ATTACK_ANIMATION.LASER } }),
  tank: unit({ key: 'tank', name: 'Bulwark', role: UNIT_ROLE.MELEE, cost: 42, hp: 110, attack: 14, range: 1, campaign: { unlockMission: 1, initialWeight: 0.16, weightGrowth: 0.04 }, behavior: 'A heavily armored front-line unit built to hold a lane.', graphic: 'bulwark' }),
  ram: unit({ key: 'ram', name: 'Ram', role: UNIT_ROLE.SPECIALIST, cost: 30, hp: 64, attack: 0, range: 1, tags: [UNIT_TAG.PUSH], campaign: { unlockMission: 0, initialWeight: 0.13, weightGrowth: 0.035 }, behavior: 'Pushes an adjacent enemy backward and advances into the space it leaves.', graphic: 'ram' }),
  lancer: unit({ key: 'lancer', name: 'Lancer', role: UNIT_ROLE.MELEE, cost: 32, hp: 42, attack: 13, range: 1, tags: [UNIT_TAG.CHARGE], campaign: { unlockMission: 3, initialWeight: 0.22, weightGrowth: 0.04 }, behavior: 'Moves at double speed until its first attack, which deals double attack damage.', graphic: 'lancer' }),
  phalanx: unit({ key: 'phalanx', name: 'Phalanx', role: UNIT_ROLE.MELEE, cost: 35, hp: 64, attack: 10, range: 1, tags: [UNIT_TAG.FORMATION], campaign: { unlockMission: 4, initialWeight: 0.16, weightGrowth: 0.03 }, behavior: 'Advances only when every allied Formation unit can move with it.', graphic: 'phalanx' }),
  sniper: unit({ key: 'sniper', name: 'Marksman', role: UNIT_ROLE.RANGED, cost: 31, hp: 20, attack: 12, range: 4, campaign: { unlockMission: 0, initialWeight: 0.2, weightGrowth: 0.035 }, behavior: 'Engages distant ground targets that remain in the same lane.', graphic: 'marksman', animation: { attack: ATTACK_ANIMATION.LASER } }),
  fusilier: unit({ key: 'fusilier', name: 'Fusilier', role: UNIT_ROLE.RANGED, cost: 34, hp: 30, attack: 10, range: 3, tags: [UNIT_TAG.FORMATION], campaign: { unlockMission: 5, initialWeight: 0.14, weightGrowth: 0.03 }, behavior: 'A formation rifle unit that stays in lock step with allied Formation units.', graphic: 'fusilier', animation: { attack: ATTACK_ANIMATION.LASER } }),
  flak: unit({ key: 'flak', name: 'Flak', role: UNIT_ROLE.RANGED, cost: 34, hp: 26, attack: 13, range: 3, tags: [UNIT_TAG.ANTI_AIR, UNIT_TAG.SWIVEL], campaign: { unlockMission: 4, initialWeight: 0.18, weightGrowth: 0.035 }, behavior: 'An anti-air ranged unit that can swivel toward flying targets in nearby lanes.', graphic: 'flak', animation: { attack: ATTACK_ANIMATION.MISSILE } }),
  bertha: unit({ key: 'bertha', name: 'Bertha', role: UNIT_ROLE.RANGED, cost: 54, hp: 26, attack: 32, range: 5, tags: [UNIT_TAG.AOE, UNIT_TAG.RELOAD, UNIT_TAG.SWIVEL], campaign: { unlockMission: 6, initialWeight: 0.1, weightGrowth: 0.025 }, behavior: 'Fires a powerful long-range blast that damages nearby enemies, then reloads for two turns.', graphic: 'bertha', animation: { attack: ATTACK_ANIMATION.LOB } }),
  bomber: unit({ key: 'bomber', name: 'Demolisher', role: UNIT_ROLE.SPECIALIST, cost: 30, hp: 24, attack: 46, range: 1, tags: [UNIT_TAG.BOMB, UNIT_TAG.AOE], campaign: { unlockMission: 3, initialWeight: 0.2, weightGrowth: 0.04 }, behavior: 'Detonates at its own position when an enemy comes within range or when it is destroyed.', graphic: 'demolisher' }),
  healer: unit({ key: 'healer', name: 'Medic', role: UNIT_ROLE.SUPPORT, cost: 23, hp: 32, attack: 0, range: 2, healAmount: 12, action: UNIT_ACTION.HEAL, tags: [UNIT_TAG.HEAL, UNIT_TAG.SWIVEL], campaign: { unlockMission: 4, initialWeight: 0.14, weightGrowth: 0.03 }, behavior: 'Repairs the nearest damaged ally within range, regardless of lane.', graphic: 'medic' }),
  shieldGenerator: unit({ key: 'shieldGenerator', name: 'Aegis', role: UNIT_ROLE.SUPPORT, cost: 35, hp: 40, attack: 0, range: 2, aura: { effect: AURA_EFFECT.SHIELD, range: 2, value: 4 }, tags: [UNIT_TAG.SHIELD], campaign: { unlockMission: 5, initialWeight: 0.13, weightGrowth: 0.025 }, behavior: 'Reduces every hit against friendly units within two cells by 4 damage. Multiple shield fields do not stack.', graphic: 'aegis' }),
  amplifier: unit({ key: 'amplifier', name: 'Amplifier', role: UNIT_ROLE.SUPPORT, cost: 30, hp: 28, attack: 0, range: 2, aura: { effect: AURA_EFFECT.DAMAGE, range: 2, value: 3 }, tags: [UNIT_TAG.ENHANCE], campaign: { unlockMission: 6, initialWeight: 0.12, weightGrowth: 0.025 }, behavior: 'Adds 3 damage to attacks made by friendly units within two cells. Multiple amplifiers do not stack.', graphic: 'amplifier' }),
  disruptor: unit({ key: 'disruptor', name: 'Disruptor', role: UNIT_ROLE.SUPPORT, cost: 40, hp: 28, attack: 0, range: 2, aura: { effect: AURA_EFFECT.STUN, range: 2, value: 1 }, tags: [UNIT_TAG.STUN_FIELD], campaign: { unlockMission: 7, initialWeight: 0.1, weightGrowth: 0.02 }, behavior: 'Stuns enemy units across the same battlefield row for two turns. The stun lingers briefly after they leave the row.', graphic: 'disruptor' }),
  jammer: unit({ key: 'jammer', name: 'Jammer', role: UNIT_ROLE.SUPPORT, cost: 32, hp: 26, attack: 0, range: 2, aura: { effect: AURA_EFFECT.STEALTH, range: 2, value: 1 }, tags: [UNIT_TAG.JAMMER], campaign: { unlockMission: 7, initialWeight: 0.11, weightGrowth: 0.025 }, behavior: 'Cloaks friendly units within two cells. Cloaked units can still be targeted by adjacent enemies.', graphic: 'jammer' }),
  sidestepper: unit({ key: 'sidestepper', name: 'Ranger', role: UNIT_ROLE.SPECIALIST, cost: 25, hp: 34, attack: 9, range: 2, tags: [UNIT_TAG.AGILE, UNIT_TAG.SWIVEL], campaign: { unlockMission: 3, initialWeight: 0.2, weightGrowth: 0.04 }, behavior: 'Dodges the first attack by slipping into an open adjacent lane, and can swivel toward targets in other lanes.', graphic: 'ranger', animation: { attack: ATTACK_ANIMATION.LASER } }),
  infiltrator: unit({ key: 'infiltrator', name: 'Infiltrator', role: UNIT_ROLE.SPECIALIST, cost: 28, hp: 24, attack: 12, range: 1, tags: [UNIT_TAG.AGILE, UNIT_TAG.STEALTH], campaign: { unlockMission: 5, initialWeight: 0.16, weightGrowth: 0.03 }, behavior: 'Dodges the first attack by slipping into an open adjacent lane and remains untargetable until an enemy becomes adjacent.', graphic: 'infiltrator' }),
  midge: unit({ key: 'midge', name: 'Midge', role: UNIT_ROLE.FLYING, cost: 24, hp: 12, attack: 7, range: 1, campaign: { unlockMission: 5, initialWeight: 0.13, weightGrowth: 0.025 }, behavior: 'A nimble swarm flyer that slips through formations and pecks hard at targets in its lane.', graphic: 'midge' }),
  flyer: unit({ key: 'flyer', name: 'Wasp', role: UNIT_ROLE.FLYING, cost: 42, hp: 20, attack: 13, range: 2, tags: [UNIT_TAG.SWIVEL], campaign: { unlockMission: 6, initialWeight: 0.16, weightGrowth: 0.03 }, behavior: 'A flexible aerial skirmisher that advances through units and swivels toward nearby lanes.', graphic: 'wasp', animation: { attack: ATTACK_ANIMATION.MISSILE } }),
  kite: unit({ key: 'kite', name: 'Kite', role: UNIT_ROLE.FLYING, cost: 58, hp: 14, attack: 12, range: 4, tags: [UNIT_TAG.SALVO], campaign: { unlockMission: 7, initialWeight: 0.11, weightGrowth: 0.02 }, behavior: 'A fragile long-range flyer that fires on every valid target in range while continuously advancing.', graphic: 'kite' }),
  firefly: unit({ key: 'firefly', name: 'Firefly', role: UNIT_ROLE.FLYING, cost: 38, hp: 12, attack: 48, range: 1, tags: [UNIT_TAG.BOMB, UNIT_TAG.AOE, UNIT_TAG.SWIVEL], campaign: { unlockMission: 7, initialWeight: 0.12, weightGrowth: 0.025 }, behavior: 'A disposable flying charge that explodes at its own position on contact or destruction.', graphic: 'firefly' }),
  mortar: unit({ key: 'mortar', name: 'Artillery', role: UNIT_ROLE.RANGED, cost: 39, hp: 24, attack: 17, range: 3, tags: [UNIT_TAG.SWIVEL], campaign: { unlockMission: 7, initialWeight: 0.14, weightGrowth: 0.03 }, behavior: 'Bombards ground targets within range by swiveling across lanes.', graphic: 'artillery', animation: { attack: ATTACK_ANIMATION.LOB } }),
  wall: unit({ key: 'wall', name: 'Wall', role: UNIT_ROLE.WALL, cost: 15, hp: 135, attack: 0, range: 1, campaign: { unlockMission: 0, initialWeight: 0 }, behavior: 'A blank enemy-only barrier that spends from the wall budget and simply blocks a lane.', graphic: 'blank' }),
  tollbooth: unit({ key: 'tollbooth', name: 'Barricade', role: UNIT_ROLE.WALL, cost: 35, hp: 180, attack: 0, range: 1, tags: [UNIT_TAG.THORNS], thorns: { reflectRatio: 0.5 }, campaign: { unlockMission: 3, initialWeight: 0.12, weightGrowth: 0.02 }, behavior: 'An enemy-only wall with exceptional durability that reflects half of melee damage back at attackers.', graphic: 'barricade' }),
  sentry: unit({ key: 'sentry', name: 'Turret', role: UNIT_ROLE.STRUCTURE, cost: 56, hp: 135, attack: 10, range: 3, tags: [UNIT_TAG.SWIVEL], campaign: { unlockMission: 4, initialWeight: 0.14, weightGrowth: 0.025 }, behavior: 'An enemy-only fortified weapon that swivels toward ground units in other lanes.', graphic: 'turret', animation: { attack: ATTACK_ANIMATION.LASER } }),
  flakTurret: unit({ key: 'flakTurret', name: 'Flak Turret', role: UNIT_ROLE.STRUCTURE, cost: 62, hp: 125, attack: 12, range: 3, tags: [UNIT_TAG.SWIVEL, UNIT_TAG.ANTI_AIR], campaign: { unlockMission: 5, initialWeight: 0.11, weightGrowth: 0.02 }, behavior: 'A fortified anti-air turret that can swivel toward aircraft and nearby lanes.', graphic: 'flak-turret', animation: { attack: ATTACK_ANIMATION.MISSILE } }),
  rocketTurret: unit({ key: 'rocketTurret', name: 'Rocket Turret', role: UNIT_ROLE.STRUCTURE, cost: 72, hp: 120, attack: 18, range: 4, tags: [UNIT_TAG.AOE, UNIT_TAG.RELOAD, UNIT_TAG.SWIVEL], campaign: { unlockMission: 6, initialWeight: 0.1, weightGrowth: 0.02 }, behavior: 'A slow enemy-only launcher that fires splash rockets across nearby lanes, then reloads.', graphic: 'rocket-turret', animation: { attack: ATTACK_ANIMATION.MISSILE } }),
  mortarNest: unit({ key: 'mortarNest', name: 'Mortar Nest', role: UNIT_ROLE.STRUCTURE, cost: 68, hp: 130, attack: 16, range: 5, tags: [UNIT_TAG.SWIVEL, UNIT_TAG.RELOAD], campaign: { unlockMission: 7, initialWeight: 0.09, weightGrowth: 0.02 }, behavior: 'A hardened back-line emplacement that lobs long-range shots, then reloads.', graphic: 'mortar-nest', animation: { attack: ATTACK_ANIMATION.LOB } }),
  railTurret: unit({ key: 'railTurret', name: 'Rail Turret', role: UNIT_ROLE.STRUCTURE, cost: 82, hp: 115, attack: 28, range: 5, tags: [UNIT_TAG.RELOAD], campaign: { unlockMission: 8, initialWeight: 0.07, weightGrowth: 0.018 }, behavior: 'A narrow-lane cannon with very high single-target damage, limited by reload time and fixed facing.', graphic: 'rail-turret', animation: { attack: ATTACK_ANIMATION.LASER } }),
  factory: unit({ key: 'factory', name: 'Factory', role: UNIT_ROLE.STRUCTURE, cost: 74, hp: 165, attack: 0, range: 1, tags: [UNIT_TAG.FACTORY], production: { type: 'skitter', interval: 2 }, campaign: { unlockMission: 6, initialWeight: 0.08, weightGrowth: 0.018 }, behavior: 'A fortified enemy-only structure that produces a steady stream of weak Scatter infantry when the lane ahead is clear.', graphic: 'factory' }),
});

export const hasUnitTag = (typeOrKey, tag) => { const type = typeof typeOrKey === 'string' ? UNIT_TYPES[typeOrKey] : typeOrKey; return Boolean(type?.tags.includes(tag)); };
export const PLAYER_UNIT_TYPES = Object.freeze(Object.values(UNIT_TYPES).filter((type) => !hasUnitTag(type, UNIT_TAG.AI_ONLY)));
export const ENEMY_UNIT_TYPES = Object.freeze(Object.values(UNIT_TYPES));
export const TEAM = Object.freeze({ PLAYER: 'player', ENEMY: 'enemy' });
export const MODE = Object.freeze({ DEPLOY: 'deploy', BATTLE: 'battle' });
