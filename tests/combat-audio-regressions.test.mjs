import assert from 'node:assert/strict';
import test from 'node:test';

import { TEAM, UNIT_TYPES } from '../src/data/gameConfig.js';
import { ATTACK_ANIMATION, EFFECT_TYPE } from '../src/data/gameTypes.js';
import { CombatRangeBattlefieldRenderer } from '../src/frontend/CombatRangeBattlefieldRenderer.js';
import { FileTrackAudioDirector } from '../src/frontend/FileTrackAudioDirector.js';
import { GameModel } from '../src/model/GameModel.js';

const formationUnit = (type, row, column) => ({ type, row, column });

class FakeAudio {
  constructor(src) {
    this.src = src;
    this.volume = 0;
    this.loop = false;
    this.preload = '';
  }

  play() { return Promise.resolve(); }
  pause() {}
}

function fakeAudioBrowser() {
  return {
    Audio: FakeAudio,
    clearInterval() {},
    localStorage: { getItem() { return null; }, setItem() {} },
  };
}

test('a rear flyer can advance into the cell of an allied flyer that will also move', () => {
  const model = new GameModel({ random: () => 0, now: () => 0 });
  model.setupBattle({
    playerFormation: [formationUnit('midge', 2, 0), formationUnit('midge', 2, 1)],
    enemyFormation: [formationUnit('grunt', 7, 12)],
  });
  const [rear, front] = model.units.filter((unit) => unit.team === TEAM.PLAYER);

  model.processActionQueue([rear, front], 0, 100);

  assert.equal(rear.column, 1);
  assert.equal(front.column, 2);
});

test('a reloading unit holds position while a target remains in range', () => {
  const model = new GameModel({ random: () => 0, now: () => 0 });
  model.setupBattle({
    playerFormation: [formationUnit('archer', 2, 2)],
    enemyFormation: [formationUnit('grunt', 2, 4)],
  });
  const archer = model.units.find((unit) => unit.team === TEAM.PLAYER);
  archer.reloadTurnsRemaining = 2;

  model.processUnit(archer, 0, 100);

  assert.equal(archer.column, 2);
  assert.equal(archer.reloadTurnsRemaining, 1);
});

test('range overlays include armed structures and non-swivel side lanes', () => {
  const renderer = Object.create(CombatRangeBattlefieldRenderer.prototype);
  const sniper = { type: 'sniper', team: TEAM.ENEMY, row: 3, column: 8 };

  assert.equal(renderer.canShowAttackRange(UNIT_TYPES.mine), true);
  assert.equal(renderer.isCellInAttackRange(sniper, UNIT_TYPES.sniper, 1, 8), true);
  assert.equal(renderer.isCellInAttackRange(sniper, UNIT_TYPES.sniper, 3, 9), false);
  assert.equal(renderer.isCellInAttackRange(sniper, UNIT_TYPES.sniper, 3, 5), true);
});

test('sniper pays a premium for its five-cell range', () => {
  assert.equal(UNIT_TYPES.sniper.range, 5);
  assert.equal(UNIT_TYPES.sniper.cost, 38);
});

test('file music volume drives the Web Audio track gain when available', () => {
  const director = new FileTrackAudioDirector(fakeAudioBrowser());
  let appliedVolume = null;
  const gain = { setTargetAtTime() {} };
  director.context = { currentTime: 7 };
  director.musicGain = { gain };
  director.sfxGain = { gain };
  director.trackGain = { gain: { setTargetAtTime(value) { appliedVolume = value; } } };

  director.setMusicVolume(0.5);

  assert.equal(director.musicElement.volume, 1);
  assert.equal(appliedVolume, 0.1);
});

test('melee attacks reuse the short arcade noise burst without tonal oscillators', () => {
  const director = new FileTrackAudioDirector(fakeAudioBrowser());
  const noises = [];
  const tones = [];
  director.context = { currentTime: 0 };
  director.sfxGain = {};
  director.filteredNoise = (duration, volume, destination, at, cutoff) => noises.push({ duration, cutoff });
  director.tone = (...args) => tones.push(args);

  director.playEffect({ type: EFFECT_TYPE.MELEE }, 2, 0);

  assert.deepEqual(noises.map((noise) => noise.cutoff), [280, 620, 1450, 3200]);
  assert.equal(tones.length, 0);
  assert.equal(noises[0].duration, 0.42);
});

test('unit death explosion is deeper and longer than the melee noise burst', () => {
  const director = new FileTrackAudioDirector(fakeAudioBrowser());
  const noises = [];
  const tones = [];
  director.sfxGain = {};
  director.filteredNoise = (duration, volume, destination, at, cutoff) => noises.push({ duration, cutoff });
  director.tone = (...args) => tones.push(args);

  director.playDeathExplosion(2, 1);

  assert.deepEqual(noises.map((noise) => noise.cutoff), [150, 260, 480, 900, 2200]);
  assert.equal(tones.length, 0);
  assert.ok(noises[0].duration >= 0.9);
  assert.ok(noises[0].cutoff < 280);
});

test('laser attack synthesis uses lower sweeping voices and a noise edge', () => {
  const director = new FileTrackAudioDirector(fakeAudioBrowser());
  const noises = [];
  const tones = [];
  director.sfxGain = {};
  director.filteredNoise = (duration, volume, destination, at, cutoff) => noises.push({ duration, cutoff });
  director.tone = (note, duration, type, volume, destination, delay, sweep) => tones.push({ note, duration, type, sweep });

  director.playRangedAttack(ATTACK_ANIMATION.LASER, 2, 0);

  assert.deepEqual(tones.map((tone) => tone.note), [340, 190]);
  assert.ok(tones.every((tone) => tone.note < 400));
  assert.ok(tones.some((tone) => tone.sweep < 0));
  assert.ok(tones.some((tone) => tone.sweep > 0));
  assert.deepEqual(noises.map((noise) => noise.cutoff), [1200]);
});
