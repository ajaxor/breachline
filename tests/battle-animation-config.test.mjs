import test from 'node:test';
import assert from 'node:assert/strict';

import { GAME_CONFIG, TEAM, UNIT_TYPES } from '../src/data/gameConfig.js';
import {
  ATTACK_ANIMATION,
  COMBAT_EVENT,
  DEATH_ANIMATION,
  EFFECT_TYPE,
  IDLE_ANIMATION,
} from '../src/data/gameTypes.js';
import { CombatEventPresenter } from '../src/frontend/CombatEventPresenter.js';

const battleUnit = (type, overrides = {}) => ({
  id: overrides.id ?? 1,
  type,
  team: overrides.team ?? TEAM.PLAYER,
  row: overrides.row ?? 3,
  column: overrides.column ?? 4,
  hp: overrides.hp ?? UNIT_TYPES[type].hp,
  maxHp: UNIT_TYPES[type].hp,
  ...overrides,
});

const presentationModel = () => ({
  effects: [],
  logs: [],
  addLog(message, type) {
    this.logs.push({ message, type });
  },
});

test('units expose complete animation profiles with flying defaults', () => {
  for (const definition of Object.values(UNIT_TYPES)) {
    assert.ok(definition.animation.attack);
    assert.ok(definition.animation.movement);
    assert.ok(definition.animation.death);
    assert.ok(definition.animation.idle);
  }
  assert.equal(UNIT_TYPES.flyer.animation.idle, IDLE_ANIMATION.HOVER);
  assert.equal(UNIT_TYPES.flyer.animation.death, DEATH_ANIMATION.SPIN_OUT);
  assert.equal(UNIT_TYPES.grunt.animation.death, DEATH_ANIMATION.EXPLODE);
});

test('attack effects carry each attacker configured style', () => {
  const presenter = new CombatEventPresenter();
  const styles = [
    ['sniper', ATTACK_ANIMATION.LASER],
    ['flak', ATTACK_ANIMATION.LOB],
    ['mortar', ATTACK_ANIMATION.LOB],
    ['bertha', ATTACK_ANIMATION.MISSILE],
  ];

  for (const [type, expectedStyle] of styles) {
    const model = presentationModel();
    presenter.present(model, {
      type: COMBAT_EVENT.UNIT_ATTACKED,
      at: 100,
      attacker: battleUnit(type),
      target: battleUnit('grunt', { id: 2, team: TEAM.ENEMY, column: 7, hp: 31 }),
      damage: 9,
      range: UNIT_TYPES[type].range,
    });
    const attack = model.effects.find((effect) => effect.type === EFFECT_TYPE.RANGED);
    assert.equal(attack.attackStyle, expectedStyle);
  }
});

test('melee flying attackers use projectile effects instead of lunging', () => {
  const presenter = new CombatEventPresenter();
  const model = presentationModel();
  presenter.present(model, {
    type: COMBAT_EVENT.UNIT_ATTACKED,
    at: 100,
    attacker: battleUnit('midge'),
    target: battleUnit('grunt', { id: 2, team: TEAM.ENEMY, column: 5, hp: 31 }),
    damage: 7,
    range: UNIT_TYPES.midge.range,
  });

  const attack = model.effects.find((effect) => effect.type === EFFECT_TYPE.RANGED);
  assert.ok(attack, 'flying melee attack should render as a projectile-style ranged effect');
  assert.equal(attack.attackStyle, ATTACK_ANIMATION.LASER);
  assert.equal(model.effects.some((effect) => effect.type === EFFECT_TYPE.MELEE), false);
});

test('detonations render an explosion across every in-bounds aoe tile', () => {
  const presenter = new CombatEventPresenter();
  const model = presentationModel();
  presenter.present(model, {
    type: COMBAT_EVENT.UNIT_DETONATED,
    at: 200,
    unit: battleUnit('bomber', { row: 3, column: 4 }),
  });

  const explosions = model.effects.filter((effect) => effect.type === EFFECT_TYPE.EXPLOSION);
  assert.equal(explosions.length, 9);
  assert.ok(explosions.some((effect) => effect.row === 2 && effect.column === 3));
  assert.ok(explosions.some((effect) => effect.row === 4 && effect.column === 5));
  assert.equal(model.effects.find((effect) => effect.type === EFFECT_TYPE.DEATH).deathStyle, DEATH_ANIMATION.EXPLODE);
});

test('edge detonations do not create effects outside the battlefield', () => {
  const presenter = new CombatEventPresenter();
  const model = presentationModel();
  presenter.present(model, {
    type: COMBAT_EVENT.UNIT_DETONATED,
    at: 200,
    unit: battleUnit('firefly', { row: 0, column: 0 }),
  });

  const explosions = model.effects.filter((effect) => effect.type === EFFECT_TYPE.EXPLOSION);
  assert.equal(explosions.length, 4);
  assert.ok(explosions.every((effect) => effect.row >= 0 && effect.row < GAME_CONFIG.rows));
  assert.ok(explosions.every((effect) => effect.column >= 0 && effect.column < GAME_CONFIG.columns));
  assert.equal(model.effects.find((effect) => effect.type === EFFECT_TYPE.DEATH).deathStyle, DEATH_ANIMATION.SPIN_OUT);
});
