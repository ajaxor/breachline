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
  const connected = [];
  director.context = {
    currentTime: 1,
    createMediaElementSource(element) {
      return {
        element,
        connect(destination) { connected.push({ element, destination }); },
        disconnect() {},
      };
    },
  };
  director.sfxGain = {};
  return connected;
}

test('sound variation selection spans a bank deterministically', () => {
  const sources = ['one.wav', 'two.wav', 'three.wav'];

  assert.equal(chooseSoundVariation(sources, () => 0), 'one.wav');
  assert.equal(chooseSoundVariation(sources, () => 0.5), 'two.wav');
  assert.equal(chooseSoundVariation(sources, () => 0.999), 'three.wav');
});

test('melee sound bank contains every supplied robot crash variation', () => {
  assert.equal(SOUND_BANKS.melee.sources.length, 5);
  assert.ok(SOUND_BANKS.melee.sources.every((source) => source.includes('Robot_body_crash')));
  assert.ok(SOUND_BANKS.melee.volume < 0.5);
});

test('combat effects route to their file-backed sound banks', () => {
  const director = new FileTrackAudioDirector(soundBankBrowser(), () => 0);
  const connected = installSampleContext(director);

  director.playEffect({ type: EFFECT_TYPE.MELEE }, 1, 0);
  director.playEffect({ type: EFFECT_TYPE.RANGED, attackStyle: ATTACK_ANIMATION.LASER }, 1, 0);
  director.playEffect({ type: EFFECT_TYPE.EXPLOSION, deathExplosion: true }, 1, 0);

  assert.deepEqual(connected.map(({ element }) => element.src), [
    SOUND_BANKS.melee.sources[0],
    SOUND_BANKS.laser.sources[0],
    SOUND_BANKS.death.sources[0],
  ]);
  assert.deepEqual(connected.map(({ element }) => element.volume), [
    SOUND_BANKS.melee.volume,
    SOUND_BANKS.laser.volume,
    SOUND_BANKS.death.volume,
  ]);
});
