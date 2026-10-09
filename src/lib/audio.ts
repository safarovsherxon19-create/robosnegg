import biteAsset from "@/assets/robo-snake-bite.mp3.asset.json";
// Procedural game audio (Web Audio). Everything routes to speakers AND a
// MediaStream so recordings include the same sound the player hears.
export class GameAudio {
  ctx: AudioContext;
  master: GainNode;
  musicGain: GainNode;
  dest: MediaStreamAudioDestinationNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private beat = 0;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.dest = this.ctx.createMediaStreamDestination();
    this.master.connect(this.ctx.destination);
    this.master.connect(this.dest);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.master);
  }

  resume() { if (this.ctx.state === "suspended") void this.ctx.resume(); }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, out: AudioNode, slideTo?: number) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }

  private biteBuf: AudioBuffer | null = null;
  private biteLoading = false;
  private loadBite() {
    if (this.biteLoading) return;
    this.biteLoading = true;
    fetch(biteAsset.url).then((r) => r.arrayBuffer()).then((a) => this.ctx.decodeAudioData(a))
      .then((b) => { this.biteBuf = b; }).catch(() => {});
  }

  /** Game bite: enhanced real apple crunch, pitch-varied each bite, plus a juicy pop. */
  eat() {
    this.loadBite();
    if (this.biteBuf) {
      const t0 = this.ctx.currentTime;
      const src = this.ctx.createBufferSource(); src.buffer = this.biteBuf;
      src.playbackRate.value = 1.08 + Math.random() * 0.22; // snappier, never identical
      const g = this.ctx.createGain(); g.gain.value = 1.0;
      src.connect(g); g.connect(this.master); src.start(t0);
      // Tiny arcade "pop" on top so it fits the game feel.
      this.tone(620 + Math.random() * 120, t0, 0.09, "triangle", 0.12, this.master, 1250);
      return;
    }
    this.synthEat();
  }

  private synthEat() {
    const t0 = this.ctx.currentTime;
    // Layered noise bursts: the first is the crisp skin "crack", the later
    // ones are the fibrous crunch of the flesh, getting softer and lower.
    const bursts = [
      { at: 0, dur: 0.035, freq: 5200, q: 1.1, vol: 0.95 },
      { at: 0.04, dur: 0.05, freq: 3100, q: 0.9, vol: 0.75 },
      { at: 0.09, dur: 0.07, freq: 2100, q: 0.8, vol: 0.55 },
      { at: 0.15, dur: 0.08, freq: 1400, q: 0.7, vol: 0.35 },
    ];
    for (const b of bursts) {
      const len = Math.floor(this.ctx.sampleRate * b.dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const bp = this.ctx.createBiquadFilter(); bp.type = "bandpass";
      bp.frequency.value = b.freq * (0.9 + Math.random() * 0.2); bp.Q.value = b.q;
      const g = this.ctx.createGain(); g.gain.value = b.vol;
      src.connect(bp); bp.connect(g); g.connect(this.master); src.start(t0 + b.at);
    }
    // Wet jaw-close thump plus a juicy squelch under the crunch.
    this.tone(190, t0 + 0.02, 0.16, "sine", 0.3, this.master, 65);
    this.tone(880, t0 + 0.05, 0.12, "sawtooth", 0.06, this.master, 260);
  }

  // Upbeat chiptune loop in A minor: bass + arpeggio + hi-hat.
  private static BASS = [45, 45, 41, 41, 43, 43, 40, 40];
  private static ARP = [0, 3, 7, 12, 7, 3, 0, 7];
  private schedule() {
    const step = 60 / 128 / 2; // eighth notes at 128 BPM
    while (this.nextTime < this.ctx.currentTime + 0.2) {
      const t = this.nextTime, b = this.beat;
      const root = GameAudio.BASS[Math.floor(b / 4) % 8] ?? 45;
      const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
      if (b % 2 === 0) this.tone(hz(root), t, step * 1.8, "triangle", 0.5, this.musicGain);
      this.tone(hz(root + 24 + (GameAudio.ARP[b % 8] ?? 0)), t, step * 0.9, "square", 0.12, this.musicGain);
      this.tone(8000, t, 0.03, "square", b % 4 === 2 ? 0.06 : 0.025, this.musicGain);
      this.nextTime += step; this.beat++;
    }
  }
  startMusic() {
    if (this.timer) return;
    this.resume();
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 50);
  }
  stopMusic() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}
