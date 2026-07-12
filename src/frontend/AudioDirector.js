import { EFFECT_TYPE } from '../data/gameTypes.js';

const AUDIO_SETTINGS_KEY = 'breach-line-audio';
const MUSIC_STEP_MS = 220;

const MUSIC = Object.freeze({
  title: Object.freeze({ tempo: 1.35, bass: [43, null, 43, 46, 41, null, 38, 41], lead: [67, null, 65, null, 62, 60, null, 62] }),
  deployment: Object.freeze({ tempo: 1, bass: [41, 41, 48, 41, 44, 44, 48, 46], lead: [65, null, 68, 67, 65, null, 63, 60] }),
  battle: Object.freeze({ tempo: 0.68, bass: [38, 38, 41, 38, 43, 41, 36, 36], lead: [62, 65, 67, 65, 70, 67, 65, 63] }),
});

const midiFrequency = (note) => 440 * (2 ** ((note - 69) / 12));
const clampDelay = (value) => Math.max(0, Math.min(1400, value));

export class AudioDirector {
  constructor(browser = window) {
    this.browser = browser;
    this.context = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicTimer = null;
    this.scene = 'title';
    this.step = 0;
    this.settings = this.loadSettings();
  }

  loadSettings() {
    try {
      const saved = JSON.parse(this.browser.localStorage?.getItem(AUDIO_SETTINGS_KEY) || '{}');
      return { musicMuted: Boolean(saved.musicMuted), sfxMuted: Boolean(saved.sfxMuted) };
    } catch {
      return { musicMuted: false, sfxMuted: false };
    }
  }

  saveSettings() {
    try { this.browser.localStorage?.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* Storage is optional. */ }
  }

  unlock() {
    const AudioContext = this.browser.AudioContext || this.browser.webkitAudioContext;
    if (!AudioContext) return false;
    if (!this.context) {
      this.context = new AudioContext();
      this.musicGain = this.context.createGain();
      this.sfxGain = this.context.createGain();
      this.musicGain.connect(this.context.destination);
      this.sfxGain.connect(this.context.destination);
      this.applyVolumes();
      this.restartMusic();
    }
    if (this.context.state === 'suspended') this.context.resume();
    return true;
  }

  applyVolumes() {
    if (!this.context) return;
    const at = this.context.currentTime;
    this.musicGain.gain.setTargetAtTime(this.settings.musicMuted ? 0 : 0.12, at, 0.04);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxMuted ? 0 : 0.22, at, 0.02);
  }

  setMusicMuted(muted) {
    this.settings.musicMuted = Boolean(muted);
    this.saveSettings();
    this.applyVolumes();
  }

  setSfxMuted(muted) {
    this.settings.sfxMuted = Boolean(muted);
    this.saveSettings();
    this.applyVolumes();
  }

  setScene(scene) {
    if (!MUSIC[scene] || this.scene === scene) return;
    this.scene = scene;
    this.restartMusic();
  }

  restartMusic() {
    if (this.musicTimer !== null) this.browser.clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.step = 0;
    if (!this.context) return;
    this.playMusicStep();
    this.musicTimer = this.browser.setInterval(() => this.playMusicStep(), MUSIC_STEP_MS * MUSIC[this.scene].tempo);
  }

  playMusicStep() {
    if (!this.context || this.settings.musicMuted) { this.step += 1; return; }
    const track = MUSIC[this.scene];
    const index = this.step % track.bass.length;
    const duration = MUSIC_STEP_MS * track.tempo / 1000;
    this.tone(track.bass[index], duration * 0.82, 'triangle', 0.34, this.musicGain);
    if (index % 2 === 0) this.tone(track.lead[index], duration * 1.7, 'sine', 0.16, this.musicGain, duration * 0.05);
    if (this.scene === 'battle' && index % 2 === 0) this.noise(0.035, 0.045, this.musicGain);
    this.step += 1;
  }

  playEffects(effects) {
    if (!this.unlock() || this.settings.sfxMuted || !effects.length) return;
    const audible = effects.filter((effect) => [EFFECT_TYPE.RANGED, EFFECT_TYPE.MELEE, EFFECT_TYPE.EXPLOSION, EFFECT_TYPE.DEATH, EFFECT_TYPE.HEAL].includes(effect.type));
    if (!audible.length) return;
    const origin = Math.min(...audible.map((effect) => effect.actionStart ?? effect.start ?? 0));
    let explosionCount = 0;
    for (const effect of audible) {
      if (effect.type === EFFECT_TYPE.EXPLOSION && explosionCount++ >= 4) continue;
      const delay = clampDelay((effect.start ?? origin) - origin);
      this.browser.setTimeout(() => this.playEffect(effect), delay);
    }
  }

  playEffect(effect) {
    if (!this.context || this.settings.sfxMuted) return;
    switch (effect.type) {
      case EFFECT_TYPE.MELEE:
        this.noise(0.075, 0.55, this.sfxGain);
        this.tone(82, 0.09, 'square', 0.18, this.sfxGain);
        break;
      case EFFECT_TYPE.RANGED:
        this.tone(effect.attackStyle === 'lightning' ? 880 : 520, 0.09, 'sawtooth', 0.18, this.sfxGain, 0, effect.attackStyle === 'lob' ? 180 : 80);
        break;
      case EFFECT_TYPE.EXPLOSION:
        this.noise(0.22, 0.72 * (effect.intensity || 1), this.sfxGain);
        this.tone(70, 0.24, 'sine', 0.28, this.sfxGain, 0, -34);
        break;
      case EFFECT_TYPE.DEATH:
        this.noise(0.12, 0.35, this.sfxGain);
        this.tone(190, 0.16, 'triangle', 0.12, this.sfxGain, 0, -100);
        break;
      case EFFECT_TYPE.HEAL:
        this.tone(523, 0.16, 'sine', 0.12, this.sfxGain);
        this.tone(659, 0.2, 'sine', 0.1, this.sfxGain, 0.08);
        break;
      default:
        break;
    }
  }

  tone(note, duration, type, volume, destination, delay = 0, sweep = 0) {
    if (!this.context || note === null || note === undefined) return;
    const frequency = note < 128 ? midiFrequency(note) : note;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (sweep) oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, frequency + sweep), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  noise(duration, volume, destination) {
    if (!this.context) return;
    const frameCount = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) channel[index] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const start = this.context.currentTime;
    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(gain);
    gain.connect(destination);
    source.start(start);
  }

  dispose() {
    if (this.musicTimer !== null) this.browser.clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.context?.close?.();
    this.context = null;
  }
}
