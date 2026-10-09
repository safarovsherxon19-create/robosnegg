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

  /** Crunchy "nom" bite sound. */
  eat() {
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.09);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const bp = this.ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 0.8;
    const g = this.ctx.createGain(); g.gain.value = 0.7;
    src.connect(bp); bp.connect(g); g.connect(this.master); src.start(t);
    this.tone(520, t, 0.12, "square", 0.12, this.master, 880);
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
