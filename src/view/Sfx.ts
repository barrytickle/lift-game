// Tiny WebAudio synth: most sounds are a couple of oscillator blips. A few real
// recordings (public/sfx) replace synth placeholders; see design/asset-list.md.
// Files are fetched at startup and decoded once the first tap unlocks audio;
// until then (or if loading fails) the synth version plays instead.

type Wave = OscillatorType;

const MUTE_KEY = 'going-up-muted';

const SAMPLES = { ding: 'sfx/ding.wav', move: 'sfx/move.wav', music: 'sfx/music.mp3' } as const;
const MUSIC_VOL = 0.32;
type SampleName = keyof typeof SAMPLES;

function fetchSamples(): Map<SampleName, Promise<ArrayBuffer>> {
  const m = new Map<SampleName, Promise<ArrayBuffer>>();
  if (typeof fetch === 'undefined') return m;
  for (const [name, url] of Object.entries(SAMPLES) as [SampleName, string][]) {
    m.set(name, fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(url)))));
  }
  return m;
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export class Sfx {
  private ctx: AudioContext | null = null;
  muted = readMuted();
  private raw = fetchSamples();
  private buffers = new Map<SampleName, AudioBuffer>();
  /** the lift-motor loop, running (silently when idle) once started */
  private motor: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  /** background music: starts once decoded after the first tap, then loops through every scene */
  private music: GainNode | null = null;

  /** Mute toggle from the menu; remembered between visits. */
  setMuted(on: boolean): void {
    this.muted = on;
    if (on) this.motorLevel(0);
    if (this.music && this.ctx) this.music.gain.setTargetAtTime(on ? 0 : MUSIC_VOL, this.ctx.currentTime, 0.1);
    try {
      localStorage.setItem(MUTE_KEY, on ? '1' : '0');
    } catch {
      // private mode: the toggle still works for this visit
    }
  }

  /** Must be called from a user gesture (first tap) to satisfy autoplay rules. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.decodeSamples();
  }

  private decodeSamples(): void {
    const ctx = this.ctx!;
    for (const [name, data] of this.raw) {
      this.raw.delete(name);
      data
        // Older Safari only has the callback form of decodeAudioData.
        .then((buf) => new Promise<AudioBuffer>((ok, fail) => ctx.decodeAudioData(buf, ok, fail)))
        .then((b) => {
          this.buffers.set(name, b);
          if (name === 'music') this.startMusic(b);
        })
        .catch(() => {
          // missing or undecodable: the synth fallback keeps playing
        });
    }
  }

  private startMusic(buf: AudioBuffer): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    src.loop = true;
    // Some browsers keep the MP3 encoder's padding: skip silent samples at both ends so the loop is seamless.
    const data = buf.getChannelData(0);
    let a = 0;
    let b = data.length - 1;
    while (a < b && Math.abs(data[a]) < 1e-4) a++;
    while (b > a && Math.abs(data[b]) < 1e-4) b--;
    src.loopStart = a / buf.sampleRate;
    src.loopEnd = (b + 1) / buf.sampleRate;
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(this.muted ? 0 : MUSIC_VOL, ctx.currentTime, 0.6); // gentle fade in
    src.connect(gain).connect(ctx.destination);
    src.start(0, src.loopStart);
    this.music = gain;
  }

  /** Play a recording; false if it isn't ready (caller falls back to the synth). */
  private sample(name: SampleName, vol: number, rate = 1): boolean {
    const buf = this.buffers.get(name);
    if (!buf || !this.ctx) return false;
    if (this.muted) return true;
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    src.buffer = buf;
    src.playbackRate.value = rate;
    gain.gain.value = vol;
    src.connect(gain).connect(this.ctx.destination);
    src.start();
    return true;
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

  /** Drop-off bell; `step` (the nth drop-off at this stop) nudges the pitch up for group drop-offs. */
  dropOff(step: number): void {
    if (this.sample('ding', 0.7, Math.pow(2, Math.min(step, 6) / 12))) return;
    this.ding();
  }

  /**
   * Lift motor hum, called every frame: 0 = silent, 1 = full speed. The loop
   * fades rather than stopping, and its pitch rises a little with speed.
   */
  motorLevel(speed: number): void {
    const ctx = this.ctx;
    const buf = this.buffers.get('move');
    if (!ctx || !buf) return;
    const level = this.muted ? 0 : Math.max(0, Math.min(1, speed));
    if (!this.motor) {
      if (level === 0) return;
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = buf;
      src.loop = true;
      gain.gain.value = 0;
      src.connect(gain).connect(ctx.destination);
      src.start();
      this.motor = { src, gain };
    }
    const t = ctx.currentTime;
    this.motor.gain.gain.setTargetAtTime(0.4 * Math.sqrt(level), t, level > 0 ? 0.05 : 0.12);
    this.motor.src.playbackRate.setTargetAtTime(0.85 + 0.25 * level, t, 0.1);
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

  /** A heart breaks: soft and sorry rather than harsh. */
  lifeLost(): void {
    this.tone(659, 0.18, 'sine', 0.09);
    this.tone(523, 0.22, 'sine', 0.08, undefined, 0.14);
    this.tone(392, 0.45, 'triangle', 0.07, 349, 0.3);
  }

  /** Breather over: a cheerful little "back to work". */
  resume(): void {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.07, undefined, i * 0.08));
  }

  /** Results screen: one tick per stat as it lands; `big` for a new personal best. */
  stat(big: boolean): void {
    this.tone(big ? 988 : 784, 0.12, 'triangle', 0.08);
    if (big) this.tone(1319, 0.25, 'sine', 0.07, undefined, 0.08);
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
