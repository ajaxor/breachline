import assert from 'node:assert/strict';
import test from 'node:test';

import { FlowGameController } from '../src/backend/FlowGameController.js';
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
    this.playCount = 0;
  }

  play() { this.playCount += 1; return Promise.resolve(); }
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

test('Dozer pushes every contiguous unit in the target lane', () => {
  const model = new GameModel({ random: () => 0, now: () => 0 });
  model.setupBattle({
    playerFormation: [formationUnit('dozer', 2, 1)],
    enemyFormation: [formationUnit('grunt', 2, 2), formationUnit('grunt', 2, 3), formationUnit('grunt', 2, 4)],
  });
  const dozer = model.units.find((unit) => unit.type === 'dozer');

  model.processUnit(dozer, 0, 100);

  assert.equal(dozer.column, 2);
  assert.deepEqual(model.units.filter((unit) => unit.team === TEAM.ENEMY).map((unit) => unit.column), [3, 4, 5]);
});

test('Dozer leaves the entire line in place when a chain push would leave the board', () => {
  const model = new GameModel({ random: () => 0, now: () => 0 });
  model.setupBattle({
    playerFormation: [formationUnit('dozer', 2, 10)],
    enemyFormation: [formationUnit('grunt', 2, 11), formationUnit('grunt', 2, 12), formationUnit('grunt', 2, 13)],
  });
  const dozer = model.units.find((unit) => unit.type === 'dozer');

  model.processUnit(dozer, 0, 100);

  assert.equal(dozer.column, 10);
  assert.deepEqual(model.units.filter((unit) => unit.team === TEAM.ENEMY).map((unit) => unit.column), [11, 12, 13]);
});

test('range overlays include armed structures and non-swivel side lanes', () => {
  const renderer = Object.create(CombatRangeBattlefieldRenderer.prototype);
  const sniper = { type: 'sniper', team: TEAM.ENEMY, row: 3, column: 8 };

  assert.equal(renderer.canShowAttackRange(UNIT_TYPES.mine), true);
  assert.equal(renderer.isCellInAttackRange(sniper, UNIT_TYPES.sniper, 1, 8), true);
  assert.equal(renderer.isCellInAttackRange(sniper, UNIT_TYPES.sniper, 3, 9), false);
  assert.equal(renderer.isCellInAttackRange(sniper, UNIT_TYPES.sniper, 3, 5), true);
});

test('friendly formation range overlays are explicitly oriented toward the enemy wall', () => {
  const renderer = Object.create(CombatRangeBattlefieldRenderer.prototype);
  renderer.inspectedEnemyCell = null;
  renderer.model = null;
  renderer.canShowAttackRange = () => true;
  renderer.drawRangedRangeZone = (unit) => { renderer.drawnUnit = unit; };

  CombatRangeBattlefieldRenderer.prototype.drawFriendlyEffectZones.call(renderer, [formationUnit('sniper', 3, 2)]);

  assert.equal(renderer.drawnUnit.team, TEAM.PLAYER);
  assert.equal(renderer.isCellInAttackRange(renderer.drawnUnit, UNIT_TYPES.sniper, 3, 5), true);
  assert.equal(renderer.isCellInAttackRange(renderer.drawnUnit, UNIT_TYPES.sniper, 3, 1), false);
});

test('sniper pays a premium for its five-cell range', () => {
  assert.equal(UNIT_TYPES.sniper.range, 5);
  assert.equal(UNIT_TYPES.sniper.cost, 38);
});

test('Stormwing uses low damage to offset its airborne anti-air stun salvo', () => {
  assert.equal(UNIT_TYPES.stormwing.attack, 3);
});

test('title track playback is requested as soon as the audio director is created', () => {
  const director = new FileTrackAudioDirector(fakeAudioBrowser());

  assert.equal(director.musicElement.playCount, 1);
  assert.equal(director.musicElement.volume, 0.05);
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

test('the first pointer interaction unlocks title music without requiring a button click', () => {
  const controller = Object.create(FlowGameController.prototype);
  const document = { querySelectorAll: () => [] };
  const element = {};
  const listeners = [];
  let unlocks = 0;
  controller.view = { document, elements: new Proxy({}, { get: () => element }) };
  controller.browser = {};
  controller.audioDirector = { unlock() { unlocks += 1; } };
  controller.listen = (target, type, handler) => listeners.push({ target, type, handler });

  controller.bindEvents();
  listeners.find((listener) => listener.target === document && listener.type === 'pointerdown').handler();

  assert.equal(unlocks, 1);
});

test('surrendering from a battle loss result returns directly to title', () => {
  const controller = Object.create(FlowGameController.prototype);
  let surrendered = 0;
  let confirmationRequests = 0;
  controller.surrenderCampaign = () => { surrendered += 1; };
  controller.requestSurrender = () => { confirmationRequests += 1; };

  controller.handleResultAction({
    target: { closest: () => ({ dataset: { resultAction: 'surrender' } }) },
  });

  assert.equal(surrendered, 1);
  assert.equal(confirmationRequests, 0);
});

test('decoded sound banks use Web Audio buffers and select melee variants randomly', () => {
  const director = new FileTrackAudioDirector(fakeAudioBrowser(), () => 0.99);
  let startedAt = null;
  let selectedBuffer = null;
  let appliedVolume = null;
  const source = {
    connect() {},
    disconnect() {},
    start(at) { startedAt = at; selectedBuffer = this.buffer; },
  };
  const gain = {
    gain: { setValueAtTime(value) { appliedVolume = value; } },
    connect() {},
    disconnect() {},
  };
  director.context = { currentTime: 1, createBufferSource: () => source, createGain: () => gain };
  director.sfxGain = {};
  director.soundBankBuffers.set('melee', [
    { sourcePath: 'first.wav', buffer: { id: 'first' } },
    { sourcePath: 'second.wav', buffer: { id: 'second' } },
  ]);

  director.playEffect({ type: EFFECT_TYPE.MELEE }, 2, 0);

  assert.equal(selectedBuffer.id, 'second');
  assert.equal(startedAt, 2);
  assert.equal(appliedVolume, 0.8);
});

test('visual death explosions are silent so the death sound bank owns the cue', () => {
  const director = new FileTrackAudioDirector(fakeAudioBrowser());
  const played = [];
  director.unlock = () => true;
  director.context = { currentTime: 0 };
  director.settings.sfxMuted = false;
  director.playEffect = (effect) => played.push(effect);

  director.playEffects([
    { type: EFFECT_TYPE.EXPLOSION, start: 0, silentAudio: true },
    { type: EFFECT_TYPE.DEATH, start: 0 },
  ]);

  assert.equal(played.length, 1);
  assert.equal(played[0].deathExplosion, true);
});

test('melee attacks fall back to the arcade noise burst until samples are decoded', () => {
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

test('unit death synthesis remains as a fallback until the death sample is decoded', () => {
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

test('laser attack synthesis remains as a fallback until the laser sample is decoded', () => {
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
