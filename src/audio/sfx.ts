import { TUNING } from '../config/tuning';

type OscType = OscillatorType;

/**
 * Procedural sound engine. Every sound is layered from a few synthesized voices
 * (oscillators + filtered noise) with random pitch variation so repeated hits never sound identical.
 */
export class Sfx {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  private comp!: DynamicsCompressorNode;
  private noise!: AudioBuffer;
  private voices = 0;
  private last: Record<string, number> = {};
  muted = false;
  volumes = { master: TUNING.audio.master, sfx: TUNING.audio.sfx, music: TUNING.audio.music };

  /** must be called from a user gesture (iOS) */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
        if (!AC) return;
        // iOS: let WebAudio play even with the silent switch on (Safari 17+)
        const nav = navigator as unknown as { audioSession?: { type: string } };
        if (nav.audioSession) {
          try {
            nav.audioSession.type = 'playback';
          } catch {
            /* ignore */
          }
        }
        this.ctx = new AC({ latencyHint: 'interactive' });
        const c = this.ctx;
        this.comp = c.createDynamicsCompressor();
        this.comp.threshold.value = -14;
        this.comp.knee.value = 10;
        this.comp.ratio.value = 5;
        this.comp.attack.value = 0.002;
        this.comp.release.value = 0.12;
        this.master = c.createGain();
        this.sfxBus = c.createGain();
        this.musicBus = c.createGain();
        this.sfxBus.connect(this.comp);
        this.musicBus.connect(this.comp);
        this.comp.connect(this.master);
        this.master.connect(c.destination);
        this.applyVolumes();
        const len = c.sampleRate;
        this.noise = c.createBuffer(1, len, c.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch (e) {
      console.warn('audio unavailable', e);
    }
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : this.volumes.master;
    this.sfxBus.gain.value = this.volumes.sfx;
    this.musicBus.gain.value = this.volumes.music;
  }

  private ready(name: string, minGap = TUNING.audio.retrigger, priority = 1) {
    const c = this.ctx;
    if (!c || c.state !== 'running' || this.muted) return false;
    if (this.voices > TUNING.audio.maxVoices && priority < 2) return false;
    const now = c.currentTime;
    if ((this.last[name] ?? -1) > now - minGap) return false;
    this.last[name] = now;
    return true;
  }

  private vary(k = 1) {
    return 1 + (Math.random() * 2 - 1) * TUNING.audio.pitchVariation * k;
  }

  /** oscillator voice with pitch sweep and AD envelope */
  private osc(type: OscType, f0: number, f1: number, dur: number, gain: number, delay = 0, attack = 0.003, dest?: AudioNode) {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
    this.voices++;
    o.onended = () => {
      this.voices--;
      o.disconnect();
      g.disconnect();
    };
  }

  /** filtered noise burst with a filter sweep */
  private nz(type: BiquadFilterType, f0: number, f1: number, q: number, dur: number, gain: number, delay = 0, attack = 0.002, dest?: AudioNode) {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(Math.max(30, f0), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest ?? this.sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
    this.voices++;
    s.onended = () => {
      this.voices--;
      s.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }

  // ════════════════════ COMBAT ════════════════════

  swing(weapon: string, step: number, finisher: boolean) {
    if (!this.ready('swing', 0.02)) return;
    const k = this.vary() * (1 + step * TUNING.audio.comboPitchStep);
    const heavy = weapon === 'anvil';
    const dur = heavy ? 0.22 : finisher ? 0.2 : 0.11;
    this.nz('bandpass', (heavy ? 300 : 700) * k, (heavy ? 1200 : 2600) * k, 1.4, dur, finisher ? 0.32 : 0.2);
    this.nz('highpass', 3000 * k, 6000 * k, 0.7, dur * 0.6, 0.05, 0.01);
    if (finisher || heavy) this.osc('sine', 120 * k, 260 * k, dur, 0.12, 0, 0.02);
  }

  hit(power: number, crit: boolean, combo: number, armored: boolean) {
    if (!this.ready('hit', 0.018, 2)) return;
    const k = this.vary() * (1 + Math.min(combo, 6) * TUNING.audio.comboPitchStep * 0.5);
    const p = 0.4 + power * 0.8;
    // low thump
    this.osc('sine', 170 * k, 42, 0.1 + power * 0.1, 0.55 * p);
    // meaty body
    this.nz('lowpass', 2400 * k, 300, 0.8, 0.08 + power * 0.06, 0.4 * p);
    // crack
    this.nz('bandpass', 3200 * k, 1400 * k, 1.2, 0.04, 0.32 * p);
    if (armored) {
      this.osc('triangle', 820 * k, 760 * k, 0.16, 0.12);
      this.osc('square', 1230 * k, 1180 * k, 0.1, 0.04);
    }
    if (crit) {
      this.osc('triangle', 1320 * k, 1250 * k, 0.32, 0.16, 0.005);
      this.osc('triangle', 1985 * k, 1900 * k, 0.26, 0.1, 0.01);
      this.nz('highpass', 6000, 9000, 0.5, 0.12, 0.12, 0.004);
      this.osc('sine', 90, 35, 0.25, 0.4);
    }
  }

  dotTick() {
    if (!this.ready('dot', 0.08)) return;
    this.nz('bandpass', 1800 * this.vary(), 1200, 2, 0.04, 0.05);
  }

  kill(tier: number, style: number, size: number) {
    if (!this.ready('kill', 0.025, 2)) return;
    const k = this.vary() * (1 + tier * TUNING.audio.streakPitchStep);
    const big = Math.min(1.5, size / 18);
    this.osc('sine', 120 * k, 38, 0.22 * big, 0.5);
    this.nz('lowpass', 4000 * k, 400, 0.7, 0.18 * big, 0.35);
    if (style === 1) {
      // shatter: glassy clicks
      for (let i = 0; i < 4; i++) this.nz('highpass', 4000 + Math.random() * 3000, 2500, 1, 0.05, 0.14, i * 0.018);
      this.osc('triangle', 2200 * k, 1300 * k, 0.18, 0.08);
    } else if (style === 2) {
      this.nz('bandpass', 500 * k, 2400 * k, 1, 0.16, 0.18);
    } else {
      this.nz('bandpass', 900 * k, 500 * k, 1.5, 0.12, 0.2);
    }
    if (tier > 0) this.osc('triangle', 660 * k * (1 + tier * 0.12), 990 * k * (1 + tier * 0.12), 0.12, 0.05 + tier * 0.012, 0.03);
  }

  lastKill() {
    if (!this.ready('lastkill', 0.2, 2)) return;
    this.osc('sine', 90, 30, 0.9, 0.7);
    this.nz('lowpass', 5000, 200, 0.7, 0.8, 0.45);
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => this.osc('triangle', f, f, 0.6, 0.09, 0.05 + i * 0.045, 0.01));
    this.nz('highpass', 7000, 10000, 0.5, 0.6, 0.06, 0.1, 0.1);
  }

  dash() {
    if (!this.ready('dash', 0.05)) return;
    const k = this.vary();
    this.nz('lowpass', 500 * k, 3200 * k, 1, 0.15, 0.24, 0, 0.02);
    this.nz('bandpass', 1500 * k, 5000 * k, 2, 0.1, 0.06, 0.01);
    this.osc('sine', 260 * k, 520 * k, 0.12, 0.06);
  }

  shoot(kind: string) {
    if (!this.ready('shoot', 0.04)) return;
    const k = this.vary();
    if (kind === 'bow') {
      this.osc('triangle', 300 * k, 120 * k, 0.1, 0.15);
      this.nz('highpass', 2500 * k, 6000, 0.6, 0.08, 0.12);
    } else {
      this.nz('bandpass', 1800 * k, 4200 * k, 1.5, 0.08, 0.16);
      this.osc('triangle', 900 * k, 1500 * k, 0.06, 0.05);
    }
  }

  cast() {
    if (!this.ready('cast', 0.08)) return;
    const k = this.vary(0.5);
    [660, 880, 1320].forEach((f, i) => this.osc('triangle', f * k, f * k * 1.02, 0.18, 0.07, i * 0.03));
    this.nz('bandpass', 2000, 5000, 2, 0.2, 0.05);
  }

  castBoom() {
    if (!this.ready('castboom', 0.06, 2)) return;
    const k = this.vary();
    this.osc('sine', 140 * k, 45, 0.3, 0.55);
    this.nz('lowpass', 3000 * k, 300, 0.8, 0.28, 0.35);
    this.osc('triangle', 1760 * k, 1600 * k, 0.3, 0.06, 0.02);
    this.osc('sine', 2640 * k, 2500 * k, 0.25, 0.04, 0.04);
  }

  hurt() {
    if (!this.ready('hurt', 0.1, 3)) return;
    const k = this.vary(0.5);
    this.osc('square', 240 * k, 70, 0.22, 0.2);
    this.osc('sine', 110, 40, 0.3, 0.6);
    this.nz('lowpass', 3000, 300, 0.8, 0.2, 0.4);
    this.nz('bandpass', 900, 600, 3, 0.25, 0.1, 0.03);
  }

  explosion(size: number) {
    if (!this.ready('boom', 0.05, 2)) return;
    const k = this.vary();
    const s = Math.min(1.4, Math.max(0.5, size / 80));
    this.osc('sine', 85 * k, 28, 0.45 * s, 0.7);
    this.nz('lowpass', 4000 * k, 120, 0.7, 0.55 * s, 0.55);
    this.nz('bandpass', 700 * k, 200, 1, 0.3 * s, 0.25, 0.02);
  }

  enemyShoot(kind: number) {
    if (!this.ready('eshoot', 0.05)) return;
    const k = this.vary();
    if (kind === 5) {
      this.osc('sine', 220 * k, 400 * k, 0.15, 0.08);
      this.nz('lowpass', 800, 300, 1, 0.12, 0.08);
    } else if (kind === 9) {
      this.osc('sawtooth', 1800 * k, 300 * k, 0.18, 0.08);
      this.nz('highpass', 3000, 1500, 1, 0.12, 0.1);
    } else {
      this.osc('square', 760 * k, 330 * k, 0.07, 0.035);
    }
  }

  telegraph(dur: number) {
    if (!this.ready('tg', 0.12)) return;
    const k = this.vary(0.6);
    this.osc('sine', 520 * k, 980 * k, Math.min(0.25, dur * 0.6), 0.035);
  }

  spawn() {
    if (!this.ready('spawn', 0.06)) return;
    const k = this.vary();
    this.nz('bandpass', 300 * k, 1800 * k, 3, 0.35, 0.06, 0, 0.25);
    this.osc('sine', 180 * k, 420 * k, 0.35, 0.03, 0, 0.2);
  }

  block() {
    if (!this.ready('block', 0.04, 2)) return;
    const k = this.vary();
    this.osc('triangle', 940 * k, 900 * k, 0.22, 0.16);
    this.osc('square', 1410 * k, 1350 * k, 0.12, 0.05);
    this.nz('highpass', 4000, 3000, 1, 0.07, 0.18);
  }

  deflect() {
    if (!this.ready('deflect', 0.04)) return;
    const k = this.vary();
    this.osc('triangle', 1600 * k, 1200 * k, 0.1, 0.07);
    this.nz('highpass', 5000, 4000, 1, 0.04, 0.08);
  }

  freeze() {
    if (!this.ready('freeze', 0.08)) return;
    const k = this.vary();
    this.nz('highpass', 6000 * k, 3000, 1, 0.3, 0.12);
    this.osc('triangle', 2600 * k, 2400 * k, 0.4, 0.06);
    this.osc('triangle', 3900 * k, 3600 * k, 0.3, 0.03, 0.03);
  }

  lightning() {
    if (!this.ready('zap', 0.05)) return;
    const k = this.vary();
    this.osc('sawtooth', 2200 * k, 120, 0.16, 0.1);
    for (let i = 0; i < 3; i++) this.nz('bandpass', 2000 + Math.random() * 4000, 1500, 2, 0.03, 0.12, i * 0.025);
  }

  armorBreak() {
    if (!this.ready('armor', 0.1, 2)) return;
    this.osc('triangle', 700, 300, 0.4, 0.18);
    this.nz('highpass', 3000, 1500, 0.8, 0.3, 0.3);
    this.osc('sine', 100, 40, 0.3, 0.5);
  }

  pickup() {
    if (!this.ready('pickup', 0.05)) return;
    const k = this.vary(0.3);
    this.osc('triangle', 988 * k, 988 * k, 0.1, 0.07);
    this.osc('triangle', 1318 * k, 1318 * k, 0.14, 0.07, 0.05);
  }

  gold() {
    if (!this.ready('gold', 0.04)) return;
    const k = this.vary(0.3);
    this.osc('square', 1975 * k, 1975 * k, 0.06, 0.025);
    this.osc('square', 2637 * k, 2637 * k, 0.1, 0.025, 0.04);
  }

  heal() {
    if (!this.ready('heal', 0.1)) return;
    [523, 659, 784].forEach((f, i) => this.osc('sine', f, f * 1.01, 0.3, 0.08, i * 0.06, 0.02));
  }

  streakTier(tier: number) {
    if (!this.ready('streak', 0.1, 2)) return;
    const base = 440 * Math.pow(2, tier / 6);
    [1, 1.25, 1.5, 2].forEach((m, i) => this.osc('triangle', base * m, base * m, 0.25, 0.07, i * 0.04, 0.005));
    this.nz('highpass', 6000, 9000, 0.6, 0.3, 0.05, 0.05, 0.05);
  }

  streakEnd(count: number) {
    if (count < 5 || !this.ready('streakend', 0.2)) return;
    this.osc('triangle', 660, 440, 0.3, 0.06);
  }

  deathDefy() {
    if (!this.ready('defy', 0.3, 3)) return;
    [392, 523, 659, 784, 1046].forEach((f, i) => this.osc('triangle', f, f, 0.5, 0.09, i * 0.05));
    this.osc('sine', 80, 30, 0.8, 0.6);
  }

  death() {
    if (!this.ready('death', 0.5, 3)) return;
    this.osc('sine', 200, 30, 1.4, 0.5);
    this.osc('triangle', 330, 110, 1.2, 0.12);
    this.nz('lowpass', 2000, 100, 0.7, 1.2, 0.3);
  }

  door() {
    if (!this.ready('door', 0.1)) return;
    this.nz('bandpass', 400, 2400, 2, 0.4, 0.08, 0, 0.1);
    [784, 1175].forEach((f, i) => this.osc('triangle', f, f, 0.4, 0.05, i * 0.08, 0.02));
  }

  roomEnter() {
    if (!this.ready('enter', 0.2)) return;
    this.nz('lowpass', 3000, 300, 0.8, 0.3, 0.18, 0, 0.01);
    this.osc('sine', 60, 120, 0.3, 0.25);
  }

  bossRoar() {
    if (!this.ready('roar', 0.5, 3)) return;
    this.osc('sawtooth', 90, 60, 1.1, 0.18, 0, 0.1);
    this.osc('sawtooth', 135, 80, 1.0, 0.1, 0.02, 0.1);
    this.nz('lowpass', 1200, 300, 1, 1.0, 0.3, 0, 0.15);
  }

  slam() {
    if (!this.ready('slam', 0.05)) return;
    this.osc('sine', 110 * this.vary(), 40, 0.2, 0.45);
    this.nz('lowpass', 1500, 200, 1, 0.15, 0.3);
  }

  uiClick() {
    if (!this.ctx) return;
    if (!this.ready('ui', 0.03, 3)) return;
    this.osc('sine', 1400, 1100, 0.05, 0.08);
  }

  uiConfirm() {
    if (!this.ready('uiok', 0.05, 3)) return;
    [660, 990, 1320].forEach((f, i) => this.osc('triangle', f, f, 0.18, 0.08, i * 0.035));
  }

  reward() {
    if (!this.ready('reward', 0.2, 3)) return;
    [523, 784, 1046, 1568].forEach((f, i) => this.osc('triangle', f, f, 0.4, 0.07, i * 0.05));
    this.nz('highpass', 6000, 9000, 0.6, 0.4, 0.05, 0.1, 0.1);
  }

  chargeReady() {
    if (!this.ready('charge', 0.1, 2)) return;
    this.osc('triangle', 1568, 1568, 0.16, 0.09);
    this.osc('sine', 2350, 2350, 0.12, 0.05, 0.02);
  }

  burrow() {
    if (!this.ready('burrow', 0.1)) return;
    this.nz('lowpass', 600, 200, 1, 0.35, 0.25);
  }

  teleport() {
    if (!this.ready('tp', 0.08)) return;
    this.osc('sine', 1200, 300, 0.18, 0.06);
    this.nz('bandpass', 3000, 800, 2, 0.15, 0.06);
  }

  /** used by the music system */
  get musicDest(): AudioNode | null {
    return this.ctx ? this.musicBus : null;
  }
  get noiseBuffer() {
    return this.noise;
  }
}
