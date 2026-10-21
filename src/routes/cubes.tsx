// @ts-nocheck -- canvas drawing with bounds-checked arrays
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Arena, LEVELS, CUBE_COLORS, type Level, type Sfx } from "@/lib/cubes";
import { Button } from "@/components/ui/button";

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

// Procedural sound effects in the punchy style of physics battle Shorts.
class CubeAudio {
  ctx = new AudioContext(); out: GainNode; dest: MediaStreamAudioDestinationNode; last: Record<string, number> = {};
  constructor() {
    const lim = this.ctx.createDynamicsCompressor(); lim.threshold.value = -8; lim.ratio.value = 10;
    this.out = this.ctx.createGain(); this.out.gain.value = 0.7; this.out.connect(lim);
    this.dest = this.ctx.createMediaStreamDestination(); lim.connect(this.ctx.destination); lim.connect(this.dest);
  }
  private tone(f: number, d: number, type: OscillatorType, v: number, to?: number, at = 0) {
    const t = this.ctx.currentTime + at, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + d + 0.02);
  }
  private noise(d: number, freq: number, v: number) {
    const len = Math.floor(this.ctx.sampleRate * d), b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), c = b.getChannelData(0);
    for (let i = 0; i < len; i++) c[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = b; f.type = "lowpass"; f.frequency.value = freq; g.gain.value = v;
    s.connect(f); f.connect(g); g.connect(this.out); s.start();
  }
  play(e: Sfx) {
    const now = this.ctx.currentTime, gap = { bounce: 0.05, hit: 0.04, shoot: 0.06, pop: 0.03 }[e] ?? 0;
    if (now - (this.last[e] ?? 0) < gap) return; this.last[e] = now;
    const r = 0.9 + Math.random() * 0.2;
    switch (e) {
      case "bounce": this.tone(520 * r, 0.06, "square", 0.08, 260); break;
      case "hit": this.tone(220 * r, 0.09, "sawtooth", 0.18, 90); this.noise(0.06, 3000, 0.25); break;
      case "kill": this.noise(0.35, 1800, 0.7); this.tone(160, 0.4, "sine", 0.5, 40); break;
      case "shoot": this.noise(0.05, 5000, 0.22); this.tone(900 * r, 0.04, "square", 0.06, 300); break;
      case "boom": this.noise(0.7, 900, 0.9); this.tone(90, 0.6, "sine", 0.7, 30); break;
      case "pop": this.tone(700 * r, 0.07, "triangle", 0.2, 1400); break;
      case "break": this.noise(0.15, 2500, 0.4); this.tone(300, 0.12, "triangle", 0.2, 120); break;
      case "win": [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, "triangle", 0.3, undefined, i * 0.12)); break;
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
      if (intro > 0) intro -= dt; else for (let i = 0; i < 2; i++) arena.step(dt / 2);
      for (const e of arena.events) audio.current?.play(e); arena.events.length = 0;
      if (arena.over && !endAt) endAt = now;
      if (endAt && now - endAt > 3500 && recorder.current?.state === "recording") recorder.current.stop();
      // draw
      ctx.fillStyle = "#0b0d14"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "900 78px system-ui";
      ctx.fillText(arena.over ? "WINNER!" : "WHICH COLOR WINS?", W / 2, 150);
      ctx.font = "800 44px system-ui"; ctx.fillStyle = "#ffd400"; ctx.fillText(LEVELS[level].toUpperCase(), W / 2, 220);
      const n = arena.counts(); const bw = W / teams;
      n.forEach((k, i) => {
        ctx.fillStyle = CUBE_COLORS[i][1]; ctx.globalAlpha = k ? 1 : 0.25;
        ctx.fillRect(i * bw + 14, 280, bw - 28, 90);
        ctx.fillStyle = "#000"; ctx.font = "900 50px system-ui"; ctx.fillText(String(k), i * bw + bw / 2, 343); ctx.globalAlpha = 1;
      });
      const sh = arena.shake;
      ctx.save(); ctx.translate(ox + (Math.random() - 0.5) * sh, oy + (Math.random() - 0.5) * sh); ctx.scale(S, S);
      ctx.fillStyle = "#151a28"; ctx.fillRect(0, 0, 1000, 1000);
      ctx.strokeStyle = "#2a3350"; ctx.lineWidth = 2;
      for (let g = 50; g < 1000; g += 50) { ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, 1000); ctx.moveTo(0, g); ctx.lineTo(1000, g); ctx.stroke(); }
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 10; ctx.strokeRect(0, 0, 1000, 1000);
      if (level === "maze") {
        ctx.fillStyle = "#cfd6ff"; for (const w of arena.walls) ctx.fillRect(w.x, w.y, w.w, w.h);
        const gl = arena.goal; ctx.fillStyle = "#22d36b"; ctx.fillRect(gl.x, gl.y, gl.w, gl.h);
        ctx.fillStyle = "#000"; ctx.font = "900 28px system-ui"; ctx.fillText("FINISH", gl.x + gl.w / 2, gl.y + 30);
      }
      for (const b of arena.blocks) {
        ctx.fillStyle = ["#555", "#8a8fa8", "#b7bdd8", "#e6e9ff"][b.hp] ?? "#e6e9ff"; ctx.fillRect(b.x, b.y, b.w, b.h);
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
        ctx.fillStyle = "#000"; const e = cu.s * 0.14; ctx.fillRect(-cu.s * 0.25, -cu.s * 0.15, e, e); ctx.fillRect(cu.s * 0.11, -cu.s * 0.15, e, e);
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
    const a = audio.current!, stream = new MediaStream([...canvas.current!.captureStream(60).getVideoTracks(), ...a.dest.stream.getAudioTracks()]);
    const chunks: Blob[] = [], r = new MediaRecorder(stream, { mimeType: "video/webm", videoBitsPerSecond: 12_000_000 });
    r.ondataavailable = (e) => chunks.push(e.data);
    r.onstop = () => { setRec(false); setUrl(URL.createObjectURL(new Blob(chunks, { type: "video/webm" }))); };
    recorder.current = r; setTimeout(() => r.start(), 50); setRec(true);
  };
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
