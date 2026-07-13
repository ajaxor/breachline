import { AudioDirector } from './AudioDirector.js';

const TITLE_TRACK_SRC = './assets/title-theme.mp3';
const TRACK_VOLUME = Object.freeze({
  title: 0.38,
  deployment: 0.08,
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

  restartMusic() {
    if (this.musicTimer !== null) this.browser.clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.applyTrackVolume();
    if (!this.context || !this.musicElement || this.settings.musicMuted) return;
    const playback = this.musicElement.play?.();
    playback?.catch?.(() => { /* Browser autoplay policy may defer playback until the next user gesture. */ });
  }

  dispose() {
    this.musicElement?.pause?.();
    this.musicElement = null;
    super.dispose();
  }
}
