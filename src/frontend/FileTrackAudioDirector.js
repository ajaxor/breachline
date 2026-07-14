import { EFFECT_TYPE } from '../data/gameTypes.js';
import { AudioDirector } from './AudioDirector.js';

const AUDIO_SETTINGS_KEY = 'breach-line-audio';
const TITLE_TRACK_SRC = './assets/audio/breach-line-title.mp3';
const DEFAULT_MUSIC_VOLUME = 0.25;
const TRACK_VOLUME = Object.freeze({
  title: 0.2,
  deployment: 0.04,
  battle: 0,
});

const clampVolume = (volume) => Math.min(1, Math.max(0, Number.isFinite(Number(volume)) ? Number(volume) : DEFAULT_MUSIC_VOLUME));

export class FileTrackAudioDirector extends AudioDirector {
  constructor(browser = window) {
    super(browser);
    this.settings.musicVolume = this.loadMusicVolume();
    this.musicElement = this.createMusicElement();
    this.trackSource = null;
    this.trackGain = null;
  }

  loadMusicVolume() {
    try {
      const saved = JSON.parse(this.browser.localStorage?.getItem(AUDIO_SETTINGS_KEY) || '{}');
      return clampVolume(saved.musicVolume);
    } catch {
      return DEFAULT_MUSIC_VOLUME;
    }
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

  unlock() {
    const unlocked = super.unlock();
    if (!unlocked || !this.context || !this.musicElement || this.trackSource || !this.context.createMediaElementSource) return unlocked;
    this.trackSource = this.context.createMediaElementSource(this.musicElement);
    this.trackGain = this.context.createGain();
    this.trackSource.connect(this.trackGain);
    this.trackGain.connect(this.context.destination);
    this.applyTrackVolume();
    this.playTrack();
    return unlocked;
  }

  applyVolumes() {
    super.applyVolumes();
    if (this.context && this.musicGain) {
      const at = this.context.currentTime;
      this.musicGain.gain.setTargetAtTime(this.settings.musicMuted ? 0 : 0.1 * this.settings.musicVolume, at, 0.04);
    }
    this.applyTrackVolume();
  }

  applyTrackVolume() {
    if (!this.musicElement) return;
    const sceneVolume = TRACK_VOLUME[this.scene] ?? 0;
    const volume = this.settings.musicMuted ? 0 : sceneVolume * this.settings.musicVolume;
    if (this.trackGain && this.context) {
      this.musicElement.volume = 1;
      this.trackGain.gain.setTargetAtTime(volume, this.context.currentTime, 0.025);
      return;
    }
    this.musicElement.volume = volume;
  }

  setMusicVolume(volume) {
    this.settings.musicVolume = clampVolume(volume);
    this.saveSettings();
    this.applyVolumes();
  }

  setMusicMuted(muted) {
    super.setMusicMuted(muted);
    if (!this.musicElement) return;
    if (this.settings.musicMuted) {
      this.applyTrackVolume();
      this.musicElement.pause?.();
      return;
    }
    this.applyTrackVolume();
    this.playTrack();
  }

  playEffects(effects) {
    const emphasizedDeaths = effects.map((effect) => effect.type === EFFECT_TYPE.DEATH
      ? { ...effect, type: EFFECT_TYPE.EXPLOSION, deathExplosion: true }
      : effect);
    super.playEffects(emphasizedDeaths);
  }

  playEffect(effect, start = this.context?.currentTime ?? 0, voice = 0) {
    if (!effect.deathExplosion) {
      super.playEffect(effect, start, voice);
      return;
    }
    this.playNoiseExplosion(start, 0.92, 0.42);
  }

  playExplosion(start, intensity) {
    const strength = Math.min(1.35, Math.max(0.65, intensity));
    this.playNoiseExplosion(start, strength, 0.5);
  }

  playNoiseExplosion(start, strength, tailDuration) {
    this.filteredNoise(tailDuration, 0.58 * strength, this.sfxGain, start, 280);
    this.filteredNoise(Math.min(0.28, tailDuration), 0.38 * strength, this.sfxGain, start + 0.006, 620);
    this.filteredNoise(0.095, 0.24 * strength, this.sfxGain, start + 0.012, 1450);
    this.filteredNoise(0.035, 0.16 * strength, this.sfxGain, start + 0.004, 3200);
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
    try { this.trackSource?.disconnect?.(); } catch { /* Already disconnected. */ }
    try { this.trackGain?.disconnect?.(); } catch { /* Already disconnected. */ }
    this.trackSource = null;
    this.trackGain = null;
    this.musicElement = null;
    super.dispose();
  }
}
