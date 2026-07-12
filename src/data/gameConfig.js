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
  missionCount: 7,
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
  startingDraftBudget: 120,
  draftBudgetStep: 40,
  draftBudgetTaper: 2,
  minTechLevel: 1,
  maxTechLevel: 3,
  techWeightFloor: 0.015,
  techWeightSigma: 0.85,
  playerZone: Object.freeze([0, 1, 2, 3, 4, 5, 6]),
  enemyZone: Object.freeze([7, 8, 9, 10, 11, 12, 13]),
});

export const UNIT_TAG = Object.freeze({
  AGILE: 'agile', STATIONARY: 'stationary', SWIVEL: 'swivel', FAST_ATTACK: 'fast-attack', STEALTH: 'stealth', AI_ONLY: 'ai-only', PLAYER_ONLY: 'player-only', FLYING: 'flying', ANTI_AIR: 'anti-air', BOMB: 'bomb', AOE: 'aoe', HEAL: 'heal', SHIELD: 'shield', ENHANCE: 'enhance', LEADER: 'leader', STUN: 'stun', JAMMER: 'jammer', SALVO: 'salvo', PUSH: 'push', RAM: 'ram', CHARGE: 'charge', RELOAD: 'reload', FORMATION: 'formation', THORNS: 'thorns', FACTORY: 'factory', SCATTER: 'scatter', CLEAVE: 'cleave',
});

export const AURA_EFFECT = Object.freeze({ SHIELD: 'shield', DAMAGE: 'damage', STUN: 'stun', STEALTH: 'stealth' });
export const UNIT_ROLE = Object.freeze({ MELEE: 'melee', RANGED: 'ranged', SUPPORT: 'support', FLYING: 'flying', SPECIALIST: 'specialist', WALL: 'wall', STRUCTURE: 'structure' });
export const ROLE_SHAPE = Object.freeze({ [UNIT_ROLE.MELEE]: 'square', [UNIT_ROLE.RANGED]: 'triangle', [UNIT_ROLE.SUPPORT]: 'circle', [UNIT_ROLE.FLYING]: 'wing', [UNIT_ROLE.SPECIALIST]: 'diamond', [UNIT_ROLE.WALL]: 'rectangle', [UNIT_ROLE.STRUCTURE]: 'hex' });

const DEFAULT_ANIMATION = Object.freeze({ attack: ATTACK_ANIMATION.MELEE, movement: MOVEMENT_ANIMATION.MARCH, death: DEATH_ANIMATION.EXPLODE, idle: IDLE_ANIMATION.STILL });
const FLYING_ANIMATION = Object.freeze({ movement: MOVEMENT_ANIMATION.HOVER, death: DEATH_ANIMATION.SPIN_OUT, idle: IDLE_ANIMATION.HOVER });
const STATIONARY_ANIMATION = Object.freeze({ movement: MOVEMENT_ANIMATION.GLIDE, idle: IDLE_ANIMATION.STILL });

function attackAnimationFor(definition, tags) {
  if (definition.attack <= 0) return DEFAULT_ANIMATION.attack;
  if (tags.has(UNIT_TAG.STUN)) return ATTACK_ANIMATION.LIGHTNING;
  if (tags.has(UNIT_TAG.SALVO) || tags.has(UNIT_TAG.RELOAD)) return ATTACK_ANIMATION.MISSILE;
  if (definition.range > 1) return tags.has(UNIT_TAG.SWIVEL) ? ATTACK_ANIMATION.LOB : ATTACK_ANIMATION.LASER;
  return DEFAULT_ANIMATION.attack;
}

const unit = (definition) => {
  const tags = new Set(definition.tags ?? []);
  const techLevel = definition.techLevel;
  if (!Number.isInteger(techLevel) || techLevel < GAME_CONFIG.minTechLevel || techLevel > GAME_CONFIG.maxTechLevel) throw new Error(`Unit "${definition.key}" must define a tech level from ${GAME_CONFIG.minTechLevel} to ${GAME_CONFIG.maxTechLevel}.`);
  if (definition.role === UNIT_ROLE.MELEE && definition.range !== 1) throw new Error(`Melee unit "${definition.key}" must have range 1.`);
  if (definition.role === UNIT_ROLE.WALL && definition.attack > 0) throw new Error(`Wall unit "${definition.key}" must not have an attack value.`);
  if (definition.role === UNIT_ROLE.STRUCTURE && definition.attack <= 0 && !tags.has(UNIT_TAG.FACTORY)) throw new Error(`Structure unit "${definition.key}" must have an attack value unless it produces units.`);
  if (definition.role === UNIT_ROLE.FLYING) tags.add(UNIT_TAG.FLYING);
  if (tags.has(UNIT_TAG.FLYING) && definition.role !== UNIT_ROLE.FLYING) throw new Error(`Flying unit "${definition.key}" must use the Flying role.`);
  if (definition.role === UNIT_ROLE.STRUCTURE || definition.role === UNIT_ROLE.WALL) { tags.add(UNIT_TAG.STATIONARY); tags.add(UNIT_TAG.AI_ONLY); }
  if (tags.has(UNIT_TAG.FLYING)) { tags.delete(UNIT_TAG.FAST_ATTACK); tags.delete(UNIT_TAG.AGILE); }
  const campaign = Object.freeze({ unlockMission: 0, initialWeight: 0, weightGrowth: 0, ...(definition.campaign ?? {}) });
  const animation = Object.freeze({ ...DEFAULT_ANIMATION, ...(tags.has(UNIT_TAG.FLYING) ? FLYING_ANIMATION : {}), ...(tags.has(UNIT_TAG.STATIONARY) ? STATIONARY_ANIMATION : {}), ...(definition.animation ?? {}), attack: definition.animation?.attack ?? attackAnimationFor(definition, tags) });
  const aura = definition.aura ? Object.freeze({ ...definition.aura }) : undefined;
  const production = definition.production ? Object.freeze({ ...definition.production }) : undefined;
  const thorns = definition.thorns ? Object.freeze({ ...definition.thorns }) : undefined;
  return Object.freeze({ ...definition, techLevel, aura, production, thorns, shape: ROLE_SHAPE[definition.role] ?? 'square', animation, campaign, tags: Object.freeze([...tags]) });
};

export const UNIT_TYPES = Object.freeze({
  grunt: unit({ key: 'grunt', name: 'Grunt', role: UNIT_ROLE.MELEE, techLevel: 1, cost: 20, hp: 42, attack: 9, range: 1, campaign: { unlockMission: 0, initialWeight: 0.5, weightGrowth: 0.005 }, behavior: 'A dependable melee fighter who stops behind anything in the way.', graphic: 'grunt' }),
  swarmer: unit({ key: 'swarmer', name: 'Swarmer', role: UNIT_ROLE.MELEE, techLevel: 1, cost: 9, hp: 18, attack: 4, range: 1, campaign: { unlockMission: 0, initialWeight: 0.28, weightGrowth: 0.01 }, behavior: 'A very cheap melee fighter that relies on numbers instead of durability or damage.', graphic: 'swarmer' }),
  skitter: unit({ key: 'skitter', name: 'Skitter', role: UNIT_ROLE.MELEE, techLevel: 1, cost: 12, hp: 24, attack: 5, range: 1, tags: [UNIT_TAG.SCATTER, UNIT_TAG.AI_ONLY], campaign: { unlockMission: 99, initialWeight: 0 }, behavior: 'A weak factory-spawned fighter that scatters into an open side lane when blocked.', graphic: 'skitter' }),
  samurai: unit({ key: 'samurai', name: 'Samurai', role: UNIT_ROLE.MELEE, techLevel: 2, cost: 27, hp: 38, attack: 15, range: 1, tags: [UNIT_TAG.SWIVEL], campaign: { unlockMission: 2, initialWeight: 0.16, weightGrowth: 0.03 }, behavior: 'A disciplined melee fighter that hits very hard and can pivot toward targets in nearby lanes.', graphic: 'rifleman' }),
  reaper: unit({ key: 'reaper', name: 'Reaper', role: UNIT_ROLE.MELEE, techLevel: 2, cost: 34, hp: 46, attack: 12, range: 1, tags: [UNIT_TAG.CLEAVE], campaign: { unlockMission: 2, initialWeight: 0.16, weightGrowth: 0.03 }, behavior: 'A broad-swinging melee fighter whose attacks also cut enemies immediately beside its target.', graphic: 'reaper' }),
  pike: unit({ key: 'pike', name: 'Pike', role: UNIT_ROLE.MELEE, techLevel: 2, cost: 34, hp: 86, attack: 6, range: 1, tags: [UNIT_TAG.FORMATION], campaign: { unlockMission: 2, initialWeight: 0.17, weightGrowth: 0.03 }, behavior: 'A heavily protected formation fighter with very high durability and deliberately low attack power.', graphic: 'pike' }),
  gunner: unit({ key: 'gunner', name: 'Gunner', role: UNIT_ROLE.RANGED, techLevel: 1, cost: 26, hp: 30, attack: 9, range: 2, tags: [UNIT_TAG.ANTI_AIR], campaign: { unlockMission: 0, initialWeight: 0.24, weightGrowth: 0.035 }, behavior: 'A short-range automatic gunner able to engage both ground and flying targets.', graphic: 'gunner' }),
  archer: unit({ key: 'archer', name: 'Archer', role: UNIT_ROLE.RANGED, techLevel: 1, cost: 15, hp: 18, attack: 8, range: 3, tags: [UNIT_TAG.RELOAD], campaign: { unlockMission: 0, initialWeight: 0.28, weightGrowth: 0.015 }, behavior: 'A cheap mid-range attacker that fires a useful shot, then spends two turns reloading.', graphic: 'archer' }),
  tank: unit({ key: 'tank', name: 'Bulwark', role: UNIT_ROLE.MELEE, techLevel: 2, cost: 42, hp: 110, attack: 14, range: 1, campaign: { unlockMission: 1, initialWeight: 0.16, weightGrowth: 0.04 }, behavior: 'A heavily armored front-line unit built to hold a lane.', graphic: 'bulwark' }),
  dozer: unit({ key: 'dozer', name: 'Dozer', role: UNIT_ROLE.SPECIALIST, techLevel: 2, cost: 30, hp: 64, attack: 0, range: 1, tags: [UNIT_TAG.PUSH, UNIT_TAG.PLAYER_ONLY], campaign: { unlockMission: 0, initialWeight: 0.13, weightGrowth: 0.035 }, behavior: 'Pushes an adjacent enemy backward and advances into the space it leaves.', graphic: 'dozer' }),
  ram: unit({ key: 'ram', name: 'Ram', role: UNIT_ROLE.SPECIALIST, techLevel: 2, cost: 27, hp: 52, attack: 8, range: 1, tags: [UNIT_TAG.RAM, UNIT_TAG.PLAYER_ONLY], campaign: { unlockMission: 1, initialWeight: 0.14, weightGrowth: 0.03 }, behavior: 'Smashes enemy walls by moving into them, and can still make a basic melee attack when blocked by other units.', graphic: 'ram' }),
  lancer: unit({ key: 'lancer', name: 'Lancer', role: UNIT_ROLE.MELEE, techLevel: 2, cost: 32, hp: 42, attack: 13, range: 1, tags: [UNIT_TAG.CHARGE], campaign: { unlockMission: 2, initialWeight: 0.22, weightGrowth: 0.04 }, behavior: 'Moves at double speed until its first attack, which deals double attack damage.', graphic: 'lancer' }),
  phalanx: unit({ key: 'phalanx', name: 'Phalanx', role: UNIT_ROLE.MELEE, techLevel: 2, cost: 35, hp: 64, attack: 10, range: 1, tags: [UNIT_TAG.FORMATION], campaign: { unlockMission: 3, initialWeight: 0.16, weightGrowth: 0.03 }, behavior: 'Advances only when every allied Formation unit can move with it.', graphic: 'phalanx' }),
  commander: unit({ key: 'commander', name: 'Commander', role: UNIT_ROLE.MELEE, techLevel: 3, cost: 72, hp: 108, attack: 18, range: 1, aura: { effect: AURA_EFFECT.DAMAGE, range: 2, value: 3 }, tags: [UNIT_TAG.ENHANCE, UNIT_TAG.LEADER], campaign: { unlockMission: 5, initialWeight: 0.08, weightGrowth: 0.018 }, behavior: 'An elite melee leader with heavy front-line stats who amplifies nearby allied attacks and makes allied ground units advance in Formation. Multiple damage boosts do not stack.', graphic: 'commander' }),
  sniper: unit({ key: 'sniper', name: 'Sniper', role: UNIT_ROLE.RANGED, techLevel: 1, cost: 31, hp: 20, attack: 12, range: 4, campaign: { unlockMission: 0, initialWeight: 0.2, weightGrowth: 0.035 }, behavior: 'Engages distant ground targets that remain in the same lane.', graphic: 'marksman' }),
  fusilier: unit({ key: 'fusilier', name: 'Fusilier', role: UNIT_ROLE.RANGED, techLevel: 2, cost: 34, hp: 30, attack: 10, range: 3, tags: [UNIT_TAG.FORMATION], campaign: { unlockMission: 3, initialWeight: 0.14, weightGrowth: 0.03 }, behavior: 'A formation rifle unit that stays in lock step with allied Formation units.', graphic: 'fusilier' }),
  needler: unit({ key: 'needler', name: 'Needler', role: UNIT_ROLE.RANGED, techLevel: 2, cost: 32, hp: 22, attack: 5, range: 3, tags: [UNIT_TAG.SALVO], campaign: { unlockMission: 3, initialWeight: 0.16, weightGrowth: 0.03 }, behavior: 'A fragile ranged unit that sprays low-damage shots at every valid enemy in its lane.', graphic: 'needler' }),
  hydra: unit({ key: 'hydra', name: 'Hydra', role: UNIT_ROLE.RANGED, techLevel: 3, cost: 50, hp: 24, attack: 6, range: 3, tags: [UNIT_TAG.SALVO, UNIT_TAG.SWIVEL], campaign: { unlockMission: 5, initialWeight: 0.1, weightGrowth: 0.022 }, behavior: 'A late-tech multi-headed gun that swivels across lanes and fires low-damage shots at every valid enemy in range.', graphic: 'hydra' }),
  flak: unit({ key: 'flak', name: 'Flak', role: UNIT_ROLE.RANGED, techLevel: 2, cost: 34, hp: 26, attack: 13, range: 3, tags: [UNIT_TAG.ANTI_AIR, UNIT_TAG.SWIVEL], campaign: { unlockMission: 3, initialWeight: 0.18, weightGrowth: 0.035 }, behavior: 'An anti-air ranged unit that can swivel toward flying targets in nearby lanes.', graphic: 'flak' }),
  bertha: unit({ key: 'bertha', name: 'Bertha', role: UNIT_ROLE.RANGED, techLevel: 3, cost: 54, hp: 26, attack: 32, range: 5, tags: [UNIT_TAG.AOE, UNIT_TAG.RELOAD, UNIT_TAG.SWIVEL], campaign: { unlockMission: 5, initialWeight: 0.1, weightGrowth: 0.025 }, behavior: 'Fires a powerful long-range blast that damages nearby enemies, then reloads for two turns.', graphic: 'bertha' }),
  bomber: unit({ key: 'bomber', name: 'Demolisher', role: UNIT_ROLE.SPECIALIST, techLevel: 2, cost: 30, hp: 24, attack: 46, range: 1, tags: [UNIT_TAG.BOMB, UNIT_TAG.AOE], campaign: { unlockMission: 2, initialWeight: 0.2, weightGrowth: 0.04 }, behavior: 'Detonates at its own position when it attacks, breaches, or is destroyed.', graphic: 'demolisher' }),
  healer: unit({ key: 'healer', name: 'Medic', role: UNIT_ROLE.SUPPORT, techLevel: 2, cost: 23, hp: 32, attack: 0, range: 2, healAmount: 12, action: UNIT_ACTION.HEAL, tags: [UNIT_TAG.HEAL, UNIT_TAG.SWIVEL], campaign: { unlockMission: 3, initialWeight: 0.14, weightGrowth: 0.03 }, behavior: 'Repairs the nearest damaged ally within range, regardless of lane.', graphic: 'medic' }),
  shieldGenerator: unit({ key: 'shieldGenerator', name: 'Aegis', role: UNIT_ROLE.SUPPORT, techLevel: 2, cost: 35, hp: 40, attack: 0, range: 2, aura: { effect: AURA_EFFECT.SHIELD, range: 2, value: 4 }, tags: [UNIT_TAG.SHIELD], campaign: { unlockMission: 3, initialWeight: 0.13, weightGrowth: 0.025 }, behavior: 'Reduces every hit against friendly units within two cells by 4 damage. Multiple shield fields do not stack.', graphic: 'aegis' }),
  amplifier: unit({ key: 'amplifier', name: 'Amplifier', role: UNIT_ROLE.SUPPORT, techLevel: 3, cost: 30, hp: 28, attack: 0, range: 2, aura: { effect: AURA_EFFECT.DAMAGE, range: 2, value: 3 }, tags: [UNIT_TAG.ENHANCE], campaign: { unlockMission: 5, initialWeight: 0.12, weightGrowth: 0.025 }, behavior: 'Adds 3 damage to attacks made by friendly units within two cells. Multiple amplifiers do not stack.', graphic: 'amplifier' }),
  disruptor: unit({ key: 'disruptor', name: 'Disruptor', role: UNIT_ROLE.SUPPORT, techLevel: 3, cost: 40, hp: 28, attack: 4, range: 3, tags: [UNIT_TAG.STUN, UNIT_TAG.SALVO, UNIT_TAG.SWIVEL], campaign: { unlockMission: 5, initialWeight: 0.1, weightGrowth: 0.02 }, behavior: 'Fires lightning at every valid enemy within range. Each hit stuns its target for two turns.', graphic: 'disruptor' }),
  jammer: unit({ key: 'jammer', name: 'Jammer', role: UNIT_ROLE.SUPPORT, techLevel: 3, cost: 32, hp: 26, attack: 0, range: 2, aura: { effect: AURA_EFFECT.STEALTH, range: 2, value: 1 }, tags: [UNIT_TAG.JAMMER], campaign: { unlockMission: 5, initialWeight: 0.11, weightGrowth: 0.025 }, behavior: 'Cloaks friendly units within two cells. Cloaked units can still be targeted by adjacent enemies.', graphic: 'jammer' }),
  sidestepper: unit({ key: 'sidestepper', name: 'Ranger', role: UNIT_ROLE.SPECIALIST, techLevel: 2, cost: 25, hp: 34, attack: 9, range: 2, tags: [UNIT_TAG.AGILE, UNIT_TAG.SWIVEL], campaign: { unlockMission: 2, initialWeight: 0.2, weightGrowth: 0.04 }, behavior: 'Dodges the first attack by slipping into an open adjacent lane, and can swivel toward targets in other lanes.', graphic: 'ranger' }),
  infiltrator: unit({ key: 'infiltrator', name: 'Infiltrator', role: UNIT_ROLE.SPECIALIST, techLevel: 3, cost: 28, hp: 24, attack: 12, range: 1, tags: [UNIT_TAG.AGILE, UNIT_TAG.STEALTH], campaign: { unlockMission: 4, initialWeight: 0.16, weightGrowth: 0.03 }, behavior: 'Dodges the first attack by slipping into an open adjacent lane and remains untargetable until an enemy becomes adjacent.', graphic: 'infiltrator' }),
  midge: unit({ key: 'midge', name: 'Midge', role: UNIT_ROLE.FLYING, techLevel: 2, cost: 24, hp: 12, attack: 7, range: 1, campaign: { unlockMission: 4, initialWeight: 0.13, weightGrowth: 0.025 }, behavior: 'A nimble swarm flyer that slips through formations and pecks hard at targets in its lane.', graphic: 'midge' }),
  flyer: unit({ key: 'flyer', name: 'Wasp', role: UNIT_ROLE.FLYING, techLevel: 3, cost: 42, hp: 20, attack: 13, range: 2, tags: [UNIT_TAG.SWIVEL], campaign: { unlockMission: 5, initialWeight: 0.16, weightGrowth: 0.03 }, behavior: 'A flexible aerial skirmisher that advances through units and swivels toward nearby lanes.', graphic: 'wasp' }),
  kite: unit({ key: 'kite', name: 'Kite', role: UNIT_ROLE.FLYING, techLevel: 3, cost: 58, hp: 14, attack: 12, range: 4, tags: [UNIT_TAG.SALVO], campaign: { unlockMission: 5, initialWeight: 0.11, weightGrowth: 0.02 }, behavior: 'A fragile long-range flyer that fires on every valid enemy in range while continuously advancing.', graphic: 'kite' }),
  firefly: unit({ key: 'firefly', name: 'Firefly', role: UNIT_ROLE.FLYING, techLevel: 3, cost: 38, hp: 12, attack: 48, range: 1, tags: [UNIT_TAG.BOMB, UNIT_TAG.AOE, UNIT_TAG.SWIVEL], campaign: { unlockMission: 5, initialWeight: 0.12, weightGrowth: 0.025 }, behavior: 'A disposable flying charge that explodes at its own position on contact, breach, or destruction.', graphic: 'firefly' }),
  stormwing: unit({ key: 'stormwing', name: 'Stormwing', role: UNIT_ROLE.FLYING, techLevel: 3, cost: 48, hp: 14, attack: 4, range: 3, tags: [UNIT_TAG.STUN, UNIT_TAG.SALVO, UNIT_TAG.ANTI_AIR, UNIT_TAG.SWIVEL], campaign: { unlockMission: 5, initialWeight: 0.11, weightGrowth: 0.022 }, behavior: 'A flying anti-air disruptor that fires lightning at every valid ground and flying target within range. Each hit stuns its target for two turns.', graphic: 'stormwing' }),
  mortar: unit({ key: 'mortar', name: 'Arty', role: UNIT_ROLE.RANGED, techLevel: 2, cost: 39, hp: 24, attack: 17, range: 3, tags: [UNIT_TAG.SWIVEL], campaign: { unlockMission: 4, initialWeight: 0.14, weightGrowth: 0.03 }, behavior: 'Bombards ground targets within range by swiveling across lanes.', graphic: 'artillery' }),
  wall: unit({ key: 'wall', name: 'Wall', role: UNIT_ROLE.WALL, techLevel: 1, cost: 15, hp: 135, attack: 0, range: 1, campaign: { unlockMission: 0, initialWeight: 0 }, behavior: 'A blank enemy-only barrier that spends from the wall budget and simply blocks a lane.', graphic: 'blank' }),
  tollbooth: unit({ key: 'tollbooth', name: 'Barricade', role: UNIT_ROLE.WALL, techLevel: 2, cost: 35, hp: 180, attack: 0, range: 1, tags: [UNIT_TAG.THORNS], thorns: { reflectRatio: 0.5 }, campaign: { unlockMission: 2, initialWeight: 0.12, weightGrowth: 0.02 }, behavior: 'An enemy-only wall with exceptional durability that reflects half of melee damage back at attackers.', graphic: 'barricade' }),
  mine: unit({ key: 'mine', name: 'Mine', role: UNIT_ROLE.STRUCTURE, techLevel: 2, cost: 50, hp: 112, attack: 44, range: 1, tags: [UNIT_TAG.BOMB, UNIT_TAG.AOE], campaign: { unlockMission: 2, initialWeight: 0.12, weightGrowth: 0.025 }, behavior: 'An enemy-only explosive structure that detonates on contact or destruction and damages adjacent enemies.', graphic: 'mine' }),
  sentry: unit({ key: 'sentry', name: 'Turret', role: UNIT_ROLE.STRUCTURE, techLevel: 2, cost: 56, hp: 135, attack: 10, range: 3, tags: [UNIT_TAG.SWIVEL], campaign: { unlockMission: 3, initialWeight: 0.14, weightGrowth: 0.025 }, behavior: 'An enemy-only fortified weapon that swivels toward ground units in other lanes.', graphic: 'turret' }),
  flakTurret: unit({ key: 'flakTurret', name: 'Flak Turret', role: UNIT_ROLE.STRUCTURE, techLevel: 3, cost: 62, hp: 125, attack: 12, range: 3, tags: [UNIT_TAG.SWIVEL, UNIT_TAG.ANTI_AIR], campaign: { unlockMission: 4, initialWeight: 0.11, weightGrowth: 0.02 }, behavior: 'A fortified anti-air turret that can swivel toward aircraft and nearby lanes.', graphic: 'flak-turret' }),
  rocketTurret: unit({ key: 'rocketTurret', name: 'Rocket Turret', role: UNIT_ROLE.STRUCTURE, techLevel: 3, cost: 72, hp: 120, attack: 18, range: 4, tags: [UNIT_TAG.AOE, UNIT_TAG.RELOAD, UNIT_TAG.SWIVEL], campaign: { unlockMission: 5, initialWeight: 0.1, weightGrowth: 0.02 }, behavior: 'A slow enemy-only launcher that fires splash rockets across nearby lanes, then reloads.', graphic: 'rocket-turret' }),
  mortarNest: unit({ key: 'mortarNest', name: 'Mortar Nest', role: UNIT_ROLE.STRUCTURE, techLevel: 3, cost: 68, hp: 130, attack: 16, range: 5, tags: [UNIT_TAG.SWIVEL, UNIT_TAG.RELOAD], campaign: { unlockMission: 5, initialWeight: 0.09, weightGrowth: 0.02 }, behavior: 'A hardened back-line emplacement that lobs long-range shots, then reloads.', graphic: 'mortar-nest' }),
  railTurret: unit({ key: 'railTurret', name: 'Rail Turret', role: UNIT_ROLE.STRUCTURE, techLevel: 3, cost: 82, hp: 115, attack: 28, range: 5, tags: [UNIT_TAG.RELOAD], campaign: { unlockMission: 6, initialWeight: 0.07, weightGrowth: 0.018 }, behavior: 'A narrow-lane cannon with very high single-target damage, limited by reload time and fixed facing.', graphic: 'rail-turret' }),
  teslaCoil: unit({ key: 'teslaCoil', name: 'Tesla Coil', role: UNIT_ROLE.STRUCTURE, techLevel: 3, cost: 76, hp: 120, attack: 8, range: 2, tags: [UNIT_TAG.STUN, UNIT_TAG.SALVO, UNIT_TAG.SWIVEL, UNIT_TAG.ANTI_AIR], animation: { attack: ATTACK_ANIMATION.LIGHTNING }, campaign: { unlockMission: 5, initialWeight: 0.1, weightGrowth: 0.022 }, behavior: 'A close-defense coil that arcs low damage into every ground and flying target within range. Each hit stuns its target for two turns.', graphic: 'tesla-coil' }),
  factory: unit({ key: 'factory', name: 'Factory', role: UNIT_ROLE.STRUCTURE, techLevel: 3, cost: 74, hp: 165, attack: 0, range: 1, tags: [UNIT_TAG.FACTORY], production: { type: 'skitter', interval: 2 }, campaign: { unlockMission: 5, initialWeight: 0.08, weightGrowth: 0.018 }, behavior: 'A fortified enemy-only structure that produces a steady stream of weak Scatter infantry when the lane ahead is clear.', graphic: 'factory' }),
  hangar: unit({ key: 'hangar', name: 'Hangar', role: UNIT_ROLE.STRUCTURE, techLevel: 3, cost: 92, hp: 150, attack: 0, range: 1, tags: [UNIT_TAG.FACTORY], production: { type: 'midge', interval: 3 }, campaign: { unlockMission: 5, initialWeight: 0.07, weightGrowth: 0.018 }, behavior: 'A fortified enemy-only structure that launches a steady stream of Midges when the lane ahead is clear.', graphic: 'hangar' }),
});

function techProgress(missionIndex, missionCount = GAME_CONFIG.missionCount) {
  const safeMissionCount = Math.max(1, missionCount);
  return safeMissionCount === 1 ? 1 : Math.max(0, Math.min(1, missionIndex / (safeMissionCount - 1)));
}

export function techLevelForMission(missionIndex, missionCount = GAME_CONFIG.missionCount) {
  const center = GAME_CONFIG.minTechLevel + techProgress(missionIndex, missionCount) * (GAME_CONFIG.maxTechLevel - GAME_CONFIG.minTechLevel);
  return Math.max(GAME_CONFIG.minTechLevel, Math.min(GAME_CONFIG.maxTechLevel, Math.round(center)));
}

export function techLevelWeight(techLevel, missionIndex, missionCount = GAME_CONFIG.missionCount) {
  const center = GAME_CONFIG.minTechLevel + techProgress(missionIndex, missionCount) * (GAME_CONFIG.maxTechLevel - GAME_CONFIG.minTechLevel);
  const distance = techLevel - center;
  const curve = Math.exp(-(distance * distance) / (2 * GAME_CONFIG.techWeightSigma * GAME_CONFIG.techWeightSigma));
  return GAME_CONFIG.techWeightFloor + curve;
}

export function unitTechWeight(type, missionIndex, missionCount = GAME_CONFIG.missionCount) {
  return techLevelWeight(type.techLevel, missionIndex, missionCount);
}

export const hasUnitTag = (typeOrKey, tag) => { const type = typeof typeOrKey === 'string' ? UNIT_TYPES[typeOrKey] : typeOrKey; return Boolean(type?.tags.includes(tag)); };
export const PLAYER_UNIT_TYPES = Object.freeze(Object.values(UNIT_TYPES).filter((type) => !hasUnitTag(type, UNIT_TAG.AI_ONLY)));
export const ENEMY_UNIT_TYPES = Object.freeze(Object.values(UNIT_TYPES).filter((type) => !hasUnitTag(type, UNIT_TAG.PLAYER_ONLY)));
export const TEAM = Object.freeze({ PLAYER: 'player', ENEMY: 'enemy' });
export const MODE = Object.freeze({ DEPLOY: 'deploy', BATTLE: 'battle' });