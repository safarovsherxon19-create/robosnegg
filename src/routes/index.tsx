// @ts-nocheck -- array index access is bounds-checked by game logic
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Game, type Mode } from "@/lib/snake";
import { GameAudio } from "@/lib/audio";
import { digestionPulse } from "@/lib/digestion";
import { BANNER_HOOKS, bannerStage } from "@/lib/video-banner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Pause, Play, Square, RotateCcw } from "lucide-react";
import "@fontsource/noto-emoji/400.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Snake — Perfect Runs & ASMR Video Recording" },
      { name: "description", content: "Satisfying Snake runs from half-full to perfect, with colorful boards, bite sounds and YouTube video recording." },
      { property: "og:title", content: "Snake — Perfect Runs & ASMR Video Recording" },
      { property: "og:description", content: "Half-full to perfect: colorful Snake gameplay with satisfying bite sounds and minimal progress banners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const SIZES = [
  { label: "10 × 10", w: 10, h: 10 },
  { label: "16 × 16", w: 16, h: 16 },
  { label: "20 × 20", w: 20, h: 20 },
  { label: "30 × 30", w: 30, h: 30 },
  { label: "16 × 28 (Shorts)", w: 16, h: 28 },
  { label: "32 × 18 (Long)", w: 32, h: 18 },
  { label: "Custom…", w: 0, h: 0 },
];
const FORMATS = {
  long: { w: 1920, h: 1080, label: "YouTube Long 16:9" },
  shorts: { w: 1080, h: 1920, label: "YouTube Shorts 9:16" },
};
const THEMES = {
  google: "Google", neon: "Neon", sunset: "Sunset", classic: "Classic", ocean: "Ocean",
  candy: "Candy", fire: "Fire", lime: "Lime", ice: "Ice", gold: "Gold", rainbow: "Rainbow",
};
const HEADS = [
  { id: "snake", label: "Snake", icon: "🐍" },
  { id: "robot", label: "Robot", icon: "🤖" },
  { id: "cat", label: "Cat", icon: "🐱" },
  { id: "dragon", label: "Dragon", icon: "🐲" },
  { id: "alien", label: "Alien", icon: "👽" },
  { id: "tiger", label: "Tiger", icon: "🐯" },
  { id: "panda", label: "Panda", icon: "🐼" },
  { id: "fox", label: "Fox", icon: "🦊" },
  { id: "skull", label: "Skull", icon: "💀" },
];

function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const autoRecTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sizeI, setSizeI] = useState(2);
  const [format, setFormat] = useState<keyof typeof FORMATS>("long");
  const [theme, setTheme] = useState<keyof typeof THEMES>("google");
  const [speed, setSpeed] = useState(30);
  const [speedText, setSpeedText] = useState("30");
  const [headStyle, setHeadStyle] = useState("snake");
  const paletteRef = useRef({});
  const winColors = useRef({ overlay: "", text: "" });
  const mouthCols = useRef({ mouth: "", tongue: "", teeth: "" });
  const bannerColors = useRef({});
  const bannerIndex = useRef(0);
  const eatAt = useRef(-1000);
  const stepFraction = useRef(0);
  const [autoRec, setAutoRec] = useState(true);
  const [mode, setMode] = useState<Mode>("classic");
  const [music, setMusic] = useState(true);
  const [customW, setCustomW] = useState("24");
  const [customH, setCustomH] = useState("14");
  const [sizeError, setSizeError] = useState("");
  const audioRef = useRef<GameAudio | null>(null);
  const ensureAudio = () => { if (!audioRef.current) audioRef.current = new GameAudio(); audioRef.current.resume(); return audioRef.current; };
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [headOpen, setHeadOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [video, setVideo] = useState<{ url: string; ext: string; format: keyof typeof FORMATS } | null>(null);
  const [stats, setStats] = useState({ len: 3, total: 400, eaten: 0 });
  const cfg = useRef({ speed, theme, format, headStyle, paused, ended });
  cfg.current = { speed, theme, format, headStyle, paused, ended };
  const winAt = useRef(0);

  const startRec = () => {
    const c = canvasRef.current;
    if (!c || (recRef.current && recRef.current.state !== "inactive")) return;
    const recordedFormat = format;
    const recordedMode = mode;
    const stream = c.captureStream(60);
    const a = ensureAudio().dest.stream.getAudioTracks()[0];
    if (a) stream.addTrack(a.clone());
    const types = ["video/mp4;codecs=avc1,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
    const r = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 16_000_000 });
    chunks.current = [];
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      const blob = new Blob(chunks.current, { type: mime || "video/webm" });
      setVideo({ url: URL.createObjectURL(blob), ext: mime.includes("mp4") ? "mp4" : "webm", format: recordedFormat, mode: recordedMode });
      stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
    };
    r.start(1000);
    if (cfg.current.paused) r.pause();
    recRef.current = r;
    setRecording(true);
    setVideo(null);
  };
  const stopRec = () => {
    const recorder = recRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };
  const togglePause = () => {
    if (!running || gameRef.current?.won) return;
    const recorder = recRef.current;
    if (paused && recorder?.state === "paused") recorder.resume();
    if (!paused && recorder?.state === "recording") recorder.pause();
    if (paused && music) audioRef.current?.startMusic(); else audioRef.current?.stopMusic();
    setPaused(!paused);
  };
  const endGame = () => {
    if (autoRecTimer.current) clearTimeout(autoRecTimer.current);
    autoRecTimer.current = null;
    setRunning(false);
    setPaused(false);
    setEnded(true);
    audioRef.current?.stopMusic();
    stopRec();
  };

  const start = () => {
    let s = SIZES[sizeI];
    if (!s.w) {
      const w = Number(customW), h = Number(customH);
      if (!Number.isInteger(w) || !Number.isInteger(h) || w < 4 || h < 4 || w > 60 || h > 60) { setSizeError("Width and height must be whole numbers from 4 to 60."); return; }
      if (w % 2 && h % 2) { setSizeError("Width or height must be an even number."); return; }
      s = { label: "", w, h };
    }
    setSizeError("");
    gameRef.current = new Game(s.w, s.h, gameRef.current?.variant, mode);
    const requestedBanner = Number(new URLSearchParams(window.location.search).get("banner"));
    bannerIndex.current = new URLSearchParams(window.location.search).has("banner") && Number.isInteger(requestedBanner)
      ? ((requestedBanner % BANNER_HOOKS.length) + BANNER_HOOKS.length) % BANNER_HOOKS.length
      : Math.floor(Math.random() * BANNER_HOOKS.length);
    stepFraction.current = 0;
    eatAt.current = -1000;
    const au = ensureAudio();
    au.stopMusic();
    if (music) au.startMusic();
    setStats({ len: gameRef.current.snake.length, total: s.w * s.h, eaten: 0 });
    winAt.current = 0;
    setPaused(false);
    setEnded(false);
    setRunning(true);
    if (recRef.current?.state === "paused") recRef.current.resume();
    if (autoRecTimer.current) clearTimeout(autoRecTimer.current);
    if (autoRec && !recording) autoRecTimer.current = setTimeout(startRec, 50);
  };

  // Automation: ?auto=1&w=10&h=10&mode=classic|double&format=shorts|long&speed=15&theme=neon&head=snake
  const [autoGo, setAutoGo] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!q.has("auto")) return;
    const w = Number(q.get("w")) || 10, h = Number(q.get("h")) || 10;
    const i = SIZES.findIndex((s) => s.w === w && s.h === h);
    if (i >= 0) setSizeI(i); else { setSizeI(SIZES.length - 1); setCustomW(String(w)); setCustomH(String(h)); }
    setMode(q.get("mode") === "double" ? "double" : "classic");
    setFormat(q.get("format") === "long" ? "long" : "shorts");
    const sp = Math.min(600, Math.max(1, Number(q.get("speed")) || 15));
    setSpeed(sp); setSpeedText(String(sp));
    const th = q.get("theme") || "google"; if (th in THEMES) setTheme(th as keyof typeof THEMES);
    const hd = q.get("head") || "snake"; if (HEADS.some((x) => x.id === hd)) setHeadStyle(hd);
    setAutoRec(true);
    setAutoGo(true);
  }, []);
  useEffect(() => {
    if (!autoGo) return;
    setAutoGo(false);
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGo]);

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const token = (name: string) => styles.getPropertyValue(name).trim();
    for (const key of Object.keys(THEMES)) {
      paletteRef.current[key] = {
        bg: token(`--snake-${key}-bg`), board: token(`--snake-${key}-board`) || token(`--snake-${key}-bg`), grid: token(`--snake-${key}-grid`),
        a: token(`--snake-${key}-a`).split(",").map(Number),
        b: token(`--snake-${key}-b`).split(",").map(Number), text: token(`--snake-${key}-text`),
      };
    }
    winColors.current = { overlay: token("--snake-win-overlay"), text: token("--snake-win-text") };
    mouthCols.current = { mouth: token("--snake-mouth"), tongue: token("--snake-tongue"), teeth: token("--snake-teeth"), eye: token("--snake-eye"), pupil: token("--snake-pupil") };
    bannerColors.current = Object.fromEntries(["bg", "text", "muted", "track", "accent"].map((key) => [key, token(`--snake-banner-${key}`)]));
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const F = FORMATS[format];
    c.width = F.w; c.height = F.h;
  }, [format]);

  useEffect(() => {
    let raf = 0, last = performance.now(), acc = stepFraction.current;
    const loop = (t: number) => {
      const g = gameRef.current;
      const dt = Math.min(0.1, (t - last) / 1000); last = t;
      if (g && running && !paused && !g.won) {
        acc += dt * cfg.current.speed;
        let n = Math.floor(acc); acc -= n;
        stepFraction.current = acc;
        let ate = false, turned = false;
        while (n-- > 0 && !g.won) { ate = g.step() || ate; turned = g.turned || turned; }
        if (turned && !ate) audioRef.current?.turn();
        if (ate) { audioRef.current?.eat(); eatAt.current = t; }
        setStats({ len: g.snake.length, total: g.N, eaten: g.eaten });
      }
      if (g?.won) {
        setRunning(false);
        setPaused(false);
        if (!winAt.current) { winAt.current = t; audioRef.current?.stopMusic(); }
        else if (t - winAt.current > 3000 && recRef.current?.state === "recording") stopRec();
      }
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, paused]);

  const draw = (t: number) => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    const T = paletteRef.current[cfg.current.theme];
    if (!ctx || !T) return;
    const W = c.width, H = c.height;
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    const g = gameRef.current;
    const vertical = H > W;
    const hud = vertical ? 280 : 190;
    ctx.fillStyle = T.text; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (!g) {
      ctx.font = `800 ${vertical ? 72 : 56}px system-ui, "Noto Emoji", sans-serif`;
      ctx.fillText("🐍 SNAKE", W / 2, hud * 0.4);
      ctx.font = "500 40px system-ui"; ctx.fillText("Press Start to begin", W / 2, H / 2); return;
    }
    // Minimal banner sits above the board, in the same recorded canvas.
    const B = bannerColors.current;
    const bx = vertical ? 64 : 180, by = 28, bannerW = W - bx * 2, bannerH = hud - 40;
    const inset = vertical ? 34 : 40;
    ctx.fillStyle = B.bg;
    ctx.beginPath(); ctx.roundRect(bx, by, bannerW, bannerH, 8); ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = B.muted;
    ctx.font = `600 ${vertical ? 25 : 22}px system-ui`;
    ctx.fillText(`${mode === "double" ? "2x CLASSIC" : "CLASSIC"}  /  ${bannerStage(g.snake.length, g.N)}`, bx + inset, by + 32);
    ctx.fillStyle = B.text;
    ctx.font = `700 ${vertical ? 44 : 40}px system-ui`;
    ctx.fillText(BANNER_HOOKS[bannerIndex.current], bx + inset, by + (vertical ? 91 : 74), bannerW - inset * 2);
    ctx.fillStyle = B.muted;
    ctx.font = `500 ${vertical ? 28 : 24}px system-ui`;
    ctx.fillText(`${g.snake.length}/${g.N} CELLS`, bx + inset, by + bannerH - 49);
    ctx.textAlign = "right"; ctx.fillStyle = B.accent;
    ctx.fillText(`${Math.floor(g.snake.length / g.N * 100)}%`, bx + bannerW - inset, by + bannerH - 49);
    const trackY = by + bannerH - 24, trackW = bannerW - inset * 2;
    ctx.fillStyle = B.track; ctx.fillRect(bx + inset, trackY, trackW, 5);
    ctx.fillStyle = B.accent; ctx.fillRect(bx + inset, trackY, trackW * g.snake.length / g.N, 5);
    ctx.textAlign = "center";
    const pad = 40;
    const cell = Math.floor(Math.min((W - pad * 2) / g.W, (H - hud - pad * 2) / g.H));
    const bw = cell * g.W, bh = cell * g.H;
    const ox = Math.floor((W - bw) / 2), oy = Math.floor(hud + (H - hud - bh) / 2);
    ctx.fillStyle = T.board; ctx.fillRect(ox, oy, bw, bh);
    ctx.fillStyle = T.grid;
    for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) if ((x + y) % 2 === 0) ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
    ctx.strokeStyle = T.text; ctx.globalAlpha = 0.25; ctx.lineWidth = 3; ctx.strokeRect(ox - 2, oy - 2, bw + 4, bh + 4); ctx.globalAlpha = 1;
    {
      const s = cell * (0.85 + 0.08 * Math.sin(t / 150));
      ctx.fillStyle = T.text;
      ctx.font = `${s}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Noto Emoji",sans-serif`;
      for (const f of g.foods) ctx.fillText(f.fruit, ox + f.p.x * cell + cell / 2, oy + f.p.y * cell + cell / 2 + cell * 0.05);
    }
    const L = g.snake.length, gap = Math.max(1, cell * 0.08);
    for (let i = L - 1; i >= 0; i--) {
      const p = g.snake[i], k = i / Math.max(1, L - 1);
      const col = T.a.map((v, j) => Math.round(v + (T.b[j] - v) * k));
      ctx.fillStyle = `rgb(${col.join(",")})`;
      const x = ox + p.x * cell, y = oy + p.y * cell;
      // connect to previous segment
      const q = g.snake[i - 1];
      ctx.beginPath(); ctx.roundRect(x + gap, y + gap, cell - gap * 2, cell - gap * 2, cell * 0.3); ctx.fill();
      if (q) {
        const minx = Math.min(p.x, q.x), miny = Math.min(p.y, q.y);
        const dx = Math.abs(p.x - q.x), dy = Math.abs(p.y - q.y);
        ctx.fillRect(ox + minx * cell + gap + (dx ? cell / 2 : 0), oy + miny * cell + gap + (dy ? cell / 2 : 0), dx ? cell : cell - gap * 2, dy ? cell : cell - gap * 2);
      }
    }
    // Continuous swelling moves relative to the body, including around bends.
    // One index per step would keep it fixed at the original bite's board cell.
    for (const b of g.bulges) {
      const pulse = digestionPulse(g.steps + stepFraction.current - b, L);
      if (!pulse) continue;
      for (let offset = -0.65; offset <= 0.65; offset += 0.1) {
        const at = pulse.position + offset;
        if (at < 0 || at > L - 1) continue;
        const i = Math.floor(at), p = g.snake[i], q = g.snake[Math.min(i + 1, L - 1)];
        if (!p || !q) continue;
        const f = at - i, k = at / Math.max(1, L - 1);
        const col = T.a.map((v, j) => Math.round(v + (T.b[j] - v) * k));
        ctx.fillStyle = `rgb(${col.join(",")})`;
        const radius = cell * (0.42 + pulse.swelling * Math.exp(-8 * offset * offset));
        ctx.beginPath();
        ctx.arc(ox + (p.x + (q.x - p.x) * f + 0.5) * cell, oy + (p.y + (q.y - p.y) * f + 0.5) * cell, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const h = g.snake[0];
    const near = g.foods.reduce((m, f) => Math.min(m, Math.abs(f.p.x - h.x) + Math.abs(f.p.y - h.y)), Infinity);
    let mouth = near <= 3 ? (4 - near) / 3 : 0; // opens wider as fruit gets closer
    // Chomp: jaws snap shut right at the bite, then reopen over ~200 ms.
    const sinceEat = t - eatAt.current;
    if (sinceEat < 200) mouth = Math.max(mouth, 0.85) * (sinceEat < 60 ? 1 - sinceEat / 60 : (sinceEat - 60) / 140);
    if (mouth > 0.02 && headStyle === "snake") {
      const neck0 = g.snake[1];
      const ang = neck0 ? Math.atan2(h.y - neck0.y, h.x - neck0.x) : 0;
      ctx.save();
      ctx.translate(ox + h.x * cell + cell / 2, oy + h.y * cell + cell / 2);
      ctx.rotate(ang);
      // slight chewing flutter so the jaws never freeze fully open
      const open = (0.2 + 0.5 * mouth) * (0.9 + 0.1 * Math.sin(t / 55));
      const hinge = cell * 0.02, R = cell * 0.62;
      // dark fleshy mouth interior
      ctx.fillStyle = mouthCols.current.mouth;
      ctx.beginPath(); ctx.moveTo(hinge, 0); ctx.arc(hinge, 0, R, -open, open); ctx.closePath(); ctx.fill();
      // tongue flicking toward the fruit
      ctx.strokeStyle = mouthCols.current.tongue;
      ctx.lineWidth = Math.max(2, cell * 0.09); ctx.lineCap = "round";
      const tl = R * (0.45 + 0.4 * mouth);
      ctx.beginPath(); ctx.moveTo(hinge, 0);
      ctx.quadraticCurveTo(hinge + tl * 0.6, cell * 0.08 * mouth, hinge + tl, 0);
      ctx.stroke();
      // teeth on the upper and lower jaw
      ctx.fillStyle = mouthCols.current.teeth;
      for (const s of [-1, 1]) {
        const ax = hinge + R * 0.6 * Math.cos(open), ay = s * R * 0.6 * Math.sin(open);
        ctx.beginPath();
        ctx.moveTo(ax + cell * 0.08, ay);
        ctx.lineTo(ax - cell * 0.07, ay - s * cell * 0.16);
        ctx.lineTo(ax - cell * 0.2, ay);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    const head = HEADS.find((item) => item.id === cfg.current.headStyle);
    if (head?.id !== "snake") {
      ctx.save();
      ctx.translate(ox + h.x * cell + cell / 2, oy + h.y * cell + cell * 0.54);
      const sc = 1 + 0.18 * mouth; // squash-and-stretch chomp for emoji heads
      ctx.scale(sc, 2 - sc);
      ctx.font = `${cell * 0.92}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Noto Emoji",sans-serif`;
      ctx.fillStyle = T.text;
      ctx.fillText(head?.icon || "🐍", 0, 0);
      ctx.restore();
    } else {
      const neck = g.snake[1];
      const angle = neck ? Math.atan2(h.y - neck.y, h.x - neck.x) : 0;
      ctx.save();
      ctx.translate(ox + h.x * cell + cell / 2, oy + h.y * cell + cell / 2);
      ctx.rotate(angle);
      // Big cartoon eyes (white + pupil looking forward), like the classic browser snake.
      for (const sign of [-1, 1]) {
        ctx.fillStyle = mouthCols.current.eye;
        ctx.beginPath(); ctx.arc(cell * 0.05, sign * cell * 0.24, cell * 0.17, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = mouthCols.current.pupil;
        ctx.beginPath(); ctx.arc(cell * 0.11, sign * cell * 0.24, cell * 0.085, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    if (cfg.current.ended && !g.won) {
      ctx.fillStyle = winColors.current.overlay; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = winColors.current.text; ctx.font = `800 ${vertical ? 80 : 72}px system-ui`;
      ctx.fillText("GAME ENDED", W / 2, H / 2);
    }
    if (g.won) {
      ctx.fillStyle = winColors.current.overlay; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = winColors.current.text; ctx.font = `900 ${vertical ? 120 : 110}px system-ui, "Noto Emoji"`;
      ctx.fillText("🏆 PERFECT!", W / 2, H / 2 - 40);
      ctx.font = "600 44px system-ui";
      ctx.fillText(`Board 100% filled • ${g.eaten} fruit • ${g.steps} steps`, W / 2, H / 2 + 60);
    }
  };

  const sel = "rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground";
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-end justify-center gap-4 border-b border-border p-4">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Board size
          <select className={sel} value={sizeI} onChange={(e) => setSizeI(+e.target.value)} disabled={running && !gameRef.current?.won}>
            {SIZES.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Video format
          <select className={sel} value={format} onChange={(e) => setFormat(e.target.value as never)} disabled={recording}>
            {Object.entries(FORMATS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Speed: {speed} steps/s
          <div className="flex h-9 items-center gap-3">
            <input aria-label="Speed slider" type="range" min={1} max={600} value={speed} onChange={(e) => { setSpeed(+e.target.value); setSpeedText(e.target.value); }} className="w-28 accent-primary" />
            <input aria-label="Enter speed" type="number" inputMode="numeric" min={1} max={600} step={1} value={speedText}
              onChange={(e) => { const value = e.target.value; setSpeedText(value); const n = Number(value); if (value && Number.isInteger(n) && n >= 1 && n <= 600) setSpeed(n); }}
              onBlur={() => { const n = Number(speedText); const valid = speedText && Number.isFinite(n) ? Math.min(600, Math.max(1, Math.round(n))) : speed; setSpeed(valid); setSpeedText(String(valid)); }}
              className={`${sel} w-20`} />
          </div>
        </label>
        {!SIZES[sizeI].w && (
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">Custom size (W × H)
            <div className="flex items-center gap-2">
              <input aria-label="Board width" type="number" min={4} max={60} value={customW} onChange={(e) => setCustomW(e.target.value)} className={`${sel} w-20`} disabled={running && !gameRef.current?.won} />
              ×
              <input aria-label="Board height" type="number" min={4} max={60} value={customH} onChange={(e) => setCustomH(e.target.value)} className={`${sel} w-20`} disabled={running && !gameRef.current?.won} />
            </div>
            {sizeError && <span role="alert" className="text-destructive">{sizeError}</span>}
          </div>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Mode
          <select className={sel} value={mode} onChange={(e) => setMode(e.target.value as Mode)} disabled={running && !gameRef.current?.won}>
            <option value="classic">Classic (1 fruit)</option>
            <option value="double">2x Classic (3 fruits)</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={music} onChange={(e) => { setMusic(e.target.checked); if (!e.target.checked) audioRef.current?.stopMusic(); else if (running && !paused) ensureAudio().startMusic(); }} className="accent-primary" />Music</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoRec} onChange={(e) => setAutoRec(e.target.checked)} className="accent-primary" />Auto-record</label>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={start} className="px-5 font-semibold">
            {gameRef.current ? <RotateCcw /> : <Play />}{gameRef.current ? "Restart" : "Start"}
          </Button>
          <Button onClick={togglePause} variant="outline" disabled={!running || gameRef.current?.won}>
            {paused ? <Play /> : <Pause />}{paused ? "Resume" : "Pause"}
          </Button>
          <Button onClick={endGame} variant="outline" disabled={!running || gameRef.current?.won}>
            <Square />End game
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap justify-center gap-4 border-b border-border px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Color</span>
          <Popover open={colorOpen} onOpenChange={setColorOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" aria-label="Choose color" className="w-40 justify-between">
                <span data-theme={theme} className="snake-swatch h-5 w-5 shrink-0 rounded-sm" />
                <span>{THEMES[theme]}</span><ChevronDown />
              </Button>
            </PopoverTrigger>
            <PopoverContent aria-label="Color options" className="grid w-64 grid-cols-2 gap-2 p-3">
              {Object.entries(THEMES).map(([key, label]) => (
                <Button key={key} variant={theme === key ? "secondary" : "ghost"} aria-label={`Color: ${label}`}
                  aria-pressed={theme === key} className="justify-start" onClick={() => { setTheme(key as keyof typeof THEMES); setColorOpen(false); }}>
                  <span data-theme={key} className="snake-swatch h-5 w-5 shrink-0 rounded-sm" />{label}
                </Button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Snake head</span>
          <Popover open={headOpen} onOpenChange={setHeadOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" aria-label="Choose snake head" className="w-40 justify-between">
                <span className="snake-emoji text-xl">{HEADS.find((h) => h.id === headStyle)?.icon}</span>
                <span>{HEADS.find((h) => h.id === headStyle)?.label}</span><ChevronDown />
              </Button>
            </PopoverTrigger>
            <PopoverContent aria-label="Snake head options" className="grid w-64 grid-cols-2 gap-2 p-3">
              {HEADS.map((h) => <Button key={h.id} variant={headStyle === h.id ? "secondary" : "ghost"}
                aria-label={`Head: ${h.label}`} aria-pressed={headStyle === h.id} className="justify-start"
                onClick={() => { setHeadStyle(h.id); setHeadOpen(false); }}>
                <span className="snake-emoji text-xl">{h.icon}</span>{h.label}
              </Button>)}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <section className="flex flex-1 items-center justify-center p-4">
        <canvas ref={canvasRef} className={`max-h-[70vh] max-w-full rounded-xl border border-border shadow-2xl ${format === "shorts" ? "aspect-[9/16]" : "aspect-video"}`} />
      </section>

      <footer className="sticky bottom-0 flex flex-wrap items-center justify-center gap-4 border-t border-border bg-card p-4">
        <span role="status" className="text-sm text-muted-foreground">{ended ? "Ended" : gameRef.current?.won ? "Complete" : paused ? "Paused" : running ? "Playing" : "Ready"} • {stats.eaten} fruit • {stats.len}/{stats.total}</span>
        {!recording ? (
          <Button onClick={startRec} variant="destructive" size="lg" className="font-bold">
            ● Start recording
          </Button>
        ) : (
          <Button onClick={stopRec} variant="destructive" size="lg" className="motion-safe:animate-pulse font-bold">
            ■ Stop recording
          </Button>
        )}
        {video && (
          <Button asChild size="lg" className="h-auto min-h-10 max-w-full whitespace-normal text-center font-bold"><a href={video.url} download={`snake-${video.format}-${video.mode}.${video.ext}`}>
            ⬇ Download video ({FORMATS[video.format].label})
          </a></Button>
        )}
      </footer>
    </main>
  );
}
