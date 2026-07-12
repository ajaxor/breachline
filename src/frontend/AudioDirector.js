import { EFFECT_TYPE } from '../data/gameTypes.js';

const AUDIO_SETTINGS_KEY = 'breach-line-audio';
const MUSIC_STEP_MS = 220;

const MUSIC = Object.freeze({
  title: Object.freeze({
    tempo: 0.92,
    bass: [38, 38, 43, 38, 41, 41, 45, 43],
    lead: [62, null, 65, 67, 62, null, 69, 67],
    drum: [1, 0, 0.45, 0, 0.8, 0, 0.45, 0],
  }),
  deployment: Object.freeze({
    tempo: 1.45,
    bass: [41, null, null, null, 44, null, null, null],
    lead: [60, null, 63, null, 65, null, 63, null],
    drum: [0, 0, 0, 0, 0.16, 0, 0, 0],
  }),
  battle: Object.freeze({
    tempo: 0.62,
    bass: [36, 36, 41, 36, 43, 41, 34, 34],
    lead: [60, 63, 67, 63, 70, 67, 65, 63],
    drum: [1, 0.4, 0.7, 0.4, 1, 0.4, 0.8, 0.5],
  }),
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
    this.effectVoice = 0;
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
    this.musicGain.gain.setTargetAtTime(this.settings.musicMuted ? 0 : 0.11, at, 0.04);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxMuted ? 0 : 0.2, at, 0.02);
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
    this.tone(track.bass[index], duration * 0.9, 'triangle', this.scene === 'deployment' ? 0.2 : 0.34, this.musicGain);
    if (index % 2 === 0) {
      this.tone(track.lead[index], duration * (this.scene === 'deployment' ? 2.4 : 1.65), 'sine', this.scene === 'deployment' ? 0.07 : 0.15, this.musicGain, duration * 0.05);
    }
    const drum = track.drum[index];
    if (drum > 0) this.playDrum(drum, this.scene === 'deployment' ? 0.035 : 0.1);
    this.step += 1;
  }

  playDrum(intensity, volume) {
    const start = this.context.currentTime;
    this.noise(0.055, volume * intensity, this.musicGain, start);
    this.tone(47, 0.09, 'sine', volume * 1.5 * intensity, this.musicGain, 0, -14, start);
  }

  playEffects(effects) {
    if (!this.unlock() || this.settings.sfxMuted || !effects.length) return;
    const audible = effects.filter((effect) => [EFFECT_TYPE.RANGED, EFFECT_TYPE.MELEE, EFFECT_TYPE.EXPLOSION, EFFECT_TYPE.DEATH, EFFECT_TYPE.HEAL].includes(effect.type));
    if (!audible.length) return;
    const origin = Math.min(...audible.map((effect) => effect.actionStart ?? effect.start ?? 0));
    const batchStart = this.context.currentTime + 0.012;
    for (const effect of audible) {
      const delay = clampDelay((effect.start ?? origin) - origin) / 1000;
      const voice = this.effectVoice++;
      this.playEffect(effect, batchStart + delay, voice);
    }
  }

  playEffect(effect, start = this.context?.currentTime ?? 0, voice = 0) {
    if (!this.context || this.settings.sfxMuted) return;
    const destination = this.createVoiceBus(voice);
    const detune = ((voice % 7) - 3) * 7;
    switch (effect.type) {
      case EFFECT_TYPE.MELEE:
        this.noise(0.075, 0.5, destination, start);
        this.tone(82, 0.09, 'square', 0.17, destination, 0, 0, start, detune);
        break;
      case EFFECT_TYPE.RANGED:
        this.tone(effect.attackStyle === 'lightning' ? 880 : 520, 0.09, 'sawtooth', 0.17, destination, 0, effect.attackStyle === 'lob' ? 180 : 80, start, detune);
        break;
      case EFFECT_TYPE.EXPLOSION:
        this.noise(0.22, 0.62 * (effect.intensity || 1), destination, start);
        this.tone(70, 0.24, 'sine', 0.24, destination, 0, -34, start, detune);
        break;
      case EFFECT_TYPE.DEATH:
        this.noise(0.12, 0.32, destination, start);
        this.tone(190, 0.16, 'triangle', 0.11, destination, 0, -100, start, detune);
        break;
      case EFFECT_TYPE.HEAL:
        this.tone(523, 0.16, 'sine', 0.11, destination, 0, 0, start, detune);
        this.tone(659, 0.2, 'sine', 0.09, destination, 0.08, 0, start, -detune);
        break;
      default:
        break;
    }
  }

  createVoiceBus(voice) {
    if (!this.context?.createStereoPanner) return this.sfxGain;
    const panner = this.context.createStereoPanner();
    const positions = [-0.72, 0.42, -0.24, 0.7, 0.12, -0.48, 0.55, -0.08];
    panner.pan.value = positions[voice % positions.length];
    panner.connect(this.sfxGain);
    return panner;
  }

  tone(note, duration, type, volume, destination, delay = 0, sweep = 0, at = this.context?.currentTime ?? 0, detune = 0) {
    if (!this.context || note === null || note === undefined) return;
    const frequency = note < 128 ? midiFrequency(note) : note;
    const start = at + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.detune?.setValueAtTime(detune, start);
    if (sweep) oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, frequency + sweep), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  noise(duration, volume, destination, at = this.context?.currentTime ?? 0) {
    if (!this.context) return;
    const frameCount = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) channel[index] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(gain);
    gain.connect(destination);
    source.start(at);
  }

  dispose() {
    if (this.musicTimer !== null) this.browser.clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.context?.close?.();
    this.context = null;
  }
}
