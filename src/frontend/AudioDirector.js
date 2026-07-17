import { ATTACK_ANIMATION, EFFECT_TYPE } from '../data/gameTypes.js';

const AUDIO_SETTINGS_KEY = 'breach-line-audio';
const MUSIC_STEP_MS = 190;
const NOISE_BUFFER_SECONDS = 1;
const SIMULTANEOUS_EFFECT_WINDOW_MS = 24;
const MAX_SIMULTANEOUS_EFFECTS = 4;
const SILENT_MUSIC_SCENES = new Set(['battle']);
const AUDIBLE_EFFECT_TYPES = new Set([
  EFFECT_TYPE.RANGED,
  EFFECT_TYPE.MELEE,
  EFFECT_TYPE.EXPLOSION,
  EFFECT_TYPE.DEATH,
  EFFECT_TYPE.HEAL,
  EFFECT_TYPE.GRID_FADE,
]);
const EFFECT_PRIORITY = Object.freeze({
  [EFFECT_TYPE.GRID_FADE]: 6,
  [EFFECT_TYPE.EXPLOSION]: 5,
  [EFFECT_TYPE.RANGED]: 4,
  [EFFECT_TYPE.MELEE]: 3,
  [EFFECT_TYPE.HEAL]: 2,
  [EFFECT_TYPE.DEATH]: 1,
});

const repeat = (pattern, times) => Array.from({ length: times }, () => pattern).flat();
const MUSIC = Object.freeze({
  title: Object.freeze({
    tempo: 1.05,
    bass: [...repeat([38, null, 38, null, 43, null, 41, null], 2), ...repeat([36, null, 36, null, 41, null, 43, null], 2), ...repeat([34, null, 38, null, 41, null, 45, null], 2), ...repeat([36, null, 43, null, 41, null, 38, null], 2)],
    lead: [62, null, 65, 67, null, 69, 67, null, 62, 65, null, 70, 69, null, 65, null, 60, null, 63, 65, null, 67, 70, null, 72, 70, null, 67, 65, null, 63, null, 58, null, 62, 65, null, 69, 67, null, 70, null, 69, 65, null, 62, 64, null, 60, 63, null, 67, 70, null, 67, null, 65, null, 63, 62, null, 58, 60, null],
    counter: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 72, null, 70, null, 67, null, 69, null, 70, null, 72, null, 74, 72, null, null, null, null, null, null, null, null, null, null, null, 69, null, 67, null, 65, 67, null, null, 74, null, 72, 70, null, 67, null, 69, 70, null, 67, null, 65, null, 62, null],
    arp: repeat([74, 77, 81, 77, 72, 77, 79, 77, 70, 74, 77, 74, 72, 75, 79, 75], 4),
    drum: [1, 0, 0.28, 0.18, 0.68, 0, 0.38, 0.16, 0.92, 0.12, 0.28, 0.18, 0.72, 0, 0.48, 0.24, 1, 0.18, 0.42, 0.2, 0.76, 0.12, 0.34, 0.2, 0.96, 0.16, 0.38, 0.2, 0.82, 0.18, 0.56, 0.34, 1, 0, 0.32, 0.2, 0.7, 0.14, 0.42, 0.22, 0.94, 0.18, 0.34, 0.24, 0.8, 0.16, 0.5, 0.3, 1, 0.2, 0.46, 0.26, 0.84, 0.18, 0.4, 0.28, 1, 0.22, 0.54, 0.3, 0.9, 0.24, 0.64, 0.42],
  }),
  deployment: Object.freeze({
    tempo: 1.35,
    bass: [...repeat([41, null, null, null, 44, null, null, null], 2), ...repeat([39, null, null, null, 46, null, null, null], 2), ...repeat([41, null, 48, null, 44, null, null, null], 2), ...repeat([39, null, 43, null, 46, null, 44, null], 2)],
    lead: [60, null, null, 63, null, 65, null, null, 67, null, 65, null, 63, null, null, null, 58, null, 62, null, null, 65, null, 67, null, 70, null, 67, null, 65, null, null, 60, null, 63, null, 65, null, 68, null, 67, null, null, 65, 63, null, 60, null, 58, null, 62, 65, null, 67, null, 70, 68, null, 67, null, 65, 63, null, null],
    arp: repeat([72, null, 75, null, 79, null, 75, null, 70, null, 74, null, 77, null, 74, null], 4),
    drum: repeat([0, 0, 0, 0, 0.14, 0, 0, 0, 0, 0, 0.08, 0, 0.18, 0, 0, 0], 4),
  }),
});

const midiFrequency = (note) => 440 * (2 ** ((note - 69) / 12));
const effectStart = (effect) => Number.isFinite(effect.start) ? effect.start : 0;

export function limitSimultaneousEffects(effects, maxVoices = MAX_SIMULTANEOUS_EFFECTS, windowMs = SIMULTANEOUS_EFFECT_WINDOW_MS) {
  const audible = effects.filter((effect) => AUDIBLE_EFFECT_TYPES.has(effect.type));
  const ordered = audible.map((effect, index) => ({ effect, index })).sort((left, right) => effectStart(left.effect) - effectStart(right.effect) || left.index - right.index);
  const result = [];
  for (let cursor = 0; cursor < ordered.length;) {
    const groupStart = effectStart(ordered[cursor].effect);
    let end = cursor + 1;
    while (end < ordered.length && effectStart(ordered[end].effect) - groupStart <= windowMs) end += 1;
    const group = ordered.slice(cursor, end);
    if (group.length <= maxVoices) result.push(...group);
    else {
      const selected = [...group]
        .sort((left, right) => (EFFECT_PRIORITY[right.effect.type] || 0) - (EFFECT_PRIORITY[left.effect.type] || 0) || left.index - right.index)
        .slice(0, maxVoices)
        .sort((left, right) => left.index - right.index);
      result.push(...selected);
    }
    cursor = end;
  }
  return result.map(({ effect }) => effect);
}

export class AudioDirector {
  constructor(browser = window) {
    this.browser = browser;
    this.context = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicTimer = null;
    this.noiseBuffer = null;
    this.scene = 'title';
    this.step = 0;
    this.effectVoice = 0;
    this.settings = this.loadSettings();
  }

  loadSettings() {
    try {
      const saved = JSON.parse(this.browser.localStorage?.getItem(AUDIO_SETTINGS_KEY) || '{}');
      return { musicMuted: Boolean(saved.musicMuted), sfxMuted: Boolean(saved.sfxMuted) };
    } catch { return { musicMuted: false, sfxMuted: false }; }
  }

  saveSettings() { try { this.browser.localStorage?.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* Storage is optional. */ } }

  unlock() {
    const AudioContext = this.browser.AudioContext || this.browser.webkitAudioContext;
    if (!AudioContext) return false;
    if (!this.context) {
      this.context = new AudioContext();
      this.musicGain = this.context.createGain();
      this.sfxGain = this.context.createGain();
      this.musicGain.connect(this.context.destination);
      this.sfxGain.connect(this.context.destination);
      this.noiseBuffer = this.createNoiseBuffer();
      this.applyVolumes();
      this.restartMusic();
    }
    if (this.context.state === 'suspended') this.context.resume();
    return true;
  }

  createNoiseBuffer() {
    const frameCount = Math.max(1, Math.floor(this.context.sampleRate * NOISE_BUFFER_SECONDS));
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) channel[index] = Math.random() * 2 - 1;
    return buffer;
  }

  applyVolumes() {
    if (!this.context) return;
    const at = this.context.currentTime;
    this.musicGain.gain.setTargetAtTime(this.settings.musicMuted ? 0 : 0.1, at, 0.04);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxMuted ? 0 : 0.18, at, 0.02);
  }

  setMusicMuted(muted) { this.settings.musicMuted = muted; this.saveSettings(); this.applyVolumes(); this.restartMusic(); }
  setSfxMuted(muted) { this.settings.sfxMuted = muted; this.saveSettings(); this.applyVolumes(); }
  setScene(scene) { if (this.scene === scene) return; this.scene = scene; this.restartMusic(); }

  restartMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.step = 0;
    if (!this.context || this.settings.musicMuted || SILENT_MUSIC_SCENES.has(this.scene)) return;
    this.playMusicStep();
    this.musicTimer = setInterval(() => this.playMusicStep(), MUSIC_STEP_MS);
  }

  playMusicStep() {
    const pattern = MUSIC[this.scene] ?? MUSIC.title;
    const index = this.step % pattern.bass.length;
    const tempo = pattern.tempo ?? 1;
    const start = this.context.currentTime + 0.01;
    const bass = pattern.bass[index];
    const lead = pattern.lead[index % pattern.lead.length];
    const counter = pattern.counter?.[index % pattern.counter.length];
    const arp = pattern.arp?.[index % pattern.arp.length];
    const drum = pattern.drum?.[index % pattern.drum.length] ?? 0;
    if (bass) this.tone(midiFrequency(bass), 0.13 / tempo, 'sawtooth', 0.04, this.musicGain, 0, -18, start);
    if (lead) this.tone(midiFrequency(lead), 0.09 / tempo, 'square', 0.026, this.musicGain, 0.02, -12, start);
    if (counter) this.tone(midiFrequency(counter), 0.07 / tempo, 'triangle', 0.018, this.musicGain, 0.035, -8, start);
    if (arp) this.tone(midiFrequency(arp), 0.045 / tempo, 'triangle', 0.011, this.musicGain, 0.055, -5, start);
    if (drum) this.filteredNoise(0.025, 0.025 * drum, this.musicGain, start, 900 + drum * 900);
    this.step += 1;
  }

  playEffects(effects) {
    if (!this.unlock() || this.settings.sfxMuted || !effects.length) return;
    const audible = limitSimultaneousEffects(effects);
    if (!audible.length) return;
    const starts = audible.map((effect) => effect.start).filter(Number.isFinite);
    const origin = starts.length ? Math.min(...starts) : 0;
    const batchStart = this.context.currentTime + 0.008;
    for (const effect of audible) {
      const delay = Number.isFinite(effect.start) ? Math.max(0, effect.start - origin) / 1000 : 0;
      this.playEffect(effect, batchStart + delay, this.effectVoice++);
    }
  }

  playEffect(effect, start = this.context?.currentTime ?? 0, voice = 0) {
    if (!this.context || this.settings.sfxMuted) return;
    const detune = ((voice % 7) - 3) * 7;
    switch (effect.type) {
      case EFFECT_TYPE.MELEE:
        this.filteredNoise(0.045, 0.3, this.sfxGain, start, 1400);
        this.tone(110, 0.065, 'square', 0.12, this.sfxGain, 0, -45, start, detune);
        break;
      case EFFECT_TYPE.RANGED: this.playRangedAttack(effect.attackStyle, start, detune); break;
      case EFFECT_TYPE.EXPLOSION: this.playExplosion(start, effect.intensity || 1, detune); break;
      case EFFECT_TYPE.DEATH:
        this.filteredNoise(0.075, 0.2, this.sfxGain, start, 1800);
        this.tone(310, 0.11, 'square', 0.07, this.sfxGain, 0, -210, start, detune);
        break;
      case EFFECT_TYPE.HEAL:
        this.tone(660, 0.09, 'square', 0.065, this.sfxGain, 0, 180, start, detune);
        this.tone(990, 0.12, 'sine', 0.05, this.sfxGain, 0.055, -80, start, -detune);
        break;
      case EFFECT_TYPE.GRID_FADE:
        this.filteredNoise(0.5, 0.32, this.sfxGain, start, 520);
        this.tone(110, 0.42, 'sawtooth', 0.13, this.sfxGain, 0, -62, start, detune);
        this.tone(58, 0.62, 'square', 0.09, this.sfxGain, 0.04, -24, start, -detune);
        break;
      default: break;
    }
  }

  playExplosion(start, intensity, detune) {
    const strength = Math.min(1.35, Math.max(0.65, intensity));
    this.filteredNoise(0.3, 0.42 * strength, this.sfxGain, start, 700);
    this.filteredNoise(0.1, 0.2 * strength, this.sfxGain, start + 0.025, 2600);
    this.tone(92, 0.24, 'sawtooth', 0.15 * strength, this.sfxGain, 0, -58, start, detune);
    this.tone(54, 0.32, 'square', 0.09 * strength, this.sfxGain, 0.018, -22, start, -detune);
  }

  playRangedAttack(attackStyle, start, detune) {
    switch (attackStyle) {
      case ATTACK_ANIMATION.LIGHTNING:
        this.filteredNoise(0.025, 0.12, this.sfxGain, start, 3200);
        this.tone(1480, 0.085, 'square', 0.12, this.sfxGain, 0, -920, start, detune);
        this.tone(690, 0.06, 'sawtooth', 0.07, this.sfxGain, 0.018, 420, start, -detune);
        break;
      case ATTACK_ANIMATION.MISSILE:
        this.filteredNoise(0.08, 0.1, this.sfxGain, start, 1800);
        this.tone(130, 0.16, 'square', 0.1, this.sfxGain, 0, 680, start, detune);
        this.tone(620, 0.07, 'sawtooth', 0.06, this.sfxGain, 0.08, -300, start, -detune);
        break;
      case ATTACK_ANIMATION.LOB:
        this.tone(240, 0.07, 'square', 0.1, this.sfxGain, 0, 360, start, detune);
        this.tone(680, 0.09, 'sawtooth', 0.05, this.sfxGain, 0.035, -420, start, -detune);
        break;
      case ATTACK_ANIMATION.LASER:
        this.filteredNoise(0.035, 0.045, this.sfxGain, start, 1200);
        this.tone(340, 0.14, 'sawtooth', 0.13, this.sfxGain, 0, -230, start, detune);
        this.tone(190, 0.12, 'square', 0.075, this.sfxGain, 0.012, 160, start, -detune);
        break;
      default:
        this.tone(720, 0.065, 'square', 0.12, this.sfxGain, 0, 340, start, detune);
        this.tone(360, 0.045, 'sawtooth', 0.045, this.sfxGain, 0.016, 190, start, -detune);
        break;
    }
  }

  playBattleResult(playerWon) {
    if (!this.unlock() || this.settings.musicMuted) return;
    const start = this.context.currentTime + 0.02;
    if (playerWon) {
      this.synthTone(60, 0.28, 0.1, this.musicGain, { at: start, type: 'sawtooth', cutoff: 1200 });
      this.synthTone(64, 0.32, 0.09, this.musicGain, { at: start + 0.11, type: 'square', cutoff: 1700 });
      this.synthTone(67, 0.4, 0.11, this.musicGain, { at: start + 0.22, type: 'sawtooth', cutoff: 2100 });
      this.synthTone(72, 0.55, 0.09, this.musicGain, { at: start + 0.34, type: 'square', cutoff: 2500 });
      return;
    }
    this.synthTone(48, 0.3, 0.1, this.musicGain, { at: start, type: 'sawtooth', cutoff: 800, sweep: -45 });
    this.synthTone(45, 0.38, 0.08, this.musicGain, { at: start + 0.14, type: 'square', cutoff: 650, sweep: -55 });
    this.synthTone(41, 0.58, 0.1, this.musicGain, { at: start + 0.29, type: 'sawtooth', cutoff: 500, sweep: -35 });
  }

  playUiSound(cue = 'tap') {
    if (!this.unlock() || this.settings.sfxMuted) return;
    const start = this.context.currentTime + 0.006;
    switch (cue) {
      case 'select':
        this.tone(620, 0.04, 'square', 0.055, this.sfxGain, 0, 140, start);
        this.tone(880, 0.045, 'square', 0.035, this.sfxGain, 0.03, -60, start);
        break;
      case 'place':
        this.tone(190, 0.05, 'square', 0.05, this.sfxGain, 0, -60, start);
        this.filteredNoise(0.02, 0.025, this.sfxGain, start, 1500);
        break;
      default:
        this.tone(520, 0.035, 'square', 0.045, this.sfxGain, 0, 90, start);
        break;
    }
  }

  tone(frequency, duration, type, volume, destination, offset = 0, sweep = 0, at = this.context.currentTime, detune = 0) {
    if (!this.context || !destination) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const start = at + offset;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
    oscillator.detune.setValueAtTime(detune, start);
    if (sweep) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequency + sweep), start + duration);
    gain.gain.setValueAtTime(Math.max(0.0001, volume), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  synthTone(note, duration, volume, destination, { at = this.context.currentTime, type = 'square', cutoff = 1400, sweep = 0 } = {}) {
    const frequency = midiFrequency(note);
    this.filteredTone(frequency, duration, type, volume, destination, at, cutoff, sweep);
  }

  filteredTone(frequency, duration, type, volume, destination, at, cutoff, sweep = 0) {
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    if (sweep) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequency + sweep), at + duration);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, at);
    filter.Q.value = 0.7;
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.01);
  }

  filteredNoise(duration, volume, destination, at, cutoff) {
    if (!this.context || !this.noiseBuffer || !destination) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, at);
    gain.gain.setValueAtTime(Math.max(0.0001, volume), at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.start(at);
    source.stop(at + duration + 0.01);
  }
}
