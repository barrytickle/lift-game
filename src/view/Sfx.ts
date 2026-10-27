// Tiny WebAudio synth: every sound is a couple of oscillator blips, no files.

type Wave = OscillatorType;

export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  /** Must be called from a user gesture (first tap) to satisfy autoplay rules. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(freq: number, dur: number, wave: Wave = 'sine', vol = 0.15, slideTo?: number, delay = 0): void {
    if (this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  tap(): void {
    this.tone(660, 0.05, 'triangle', 0.08);
  }

  ding(): void {
    this.tone(1046, 0.35, 'sine', 0.12);
    this.tone(1318, 0.45, 'sine', 0.08, undefined, 0.09);
  }

  board(): void {
    this.tone(380, 0.09, 'triangle', 0.12, 620);
  }

  coin(step: number): void {
    const base = 880 * Math.pow(2, Math.min(step, 8) / 12 * 2);
    this.tone(base, 0.08, 'square', 0.05);
    this.tone(base * 1.5, 0.16, 'square', 0.05, undefined, 0.06);
  }

  walkout(): void {
    this.tone(220, 0.25, 'sawtooth', 0.08, 110);
  }

  spawn(): void {
    this.tone(520, 0.05, 'sine', 0.04, 700);
  }

  perk(): void {
    [660, 880, 1175].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.09, undefined, i * 0.07));
  }

  buy(): void {
    this.tone(784, 0.08, 'square', 0.05);
    this.tone(1568, 0.25, 'sine', 0.08, undefined, 0.07);
  }

  nope(): void {
    this.tone(180, 0.12, 'square', 0.05);
  }

  gameOver(): void {
    [523, 440, 349, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.1, undefined, i * 0.16));
  }
}

/** One synth for the whole game so the unlocked AudioContext survives scene changes. */
export const sfx = new Sfx();
