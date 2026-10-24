// @ts-nocheck -- canvas drawing with bounds-checked arrays
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Arena, LEVELS, CUBE_COLORS, RACE_TARGET, SUDDEN_DEATH, type Level, type Sfx } from "@/lib/cubes";
import { Button } from "@/components/ui/button";
import { createRecordingCapture, recordingOptions } from "@/lib/recording";

export const Route = createFileRoute("/cubes")({
  head: () => ({
    meta: [
      { title: "Cube Battle — Which Color Wins?" },
      { name: "description", content: "Chaotic cube battle simulations: sawblades, weapons, multiplying cubes and maze races. Pick a color and record Shorts." },
      { property: "og:title", content: "Cube Battle — Which Color Wins?" },
      { property: "og:description", content: "Pick your color and watch cubes fight through sawblades, guns, block breakers and mazes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Cubes,
});

// Procedural layered sound effects (thump + click + body + room reverb).
class CubeAudio {
  ctx = new AudioContext(); out: GainNode; dest: MediaStreamAudioDestinationNode; last: Record<string, number> = {};
  constructor() {
    const ctx = this.ctx, lim = ctx.createDynamicsCompressor(); lim.threshold.value = -10; lim.ratio.value = 12; lim.attack.value = 0.002;
    this.out = ctx.createGain(); this.out.gain.value = 0.75; this.out.connect(lim);
    // short room reverb for "big arena" feel
    const len = ctx.sampleRate * 0.9, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
    const conv = ctx.createConvolver(), wet = ctx.createGain(); conv.buffer = ir; wet.gain.value = 0.18;
    this.out.connect(conv); conv.connect(wet); wet.connect(lim);
    this.dest = ctx.createMediaStreamDestination(); lim.connect(ctx.destination); lim.connect(this.dest);
  }
  private tone(f: number, d: number, type: OscillatorType, v: number, to?: number, at = 0) {
    const t = this.ctx.currentTime + at, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + d + 0.02);
  }
  private noise(d: number, freq: number, v: number, type: BiquadFilterType = "lowpass", at = 0) {
    const t = this.ctx.currentTime + at, len = Math.floor(this.ctx.sampleRate * d), b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), c = b.getChannelData(0);
    for (let i = 0; i < len; i++) c[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = b; f.type = type; f.frequency.value = freq; g.gain.value = v;
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t);
  }
  play(e: Sfx) {
    const now = this.ctx.currentTime, gap = { bounce: 0.045, hit: 0.035, shoot: 0.07, pop: 0.03, laser: 0.09, clang: 0.06 }[e] ?? 0;
    if (now - (this.last[e] ?? 0) < gap) return; this.last[e] = now;
    const r = 0.88 + Math.random() * 0.24;
    switch (e) {
      case "bounce": this.tone(900 * r, 0.05, "triangle", 0.14, 420); this.noise(0.02, 4000, 0.08, "highpass"); break;
      case "hit": this.tone(140 * r, 0.12, "sine", 0.55, 50); this.noise(0.05, 2500, 0.35); this.tone(380 * r, 0.06, "square", 0.08, 200); break;
      case "kill": this.noise(0.6, 3000, 0.6, "highpass"); this.noise(0.4, 900, 0.7); this.tone(180, 0.6, "sine", 0.8, 35);
        [1800, 2400, 3100].forEach((f, i) => this.tone(f * r, 0.25, "triangle", 0.08, f * 0.7, 0.02 * i)); break;
      case "shoot": this.noise(0.06, 6000, 0.3, "bandpass"); this.tone(160, 0.05, "sine", 0.3, 60); break;
      case "boom": this.noise(1.1, 700, 1); this.tone(70, 0.9, "sine", 0.9, 25); this.noise(0.15, 5000, 0.4, "highpass"); break;
      case "pop": this.tone(600 * r, 0.08, "sine", 0.35, 1500); this.noise(0.02, 3000, 0.1, "highpass"); break;
      case "break": this.noise(0.3, 3500, 0.5, "highpass"); this.tone(250, 0.15, "triangle", 0.3, 90); break;
      case "clang": [523, 1187, 1789, 2633].forEach((f) => this.tone(f * r, 0.35, "square", 0.04, f * 0.97)); this.noise(0.04, 6000, 0.25, "highpass"); break;
      case "laser": this.tone(1600 * r, 0.12, "sawtooth", 0.1, 240); break;
      case "tick": this.tone(1500, 0.05, "sine", 0.25); this.tone(1500, 0.05, "sine", 0.18, undefined, 0.15); break;
      case "fall": this.tone(1100 * r, 0.6, "sine", 0.3, 90); this.noise(0.4, 1200, 0.3, "lowpass", 0.5); break;
      case "score": [880, 1320, 1760].forEach((f, i) => this.tone(f, 0.25, "triangle", 0.3, undefined, i * 0.06)); break;
      case "win": [523, 659, 784, 1046, 1318].forEach((f, i) => { this.tone(f, 0.5, "triangle", 0.35, undefined, i * 0.11); this.tone(f / 2, 0.5, "square", 0.08, undefined, i * 0.11); });
        this.noise(1.5, 8000, 0.15, "highpass", 0.55); break;
    }
  }
}

function Cubes() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [level, setLevel] = useState<Level>("saw");
  const [teams, setTeams] = useState(6);
  const [run, setRun] = useState(0);
  const [rec, setRec] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const audio = useRef<CubeAudio | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const arenaRef = useRef<Arena | null>(null);

  useEffect(() => {
    const c = canvas.current!, ctx = c.getContext("2d")!;
    const arena = new Arena(level, teams); arenaRef.current = arena;
    const W = 1080, H = 1920, S = 1000 * 0.96 / 1000 * W / 1000, ox = (W - 1000 * S) / 2, oy = 470;
    let raf = 0, prev = performance.now(), endAt = 0, intro = 2.2;
    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - prev) / 1000); prev = now;
      if (intro > 0) { const c0 = Math.ceil(intro / 0.75); intro -= dt; if (Math.ceil(intro / 0.75) !== c0) audio.current?.play(intro > 0 ? "tick" : "score"); }
      else for (let i = 0; i < 2; i++) arena.step(dt / 2);
      for (const e of arena.events) audio.current?.play(e); arena.events.length = 0;
      if (arena.over && !endAt) endAt = now;
      if (endAt && now - endAt > 3500 && recorder.current?.state === "recording") recorder.current.stop();
      // draw
      ctx.fillStyle = "#0b0d14"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "900 78px system-ui";
      ctx.fillText(arena.over ? "WINNER!" : "WHICH COLOR WINS?", W / 2, 150);
      ctx.font = "800 44px system-ui"; ctx.fillStyle = "#ffd400"; ctx.fillText(LEVELS[level].toUpperCase(), W / 2, 220);
      const race = arena.race, n = race ? arena.score : arena.counts(); const bw = W / teams;
      n.forEach((k, i) => {
        ctx.fillStyle = CUBE_COLORS[i][1]; ctx.globalAlpha = k || race ? 1 : 0.25;
        ctx.fillRect(i * bw + 14, 280, bw - 28, 90);
        ctx.fillStyle = "#000"; ctx.font = "900 50px system-ui"; ctx.fillText(race ? `${k}/${RACE_TARGET}` : String(k), i * bw + bw / 2, 343); ctx.globalAlpha = 1;
      });
      if (!arena.over && intro <= 0) {
        const sd = arena.t > SUDDEN_DEATH; ctx.font = "800 38px system-ui"; ctx.fillStyle = sd ? "#ff3b3b" : "#9aa3c0";
        ctx.fillText(sd ? "⚠ SUDDEN DEATH ⚠" : `⏱ ${Math.floor(arena.t)}s`, W / 2, 425);
      }
      const sh = arena.shake;
      ctx.save(); ctx.translate(ox + (Math.random() - 0.5) * sh, oy + (Math.random() - 0.5) * sh); ctx.scale(S, S);
      ctx.fillStyle = "#151a28"; ctx.fillRect(0, 0, 1000, 1000);
      ctx.strokeStyle = "#2a3350"; ctx.lineWidth = 2;
      for (let g = 50; g < 1000; g += 50) { ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, 1000); ctx.moveTo(0, g); ctx.lineTo(1000, g); ctx.stroke(); }
      if (level === "sumo") {
        ctx.fillStyle = "#05060a"; ctx.fillRect(0, 0, 1000, 1000);
        ctx.fillStyle = "#e8d3a0"; ctx.beginPath(); ctx.arc(500, 500, arena.ring, 0, 7); ctx.fill();
        ctx.strokeStyle = "#b33"; ctx.lineWidth = 14; ctx.stroke();
      }
      const ins = arena.inset;
      if (ins > 0) { ctx.fillStyle = "rgba(255,40,40,0.25)"; ctx.fillRect(0, 0, 1000, ins); ctx.fillRect(0, 1000 - ins, 1000, ins); ctx.fillRect(0, ins, ins, 1000 - 2 * ins); ctx.fillRect(1000 - ins, ins, ins, 1000 - 2 * ins); }
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 10; if (level !== "sumo") ctx.strokeRect(ins, ins, 1000 - 2 * ins, 1000 - 2 * ins);
      if (level === "spikes") {
        ctx.fillStyle = "#e6e9ff";
        for (let k = 0; k < 1000; k += 40) for (const [x, y, dx, dy] of [[k, 0, 0, 1], [k, 1000, 0, -1], [0, k, 1, 0], [1000, k, -1, 0]]) {
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (dy ? 40 : 0), y + (dx ? 40 : 0)); ctx.lineTo(x + (dy ? 20 : dx * 26), y + (dx ? 20 : dy * 26)); ctx.fill();
        }
      }
      for (const l of arena.lasers) {
        ctx.save(); ctx.translate(500, 500); ctx.rotate(l.a);
        ctx.shadowColor = "#ff2a6d"; ctx.shadowBlur = 30; ctx.fillStyle = "#ff2a6d"; ctx.fillRect(40, -9, 1000, 18);
        ctx.fillStyle = "#fff"; ctx.fillRect(40, -3, 1000, 6); ctx.restore();
      }
      if (arena.lasers.length) { ctx.fillStyle = "#333a55"; ctx.beginPath(); ctx.arc(500, 500, 44, 0, 7); ctx.fill(); }
      for (const b of arena.bombs) {
        ctx.strokeStyle = "rgba(255,60,60,0.6)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(b.x, b.y, 200 * (1 - b.t / 1.8), 0, 7); ctx.stroke();
        ctx.fillStyle = Math.floor(b.t * 8) % 2 ? "#ff3b3b" : "#222"; ctx.beginPath(); ctx.arc(b.x, b.y, 26, 0, 7); ctx.fill();
      }
      if (race) {
        ctx.fillStyle = "#cfd6ff";
        for (const w of arena.walls) { if (level === "plinko") { ctx.beginPath(); ctx.arc(w.x + 9, w.y + 9, 11, 0, 7); ctx.fill(); } else ctx.fillRect(w.x, w.y, w.w, w.h); }
        const gl = arena.goal; ctx.fillStyle = "#22d36b"; ctx.fillRect(gl.x, gl.y, gl.w, gl.h);
        ctx.fillStyle = "#000"; ctx.font = "900 28px system-ui"; ctx.fillText("FINISH", gl.x + gl.w / 2, gl.y + 30);
      }
      for (const b of arena.blocks) {
        ctx.fillStyle = ["#555", "#8a8fa8", "#b7bdd8", "#e6e9ff"][Math.ceil(b.hp / 7)] ?? "#e6e9ff"; ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = "#000"; ctx.font = "800 26px system-ui"; ctx.fillText("+1", b.x + b.w / 2, b.y + b.h / 2 + 9);
      }
      for (const s of arena.saws) {
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a); ctx.fillStyle = "#c9ced8"; ctx.beginPath();
        for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, r = k % 2 ? s.r * 0.8 : s.r; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.fill(); ctx.fillStyle = "#e33"; ctx.beginPath(); ctx.arc(0, 0, s.r * 0.25, 0, 7); ctx.fill(); ctx.restore();
      }
      for (const g of arena.guns) {
        ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.a); ctx.fillStyle = g.kind === "rpg" ? "#556b2f" : "#444";
        ctx.fillRect(0, -10, g.kind === "rpg" ? 70 : 60, 20); ctx.beginPath(); ctx.arc(0, 0, 28, 0, 7); ctx.fill(); ctx.restore();
      }
      for (const b of arena.bullets) { ctx.fillStyle = b.kind === "rpg" ? "#ff6a00" : "#ffe36b"; ctx.beginPath(); ctx.arc(b.x, b.y, b.kind === "rpg" ? 12 : 5, 0, 7); ctx.fill(); }
      for (const cu of arena.cubes) if (cu.alive) {
        ctx.save(); ctx.translate(cu.x, cu.y); ctx.rotate(level === "maze" ? cu.rot : 0);
        const col = CUBE_COLORS[cu.team][1]; ctx.shadowColor = col; ctx.shadowBlur = 20;
        ctx.fillStyle = cu.flash > 0 ? "#fff" : col; ctx.fillRect(-cu.s / 2, -cu.s / 2, cu.s, cu.s); ctx.shadowBlur = 0;
        ctx.strokeStyle = "#000"; ctx.lineWidth = 4; ctx.strokeRect(-cu.s / 2, -cu.s / 2, cu.s, cu.s);
        const e = cu.s * 0.26; ctx.fillStyle = "#fff"; ctx.fillRect(-cu.s * 0.36, -cu.s * 0.24, e, e); ctx.fillRect(cu.s * 0.1, -cu.s * 0.24, e, e); ctx.fillStyle = "#000"; const pu = e * 0.55; ctx.fillRect(-cu.s * 0.36 + e - pu, -cu.s * 0.24 + (e - pu) / 2, pu, pu); ctx.fillRect(cu.s * 0.1 + e - pu, -cu.s * 0.24 + (e - pu) / 2, pu, pu);
        if (level !== "multiply" && level !== "maze") { ctx.fillStyle = "#000"; ctx.fillRect(-cu.s / 2, -cu.s / 2 - 14, cu.s, 8); ctx.fillStyle = "#3f3"; ctx.fillRect(-cu.s / 2, -cu.s / 2 - 14, cu.s * Math.max(0, cu.hp) / 100, 8); }
        ctx.restore();
      }
      for (const p of arena.sparks) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
      ctx.globalAlpha = 1; ctx.restore();
      if (intro > 0) { ctx.fillStyle = "#fff"; ctx.font = "900 150px system-ui"; ctx.fillText(String(Math.ceil(intro / 0.75)), W / 2, oy + 560); }
      if (arena.over && arena.winner !== null) {
        const [name, col] = CUBE_COLORS[arena.winner]; ctx.fillStyle = col; ctx.font = "900 120px system-ui";
        ctx.fillText(`${name.toUpperCase()} WINS!`, W / 2, oy + 1000 * S + 170);
      } else { ctx.fillStyle = "#fff"; ctx.font = "800 54px system-ui"; ctx.fillText("Comment your color 👇", W / 2, oy + 1000 * S + 150); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [level, teams, run]);

  const start = () => { audio.current ??= new CubeAudio(); void audio.current.ctx.resume(); setUrl(null); setRun((r) => r + 1); };
  const record = () => {
    start();
    const c = canvas.current, a = audio.current;
    if (!c || !a) return;
    const capture = createRecordingCapture(c, a.dest.stream.getAudioTracks());
    const chunks: Blob[] = [], r = new MediaRecorder(capture.stream, recordingOptions());
    r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    r.onstop = () => { capture.dispose(); setRec(false); setUrl(URL.createObjectURL(new Blob(chunks, { type: r.mimeType }))); };
    recorder.current = r; r.start(1000); setRec(true);
  };
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("auto") !== "1") return;
    const lv = q.get("level") as Level | null;
    if (lv && lv in LEVELS) setLevel(lv);
    const t = setTimeout(() => record(), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const sel = "rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground";
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-end justify-center gap-4 border-b border-border p-4">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Game
          <Link to="/" className={sel + " hover:bg-accent"}>🟥 Cube Battle → 🐍 Snake</Link>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Level
          <select className={sel} value={level} onChange={(e) => setLevel(e.target.value as Level)} disabled={rec}>
            {Object.entries(LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Colors
          <select className={sel} value={teams} onChange={(e) => setTeams(+e.target.value)} disabled={rec}>
            {[2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n} cubes</option>)}
          </select>
        </label>
      </header>
      <div className="flex flex-1 items-center justify-center p-4">
        <canvas ref={canvas} width={1080} height={1920} className="h-[75vh] w-auto rounded-lg border border-border" />
      </div>
      <footer className="flex flex-wrap justify-center gap-3 border-t border-border p-4">
        <Button variant="secondary" onClick={start} disabled={rec}>New battle</Button>
        <Button onClick={record} disabled={rec}>{rec ? "Recording…" : "● Record video"}</Button>
        {url && <a href={url} download={`cube-battle-${level}.webm`} className="inline-flex items-center rounded-md bg-primary px-4 text-sm text-primary-foreground">Download video</a>}
      </footer>
    </main>
  );
}
