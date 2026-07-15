import { ATTACK_ANIMATION, EFFECT_TYPE } from '../data/gameTypes.js';
import { AudioDirector } from './AudioDirector.js';

const AUDIO_SETTINGS_KEY = 'breach-line-audio';
const TITLE_TRACK_SRC = './assets/audio/breach-line-title.mp3';
const DEFAULT_MUSIC_VOLUME = 0.25;
const TRACK_VOLUME = Object.freeze({
  title: 0.2,
  deployment: 0.04,
  battle: 0,
});

export const SOUND_BANKS = Object.freeze({
  melee: Object.freeze({
    volume: 0.8,
    sources: Object.freeze([
      './assets/audio/sfx/melee/robot-body-crash-01.wav',
      './assets/audio/sfx/melee/robot-body-crash-02.wav',
      './assets/audio/sfx/melee/robot-body-crash-03.wav',
      './assets/audio/sfx/melee/robot-body-crash-04.wav',
      './assets/audio/sfx/melee/robot-body-crash-05.wav',
    ]),
  }),
  laser: Object.freeze({
    volume: 0.72,
    sources: Object.freeze([
      './assets/audio/sfx/laser/short-zap-01.wav',
    ]),
  }),
  death: Object.freeze({
    volume: 0.9,
    sources: Object.freeze([
      './assets/audio/sfx/death/drone-explosion-01.wav',
    ]),
  }),
});

const clampVolume = (volume) => Math.min(1, Math.max(0, Number.isFinite(Number(volume)) ? Number(volume) : DEFAULT_MUSIC_VOLUME));

export function chooseSoundVariation(sources, random = Math.random) {
  if (!sources?.length) return null;
  const index = Math.min(sources.length - 1, Math.floor(Math.max(0, random()) * sources.length));
  return sources[index];
}

export class FileTrackAudioDirector extends AudioDirector {
  constructor(browser = window, random = Math.random) {
    super(browser);
    this.random = random;
    this.settings.musicVolume = this.loadMusicVolume();
    this.musicElement = this.createMusicElement();
    this.trackSource = null;
    this.trackGain = null;
    this.soundBankBuffers = new Map();
    this.soundBankFiles = new Map();
    this.soundBankFetchPromise = this.fetchSoundBanks();
    this.soundBankLoadPromise = null;
    this.activeEffectSources = new Set();
    this.applyTrackVolume();
    this.playTrack();
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

  fetchSoundBanks() {
    if (!this.browser.fetch) return Promise.resolve();
    const loads = Object.entries(SOUND_BANKS).flatMap(([bankName, bank]) => bank.sources.map(async (sourcePath) => {
      const response = await this.browser.fetch(sourcePath);
      if (!response.ok) throw new Error(`Unable to load sound effect: ${sourcePath}`);
      const encoded = await response.arrayBuffer();
      const variations = this.soundBankFiles.get(bankName) || [];
      variations.push({ sourcePath, encoded });
      this.soundBankFiles.set(bankName, variations);
    }));
    return Promise.allSettled(loads);
  }

  unlock() {
    const unlocked = super.unlock();
    if (!unlocked || !this.context) return unlocked;
    this.loadSoundBanks();
    if (!this.musicElement || this.trackSource || !this.context.createMediaElementSource) return unlocked;
    this.trackSource = this.context.createMediaElementSource(this.musicElement);
    this.trackGain = this.context.createGain();
    this.trackSource.connect(this.trackGain);
    this.trackGain.connect(this.context.destination);
    this.applyTrackVolume();
    this.playTrack();
    return unlocked;
  }

  loadSoundBanks() {
    if (this.soundBankLoadPromise || !this.context?.decodeAudioData) return this.soundBankLoadPromise;
    this.soundBankLoadPromise = this.soundBankFetchPromise.then(async () => {
      const decodes = [...this.soundBankFiles.entries()].flatMap(([bankName, variations]) => variations.map(async ({ sourcePath, encoded }) => {
        const buffer = await this.context.decodeAudioData(encoded.slice(0));
        const decoded = this.soundBankBuffers.get(bankName) || [];
        decoded.push({ sourcePath, buffer });
        this.soundBankBuffers.set(bankName, decoded);
      }));
      await Promise.allSettled(decodes);
    });
    return this.soundBankLoadPromise;
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
    const emphasizedDeaths = effects
      .filter((effect) => !effect.silentAudio)
      .map((effect) => effect.type === EFFECT_TYPE.DEATH
        ? { ...effect, type: EFFECT_TYPE.EXPLOSION, deathExplosion: true }
        : effect);
    super.playEffects(emphasizedDeaths);
  }

  playEffect(effect, start = this.context?.currentTime ?? 0, voice = 0) {
    if (effect.deathExplosion) {
      if (!this.playSoundBank('death', start)) this.playDeathExplosion(start, 0.96);
      return;
    }
    if (effect.type === EFFECT_TYPE.MELEE) {
      if (!this.playSoundBank('melee', start)) this.playArcadeNoiseBurst(start, 0.78, 0.42);
      return;
    }
    if (effect.type === EFFECT_TYPE.RANGED && effect.attackStyle === ATTACK_ANIMATION.LASER) {
      if (!this.playSoundBank('laser', start)) super.playEffect(effect, start, voice);
      return;
    }
    super.playEffect(effect, start, voice);
  }

  playSoundBank(bankName, start = this.context?.currentTime ?? 0) {
    const bank = SOUND_BANKS[bankName];
    const variations = this.soundBankBuffers.get(bankName);
    if (!bank || !variations?.length || !this.context?.createBufferSource || !this.context.createGain || !this.sfxGain) return false;
    const variation = chooseSoundVariation(variations, this.random);
    if (!variation) return false;

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const playbackAt = Math.max(this.context.currentTime, start);
    source.buffer = variation.buffer;
    gain.gain.setValueAtTime(bank.volume, playbackAt);
    source.connect(gain);
    gain.connect(this.sfxGain);
    this.activeEffectSources.add(source);

    source.onended = () => {
      try { source.disconnect(); } catch { /* Already disconnected. */ }
      try { gain.disconnect(); } catch { /* Already disconnected. */ }
      this.activeEffectSources.delete(source);
    };
    source.start(playbackAt);
    return true;
  }

  playExplosion(start, intensity) {
    const strength = Math.min(1.35, Math.max(0.65, intensity));
    this.playDeathExplosion(start, strength);
  }

  playArcadeNoiseBurst(start, strength, tailDuration) {
    this.filteredNoise(tailDuration, 0.58 * strength, this.sfxGain, start, 280);
    this.filteredNoise(Math.min(0.28, tailDuration), 0.38 * strength, this.sfxGain, start + 0.006, 620);
    this.filteredNoise(0.095, 0.24 * strength, this.sfxGain, start + 0.012, 1450);
    this.filteredNoise(0.035, 0.16 * strength, this.sfxGain, start + 0.004, 3200);
  }

  playDeathExplosion(start, strength) {
    this.filteredNoise(0.92, 0.68 * strength, this.sfxGain, start, 150);
    this.filteredNoise(0.72, 0.54 * strength, this.sfxGain, start + 0.012, 260);
    this.filteredNoise(0.46, 0.38 * strength, this.sfxGain, start + 0.022, 480);
    this.filteredNoise(0.2, 0.24 * strength, this.sfxGain, start + 0.01, 900);
    this.filteredNoise(0.055, 0.13 * strength, this.sfxGain, start + 0.004, 2200);
  }

  playTrack() {
    if (!this.musicElement || this.settings.musicMuted || (TRACK_VOLUME[this.scene] ?? 0) <= 0) return;
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
    for (const source of this.activeEffectSources) {
      try { source.disconnect(); } catch { /* Already disconnected. */ }
    }
    this.activeEffectSources.clear();
    this.soundBankBuffers.clear();
    this.soundBankFiles.clear();
    this.trackSource = null;
    this.trackGain = null;
    this.musicElement = null;
    super.dispose();
  }
}
