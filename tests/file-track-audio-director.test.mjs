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
  }

  play() {
    this.playCount += 1;
    return Promise.resolve();
  }

  pause() {}
}

test('file soundtrack keeps its playhead while deployment ducks the title track', () => {
  const director = new FileTrackAudioDirector({ Audio: FakeAudio, clearInterval() {} });
  const track = director.musicElement;
  track.currentTime = 19.5;

  director.setScene('deployment');

  assert.equal(track.src, './assets/title-theme.mp3');
  assert.equal(track.currentTime, 19.5);
  assert.equal(track.volume, 0.08);
  assert.equal(track.playCount, 0);

  director.context = {};
  director.restartMusic();
  assert.equal(track.currentTime, 19.5);
  assert.equal(track.playCount, 1);

  director.setScene('title');
  assert.equal(track.currentTime, 19.5);
  assert.equal(track.volume, 0.38);
});
