import type { Sfx } from './sfx';

/**
 * Procedural soundtrack: a lookahead step sequencer (16ths) driving a few synth voices.
 * Each biome has its own key/scale and drum feel. Intensity (0..4, from the kill streak)
 * adds layers: hats → bass drive → arpeggio → lead. Calm rooms drop to pads.
 */
interface BiomeTheme {
  root: number; // MIDI note
  scale: number[];
  bpm: number;
  progression: number[]; // scale degrees per bar
  kick: number[]; // 16-step patterns (1 = hit)
  snare: number[];
  bassWave: OscillatorType;
  padWave: OscillatorType;
}

const THEMES: BiomeTheme[] = [
  // Ashen Gardens — D dorian, warm and driving
  { root: 50, scale: [0, 2, 3, 5, 7, 9, 10], bpm: 138, progression: [0, 5, 3, 4], kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], bassWave: 'sawtooth', padWave: 'triangle' },
  // Drowned Archive — E phrygian, mysterious
  { root: 52, scale: [0, 1, 3, 5, 7, 8, 10], bpm: 132, progression: [0, 1, 5, 3], kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1], bassWave: 'triangle', padWave: 'sine' },
  // Clockwork Foundry — C minor, mechanical
  { root: 48, scale: [0, 2, 3, 5, 7, 8, 11], bpm: 144, progression: [0, 0, 5, 4], kick: [1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0], bassWave: 'square', padWave: 'sawtooth' },
  // Starless Crown — F# minor, ethereal and urgent
  { root: 54, scale: [0, 2, 3, 5, 7, 8, 10], bpm: 148, progression: [0, 5, 6, 4], kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0], bassWave: 'sawtooth', padWave: 'triangle' },
];

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  biome = 0;
  /** 0..4 from the kill streak */
  intensity = 0;
  /** true while enemies are present */
  combat = false;
  boss = false;
  enabled = true;
  private bus: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;

  constructor(private sfx: Sfx) {}

  start() {
    const c = this.sfx.ctx;
    if (!c || this.timer !== null) return;
    if (!this.bus) {
      this.filter = c.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 2400;
      this.bus = c.createGain();
      this.bus.gain.value = 0.55;
      this.bus.connect(this.filter);
      this.filter.connect(this.sfx.musicBus);
    }
    this.nextTime = c.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private schedule() {
    const c = this.sfx.ctx;
    if (!c || !this.bus || c.state !== 'running' || !this.enabled) return;
    const th = THEMES[Math.min(3, this.biome)];
    const spb = 60 / th.bpm / 4; // seconds per 16th
    // open the filter as intensity rises; muffle in calm rooms
    const target = this.combat ? 1400 + this.intensity * 900 + (this.boss ? 800 : 0) : 900;
    this.filter!.frequency.setTargetAtTime(target, c.currentTime, 0.4);
    while (this.nextTime < c.currentTime + 0.12) {
      this.playStep(th, this.step, this.nextTime, spb);
      this.nextTime += spb;
      this.step = (this.step + 1) % 64;
    }
  }

  private note(type: OscillatorType, freq: number, t: number, dur: number, gain: number, attack = 0.005, glideTo = 0) {
    const c = this.sfx.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.bus!);
    o.start(t);
    o.stop(t + dur + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }

  private noise(t: number, dur: number, gain: number, hp: number) {
    const c = this.sfx.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.sfx.noiseBuffer;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.bus!);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
    s.onended = () => {
      s.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }

  private playStep(th: BiomeTheme, step: number, t: number, spb: number) {
    const s16 = step % 16;
    const bar = Math.floor(step / 16) % th.progression.length;
    const deg = th.progression[bar];
    const chordRoot = th.root + th.scale[deg % 7] + (deg >= 7 ? 12 : 0);
    const third = th.root + th.scale[(deg + 2) % 7] + (deg + 2 >= 7 ? 12 : 0);
    const fifth = th.root + th.scale[(deg + 4) % 7] + (deg + 4 >= 7 ? 12 : 0);
    const I = this.intensity;
    // pad: always, every bar
    if (s16 === 0) {
      const vol = this.combat ? 0.045 : 0.07;
      for (const m of [chordRoot, third, fifth]) this.note(th.padWave, mtof(m), t, spb * 16, vol, 0.25);
    }
    if (!this.combat) {
      // calm: a soft plucked arpeggio
      if (s16 % 4 === 0) this.note('triangle', mtof([chordRoot, third, fifth, third][(s16 / 4) | 0] + 12), t, spb * 3, 0.035, 0.003);
      return;
    }
    // drums
    if (th.kick[s16] || (I >= 3 && s16 % 4 === 0)) this.note('sine', 150, t, 0.22, 0.55, 0.002, 42);
    if (th.snare[s16]) {
      this.noise(t, 0.14, 0.18, 1800);
      this.note('triangle', 220, t, 0.08, 0.08, 0.002, 140);
    }
    const hatEvery = I >= 2 ? 1 : 2;
    if (s16 % hatEvery === 0) this.noise(t, 0.035, s16 % 4 === 2 ? 0.07 : 0.04, 7000);
    // bass
    const bassPattern = [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0];
    if (bassPattern[s16] || (I >= 1 && s16 % 2 === 0)) {
      const oct = s16 % 8 === 6 ? 12 : 0;
      this.note(th.bassWave, mtof(chordRoot - 24 + oct), t, spb * 1.6, 0.09, 0.004);
    }
    // arpeggio from intensity 2
    if (I >= 2 && s16 % 2 === 1) {
      const arp = [chordRoot, third, fifth, chordRoot + 12, fifth, third];
      this.note('square', mtof(arp[((step / 2) | 0) % arp.length] + 12), t, spb * 0.9, 0.022, 0.002);
    }
    // lead hits from intensity 3 / boss
    if ((I >= 3 || this.boss) && (s16 === 0 || s16 === 6 || s16 === 10)) {
      this.note('sawtooth', mtof(fifth + 12), t, spb * 2.5, 0.028, 0.01);
    }
  }
}
