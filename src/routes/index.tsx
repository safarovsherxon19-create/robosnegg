import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Game } from "@/lib/snake";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Robo Snake — AI ilon o'yini va video yozish" },
      { name: "description", content: "Robot o'ynaydigan, hech qachon yutqazmaydigan Snake. YouTube va Shorts uchun sifatli video yozib oling." },
      { property: "og:title", content: "Robo Snake — AI ilon o'yini" },
      { property: "og:description", content: "Robot butun maydonni to'ldirguncha o'ynaydi. Long va Shorts formatda yozib oling." },
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
];
const FORMATS = {
  long: { w: 1920, h: 1080, label: "YouTube Long 16:9" },
  shorts: { w: 1080, h: 1920, label: "YouTube Shorts 9:16" },
};
const THEMES = {
  neon: { bg: "#0b0f1a", grid: "#141a2b", a: [120, 255, 170], b: [40, 170, 255], text: "#e8fff3" },
  sunset: { bg: "#1a0d14", grid: "#25131d", a: [255, 200, 80], b: [255, 70, 120], text: "#fff2e0" },
  classic: { bg: "#9bbc0f", grid: "#8bac0f", a: [48, 98, 48], b: [15, 56, 15], text: "#0f380f" },
};

function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [sizeI, setSizeI] = useState(2);
  const [format, setFormat] = useState<keyof typeof FORMATS>("long");
  const [theme, setTheme] = useState<keyof typeof THEMES>("neon");
  const [speed, setSpeed] = useState(30);
  const [autoRec, setAutoRec] = useState(true);
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [video, setVideo] = useState<{ url: string; ext: string } | null>(null);
  const [stats, setStats] = useState({ len: 3, total: 400, eaten: 0 });
  const cfg = useRef({ speed, theme, format });
  cfg.current = { speed, theme, format };
  const winAt = useRef(0);

  const startRec = () => {
    const c = canvasRef.current!;
    const stream = c.captureStream(60);
    const types = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
    const r = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 16_000_000 });
    chunks.current = [];
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      const blob = new Blob(chunks.current, { type: mime || "video/webm" });
      setVideo({ url: URL.createObjectURL(blob), ext: mime.includes("mp4") ? "mp4" : "webm" });
      setRecording(false);
    };
    r.start(1000);
    recRef.current = r;
    setRecording(true);
    setVideo(null);
  };
  const stopRec = () => recRef.current?.state === "recording" && recRef.current.stop();

  const start = () => {
    const s = SIZES[sizeI];
    gameRef.current = new Game(s.w, s.h);
    winAt.current = 0;
    setRunning(true);
    if (autoRec && !recording) setTimeout(startRec, 50);
  };

  useEffect(() => {
    const c = canvasRef.current!;
    const F = FORMATS[format];
    c.width = F.w; c.height = F.h;
  }, [format]);

  useEffect(() => {
    let raf = 0, last = performance.now(), acc = 0;
    const loop = (t: number) => {
      const g = gameRef.current;
      const dt = Math.min(0.1, (t - last) / 1000); last = t;
      if (g && running && !g.won) {
        acc += dt * cfg.current.speed;
        let n = Math.floor(acc); acc -= n;
        while (n-- > 0 && !g.won) g.step();
        setStats({ len: g.snake.length, total: g.N, eaten: g.eaten });
      }
      if (g?.won) {
        if (!winAt.current) winAt.current = t;
        else if (t - winAt.current > 3000 && recRef.current?.state === "recording") stopRec();
      }
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const draw = (t: number) => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    const T = THEMES[cfg.current.theme];
    const W = c.width, H = c.height;
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    const g = gameRef.current;
    const vertical = H > W;
    const hud = vertical ? 260 : 120;
    ctx.fillStyle = T.text; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `800 ${vertical ? 72 : 56}px system-ui, sans-serif`;
    ctx.fillText("🤖 ROBO SNAKE", W / 2, hud * 0.4);
    if (!g) {
      ctx.font = "500 40px system-ui"; ctx.fillText("Boshlash tugmasini bosing", W / 2, H / 2); return;
    }
    const pct = ((g.snake.length / g.N) * 100).toFixed(1);
    ctx.font = `600 ${vertical ? 44 : 34}px system-ui, sans-serif`;
    ctx.globalAlpha = 0.8;
    ctx.fillText(`Uzunlik ${g.snake.length}/${g.N}  •  ${pct}%  •  Mevalar ${g.eaten}`, W / 2, hud * 0.8);
    ctx.globalAlpha = 1;
    const pad = 40;
    const cell = Math.floor(Math.min((W - pad * 2) / g.W, (H - hud - pad * 2) / g.H));
    const bw = cell * g.W, bh = cell * g.H;
    const ox = Math.floor((W - bw) / 2), oy = Math.floor(hud + (H - hud - bh) / 2);
    ctx.fillStyle = T.grid;
    for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) if ((x + y) % 2 === 0) ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
    ctx.strokeStyle = T.text; ctx.globalAlpha = 0.25; ctx.lineWidth = 3; ctx.strokeRect(ox - 2, oy - 2, bw + 4, bh + 4); ctx.globalAlpha = 1;
    if (g.food) {
      const s = cell * (0.85 + 0.08 * Math.sin(t / 150));
      ctx.font = `${s}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.fillText(g.fruit, ox + g.food.x * cell + cell / 2, oy + g.food.y * cell + cell / 2 + cell * 0.05);
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
    const h = g.snake[0];
    ctx.fillStyle = T.bg;
    ctx.beginPath(); ctx.arc(ox + h.x * cell + cell * 0.35, oy + h.y * cell + cell * 0.38, cell * 0.09, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(ox + h.x * cell + cell * 0.65, oy + h.y * cell + cell * 0.38, cell * 0.09, 0, 7); ctx.fill();
    if (g.won) {
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff"; ctx.font = `900 ${vertical ? 120 : 110}px system-ui`;
      ctx.fillText("🏆 PERFECT!", W / 2, H / 2 - 40);
      ctx.font = "600 44px system-ui";
      ctx.fillText(`Maydon 100% to'ldi • ${g.eaten} meva • ${g.steps} qadam`, W / 2, H / 2 + 60);
    }
  };

  const sel = "rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground";
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-end justify-center gap-4 border-b border-border p-4">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Maydon o'lchami
          <select className={sel} value={sizeI} onChange={(e) => setSizeI(+e.target.value)} disabled={running && !gameRef.current?.won}>
            {SIZES.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Video formati
          <select className={sel} value={format} onChange={(e) => setFormat(e.target.value as never)} disabled={recording}>
            {Object.entries(FORMATS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Mavzu
          <select className={sel} value={theme} onChange={(e) => setTheme(e.target.value as never)}>
            <option value="neon">Neon</option><option value="sunset">Sunset</option><option value="classic">Classic</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Tezlik: {speed} qadam/s
          <input type="range" min={5} max={600} value={speed} onChange={(e) => setSpeed(+e.target.value)} className="w-40 accent-primary" />
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoRec} onChange={(e) => setAutoRec(e.target.checked)} className="accent-primary" />Avto-yozish</label>
        <button onClick={start} className="rounded-lg bg-primary px-5 py-2 font-semibold text-primary-foreground">
          {running ? "Qayta boshlash" : "▶ Boshlash"}
        </button>
      </header>

      <section className="flex flex-1 items-center justify-center p-4">
        <canvas ref={canvasRef} className={`max-h-[70vh] max-w-full rounded-xl border border-border shadow-2xl ${format === "shorts" ? "aspect-[9/16]" : "aspect-video"}`} />
      </section>

      <footer className="sticky bottom-0 flex flex-wrap items-center justify-center gap-4 border-t border-border bg-card p-4">
        <span className="text-sm text-muted-foreground">{stats.eaten} meva • {stats.len}/{stats.total}</span>
        {!recording ? (
          <button onClick={startRec} className="flex items-center gap-2 rounded-full bg-destructive px-6 py-3 font-bold text-destructive-foreground">
            ● Yozishni boshlash
          </button>
        ) : (
          <button onClick={stopRec} className="flex animate-pulse items-center gap-2 rounded-full bg-destructive px-6 py-3 font-bold text-destructive-foreground">
            ■ To'xtatish
          </button>
        )}
        {video && (
          <a href={video.url} download={`robo-snake-${format}.${video.ext}`} className="rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">
            ⬇ Videoni yuklab olish ({FORMATS[format].label})
          </a>
        )}
      </footer>
    </main>
  );
}
