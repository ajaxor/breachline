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
  load() {}
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

function installBank(director, bankName) {
  const buffer = { id: bankName };
  director.soundBankBuffers.set(bankName, [{ sourcePath: SOUND_BANKS[bankName].sources[0], buffer }]);
  return buffer;
}

test('sound variation selection spans a bank deterministically', () => {
  const sources = ['one.wav', 'two.wav', 'three.wav'];

  assert.equal(chooseSoundVariation(sources, () => 0), 'one.wav');
  assert.equal(chooseSoundVariation(sources, () => 0.5), 'two.wav');
  assert.equal(chooseSoundVariation(sources, () => 0.999), 'three.wav');
});

test('sound banks contain every organized file variation', () => {
  assert.equal(SOUND_BANKS.melee.sources.length, 5);
  assert.equal(SOUND_BANKS.laser.sources.length, 3);
  assert.equal(SOUND_BANKS.missile.sources.length, 2);
  assert.equal(SOUND_BANKS.lob.sources.length, 1);
  assert.equal(SOUND_BANKS.lightning.sources.length, 3);
  assert.equal(SOUND_BANKS.explosion.sources.length, 2);
  assert.equal(SOUND_BANKS.death.sources.length, 1);
  assert.equal(SOUND_BANKS.uiTap.sources.length, 1);
  assert.ok(Object.values(SOUND_BANKS).flatMap((bank) => bank.sources).every((source) => source.startsWith('./assets/audio/sfx/')));
  assert.ok(Object.values(SOUND_BANKS).every((bank) => bank.volume > 0 && bank.volume <= 1));
});

test('combat effects route to their decoded file-backed sound banks', () => {
  const director = new FileTrackAudioDirector(soundBankBrowser(), () => 0);
  const started = installSampleContext(director);
  const melee = installBank(director, 'melee');
  const laser = installBank(director, 'laser');
  const missile = installBank(director, 'missile');
  const lob = installBank(director, 'lob');
  const lightning = installBank(director, 'lightning');
  const explosion = installBank(director, 'explosion');
  const death = installBank(director, 'death');

  director.playEffect({ type: EFFECT_TYPE.MELEE }, 1, 0);
  director.playEffect({ type: EFFECT_TYPE.RANGED, attackStyle: ATTACK_ANIMATION.LASER }, 1, 0);
  director.playEffect({ type: EFFECT_TYPE.RANGED, attackStyle: ATTACK_ANIMATION.MISSILE }, 1, 0);
  director.playEffect({ type: EFFECT_TYPE.RANGED, attackStyle: ATTACK_ANIMATION.LOB, duration: 500 }, 1, 0);
  director.playEffect({ type: EFFECT_TYPE.RANGED, attackStyle: ATTACK_ANIMATION.LIGHTNING }, 1, 0);
  director.playEffect({ type: EFFECT_TYPE.EXPLOSION, intensity: 1 }, 1, 0);
  director.playEffect({ type: EFFECT_TYPE.EXPLOSION, deathExplosion: true }, 1, 0);

  assert.deepEqual(started.map(({ buffer }) => buffer), [melee, laser, missile, lob, explosion, lightning, explosion, death]);
  assert.deepEqual(started.map(({ at }) => at), [1, 1, 1, 1, 1.26, 1, 1, 1]);
});

test('all button cues use the decoded button press bank while placement keeps its own cue', () => {
  const director = new FileTrackAudioDirector(soundBankBrowser(), () => 0);
  const started = installSampleContext(director);
  const uiBuffer = installBank(director, 'uiTap');
  director.unlock = () => true;
  let placementFallbacks = 0;
  director.tone = () => { placementFallbacks += 1; };
  director.filteredNoise = () => {};

  director.playUiSound('tap');
  director.playUiSound('select');
  director.playUiSound('launch');
  director.playUiSound('place');

  assert.deepEqual(started.map(({ buffer }) => buffer), [uiBuffer, uiBuffer, uiBuffer]);
  assert.equal(placementFallbacks, 1);
});

test('title music requests autoplay immediately on construction', () => {
  const director = new FileTrackAudioDirector(soundBankBrowser(), () => 0);

  assert.equal(director.musicElement.autoplay, true);
  assert.equal(director.musicElement.playsInline, true);
  assert.equal(director.musicElement.playCount, 1);
});
