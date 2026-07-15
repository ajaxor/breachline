import assert from 'node:assert/strict';
import test from 'node:test';

import { ATTACK_ANIMATION, EFFECT_TYPE } from '../src/data/gameTypes.js';
import { chooseSoundVariation, FileTrackAudioDirector, SOUND_BANKS } from '../src/frontend/FileTrackAudioDirector.js';

class FakeAudio {
  constructor(src) {
    this.src = src;
    this.volume = 0;
    this.preload = '';
    this.playCount = 0;
  }

  play() {
    this.playCount += 1;
    return Promise.resolve();
  }

  pause() {}
}

function soundBankBrowser() {
  return {
    Audio: FakeAudio,
    clearInterval() {},
    localStorage: { getItem() { return null; }, setItem() {} },
  };
}

function installSampleContext(director) {
  const started = [];
  director.context = {
    currentTime: 1,
    createBufferSource() {
      return {
        buffer: null,
        connect() {},
        disconnect() {},
        start(at) { started.push({ buffer: this.buffer, at }); },
      };
    },
    createGain() {
      return {
        gain: { setValueAtTime(value) { this.value = value; } },
        connect() {},
        disconnect() {},
      };
    },
  };
  director.sfxGain = {};
  return started;
}

test('sound variation selection spans a bank deterministically', () => {
  const sources = ['one.wav', 'two.wav', 'three.wav'];

  assert.equal(chooseSoundVariation(sources, () => 0), 'one.wav');
  assert.equal(chooseSoundVariation(sources, () => 0.5), 'two.wav');
  assert.equal(chooseSoundVariation(sources, () => 0.999), 'three.wav');
});

test('melee sound bank contains every supplied robot crash variation in its asset folder', () => {
  assert.equal(SOUND_BANKS.melee.sources.length, 5);
  assert.ok(SOUND_BANKS.melee.sources.every((source) => source.startsWith('./assets/audio/sfx/melee/robot-body-crash-')));
  assert.ok(SOUND_BANKS.melee.volume <= 1);
});

test('combat effects route to their decoded file-backed sound banks', () => {
  const director = new FileTrackAudioDirector(soundBankBrowser(), () => 0);
  const started = installSampleContext(director);
  const meleeBuffer = { id: 'melee' };
  const laserBuffer = { id: 'laser' };
  const deathBuffer = { id: 'death' };
  director.soundBankBuffers.set('melee', [{ sourcePath: SOUND_BANKS.melee.sources[0], buffer: meleeBuffer }]);
  director.soundBankBuffers.set('laser', [{ sourcePath: SOUND_BANKS.laser.sources[0], buffer: laserBuffer }]);
  director.soundBankBuffers.set('death', [{ sourcePath: SOUND_BANKS.death.sources[0], buffer: deathBuffer }]);

  director.playEffect({ type: EFFECT_TYPE.MELEE }, 1, 0);
  director.playEffect({ type: EFFECT_TYPE.RANGED, attackStyle: ATTACK_ANIMATION.LASER }, 1, 0);
  director.playEffect({ type: EFFECT_TYPE.EXPLOSION, deathExplosion: true }, 1, 0);

  assert.deepEqual(started.map(({ buffer }) => buffer), [meleeBuffer, laserBuffer, deathBuffer]);
  assert.deepEqual(started.map(({ at }) => at), [1, 1, 1]);
});
