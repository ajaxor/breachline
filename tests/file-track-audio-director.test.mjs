import assert from 'node:assert/strict';
import test from 'node:test';

import { FileTrackAudioDirector } from '../src/frontend/FileTrackAudioDirector.js';

class FakeAudio {
  constructor(src) {
    this.src = src;
    this.currentTime = 0;
    this.loop = false;
    this.preload = '';
    this.volume = 0;
    this.playCount = 0;
    this.pauseCount = 0;
  }

  play() {
    this.playCount += 1;
    return Promise.resolve();
  }

  pause() {
    this.pauseCount += 1;
  }
}

function activateAudio(director) {
  const gain = { setTargetAtTime() {} };
  director.context = { currentTime: 0 };
  director.musicGain = { gain };
  director.sfxGain = { gain };
}

test('file soundtrack keeps its playhead while deployment ducks the title track', () => {
  const director = new FileTrackAudioDirector({ Audio: FakeAudio, clearInterval() {} });
  const track = director.musicElement;
  track.currentTime = 19.5;

  director.setScene('deployment');

  assert.equal(track.src, './assets/audio/breach-line-title.mp3');
  assert.equal(track.currentTime, 19.5);
  assert.equal(track.volume, 0.04);
  assert.equal(track.playCount, 0);

  activateAudio(director);
  director.restartMusic();
  assert.equal(track.currentTime, 19.5);
  assert.equal(track.playCount, 1);

  director.setScene('title');
  assert.equal(track.currentTime, 19.5);
  assert.equal(track.volume, 0.2);
});

test('music mute pauses the file track and unmute resumes the same playhead', () => {
  const director = new FileTrackAudioDirector({ Audio: FakeAudio, clearInterval() {} });
  const track = director.musicElement;
  activateAudio(director);
  track.currentTime = 27.25;
  director.restartMusic();

  director.setMusicMuted(true);

  assert.equal(track.currentTime, 27.25);
  assert.equal(track.volume, 0);
  assert.equal(track.pauseCount, 1);

  director.setMusicMuted(false);

  assert.equal(track.currentTime, 27.25);
  assert.equal(track.volume, 0.2);
  assert.equal(track.playCount, 2);
});

test('battle scene keeps the title track silent even when music is unmuted', () => {
  const director = new FileTrackAudioDirector({ Audio: FakeAudio, clearInterval() {} });
  const track = director.musicElement;
  activateAudio(director);

  director.setScene('battle');
  director.setMusicMuted(true);
  director.setMusicMuted(false);

  assert.equal(track.volume, 0);
  assert.equal(track.playCount, 0);
});
