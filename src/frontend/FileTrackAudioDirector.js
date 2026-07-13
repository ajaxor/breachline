import { AudioDirector } from './AudioDirector.js';

const TITLE_TRACK_SRC = './assets/audio/breach-line-title.mp3';
const TRACK_VOLUME = Object.freeze({
  title: 0.2,
  deployment: 0.04,
  battle: 0,
});

export class FileTrackAudioDirector extends AudioDirector {
  constructor(browser = window) {
    super(browser);
    this.musicElement = this.createMusicElement();
  }

  createMusicElement() {
    const Audio = this.browser.Audio;
    if (!Audio) return null;
    const element = new Audio(TITLE_TRACK_SRC);
    element.loop = true;
    element.preload = 'auto';
    element.volume = 0;
    return element;
  }

  applyVolumes() {
    super.applyVolumes();
    this.applyTrackVolume();
  }

  applyTrackVolume() {
    if (!this.musicElement) return;
    this.musicElement.volume = this.settings.musicMuted ? 0 : (TRACK_VOLUME[this.scene] ?? 0);
  }

  setMusicMuted(muted) {
    super.setMusicMuted(muted);
    if (!this.musicElement) return;
    if (this.settings.musicMuted) {
      this.musicElement.volume = 0;
      this.musicElement.pause?.();
      return;
    }
    this.applyTrackVolume();
    this.playTrack();
  }

  playTrack() {
    if (!this.context || !this.musicElement || this.settings.musicMuted || (TRACK_VOLUME[this.scene] ?? 0) <= 0) return;
    const playback = this.musicElement.play?.();
    playback?.catch?.(() => { /* Browser autoplay policy may defer playback until the next user gesture. */ });
  }

  restartMusic() {
    if (this.musicTimer !== null) this.browser.clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.applyTrackVolume();
    this.playTrack();
  }

  dispose() {
    this.musicElement?.pause?.();
    this.musicElement = null;
    super.dispose();
  }
}
