// @ts-nocheck -- array index access is bounds-checked by game logic
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Game } from "@/lib/snake";
import { Button } from "@/components/ui/button";

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
  neon: "Neon", sunset: "Sunset", classic: "Classic", ocean: "Okean",
  candy: "Candy", fire: "Olov", lime: "Laym", ice: "Muz", gold: "Oltin", rainbow: "Rangli",
};
const HEADS = [
  { id: "snake", label: "Ilon", icon: "🐍" },
  { id: "robot", label: "Robot", icon: "🤖" },
  { id: "cat", label: "Mushuk", icon: "🐱" },
  { id: "dragon", label: "Ajdar", icon: "🐲" },
  { id: "alien", label: "O‘zga sayyoralik", icon: "👽" },
  { id: "tiger", label: "Yo‘lbars", icon: "🐯" },
  { id: "panda", label: "Panda", icon: "🐼" },
  { id: "fox", label: "Tulki", icon: "🦊" },
  { id: "skull", label: "Bosh suyagi", icon: "💀" },
];

function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [sizeI, setSizeI] = useState(2);
  const [format, setFormat] = useState<keyof typeof FORMATS>("long");
  const [theme, setTheme] = useState<keyof typeof THEMES>("neon");
  const [speed, setSpeed] = useState(30);
  const [speedText, setSpeedText] = useState("30");
  const [headStyle, setHeadStyle] = useState("snake");
  const paletteRef = useRef({});
  const winColors = useRef({ overlay: "", text: "" });
  const [autoRec, setAutoRec] = useState(true);
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [video, setVideo] = useState<{ url: string; ext: string } | null>(null);
  const [stats, setStats] = useState({ len: 3, total: 400, eaten: 0 });
  const cfg = useRef({ speed, theme, format, headStyle });
  cfg.current = { speed, theme, format, headStyle };
  const winAt = useRef(0);

  const startRec = () => {
    const c = canvasRef.current;
    if (!c) return;
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
    gameRef.current = new Game(s.w, s.h, gameRef.current?.variant);
    setStats({ len: 3, total: s.w * s.h, eaten: 0 });
    winAt.current = 0;
    setRunning(true);
    if (autoRec && !recording) setTimeout(startRec, 50);
  };

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const token = (name: string) => styles.getPropertyValue(name).trim();
    for (const key of Object.keys(THEMES)) {
      paletteRef.current[key] = {
        bg: token(`--snake-${key}-bg`), grid: token(`--snake-${key}-grid`),
        a: token(`--snake-${key}-a`).split(",").map(Number),
        b: token(`--snake-${key}-b`).split(",").map(Number), text: token(`--snake-${key}-text`),
      };
    }
    winColors.current = { overlay: token("--snake-win-overlay"), text: token("--snake-win-text") };
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
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
    const ctx = c.getContext("2d");
    const T = paletteRef.current[cfg.current.theme];
    if (!ctx || !T) return;
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
    const head = HEADS.find((item) => item.id === cfg.current.headStyle);
    if (head?.id !== "snake") {
      ctx.font = `${cell * 0.92}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.fillText(head?.icon || "🤖", ox + h.x * cell + cell / 2, oy + h.y * cell + cell * 0.54);
    } else {
      const neck = g.snake[1];
      const angle = neck ? Math.atan2(h.y - neck.y, h.x - neck.x) : 0;
      ctx.save();
      ctx.translate(ox + h.x * cell + cell / 2, oy + h.y * cell + cell / 2);
      ctx.rotate(angle);
      ctx.fillStyle = T.bg;
      for (const sign of [-1, 1]) {
        ctx.beginPath(); ctx.arc(cell * 0.16, sign * cell * 0.18, cell * 0.09, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    if (g.won) {
      ctx.fillStyle = winColors.current.overlay; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = winColors.current.text; ctx.font = `900 ${vertical ? 120 : 110}px system-ui`;
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
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Tezlik: {speed} qadam/s
          <div className="flex h-9 items-center gap-3">
            <input aria-label="Tezlik slayderi" type="range" min={1} max={600} value={speed} onChange={(e) => { setSpeed(+e.target.value); setSpeedText(e.target.value); }} className="w-28 accent-primary" />
            <input aria-label="Tezlikni kiriting" type="number" inputMode="numeric" min={1} max={600} step={1} value={speedText}
              onChange={(e) => { const value = e.target.value; setSpeedText(value); const n = Number(value); if (value && Number.isInteger(n) && n >= 1 && n <= 600) setSpeed(n); }}
              onBlur={() => { const n = Number(speedText); const valid = speedText && Number.isFinite(n) ? Math.min(600, Math.max(1, Math.round(n))) : speed; setSpeed(valid); setSpeedText(String(valid)); }}
              className={`${sel} w-20`} />
          </div>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoRec} onChange={(e) => setAutoRec(e.target.checked)} className="accent-primary" />Avto-yozish</label>
        <Button onClick={start} className="px-5 font-semibold">
          {running ? "Qayta boshlash" : "▶ Boshlash"}
        </Button>
      </header>

      <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 border-b border-border px-4 py-3">
        <fieldset className="min-w-0">
          <legend className="mb-2 text-xs text-muted-foreground">Rang: {THEMES[theme]}</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(THEMES).map(([key, label]) => (
              <Button key={key} variant="outline" size="icon" aria-label={`Rang: ${label}`} title={label} aria-pressed={theme === key}
                onClick={() => setTheme(key as keyof typeof THEMES)} className={theme === key ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}>
                <span data-theme={key} className="snake-swatch h-6 w-6 rounded-sm" />
              </Button>
            ))}
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="mb-2 text-xs text-muted-foreground">Ilon boshi: {HEADS.find((h) => h.id === headStyle)?.label}</legend>
          <div className="flex flex-wrap gap-2">
            {HEADS.map((h) => <Button key={h.id} variant={headStyle === h.id ? "secondary" : "outline"} size="icon"
              aria-label={`Bosh: ${h.label}`} title={h.label} aria-pressed={headStyle === h.id} onClick={() => setHeadStyle(h.id)}
              className={headStyle === h.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}>
              <span className="text-xl">{h.icon}</span>
            </Button>)}
          </div>
        </fieldset>
      </div>

      <section className="flex flex-1 items-center justify-center p-4">
        <canvas ref={canvasRef} className={`max-h-[70vh] max-w-full rounded-xl border border-border shadow-2xl ${format === "shorts" ? "aspect-[9/16]" : "aspect-video"}`} />
      </section>

      <footer className="sticky bottom-0 flex flex-wrap items-center justify-center gap-4 border-t border-border bg-card p-4">
        <span className="text-sm text-muted-foreground">{stats.eaten} meva • {stats.len}/{stats.total}</span>
        {!recording ? (
          <Button onClick={startRec} variant="destructive" size="lg" className="font-bold">
            ● Yozishni boshlash
          </Button>
        ) : (
          <Button onClick={stopRec} variant="destructive" size="lg" className="motion-safe:animate-pulse font-bold">
            ■ To'xtatish
          </Button>
        )}
        {video && (
          <Button asChild size="lg" className="h-auto min-h-10 max-w-full whitespace-normal text-center font-bold"><a href={video.url} download={`robo-snake-${format}.${video.ext}`}>
            ⬇ Videoni yuklab olish ({FORMATS[format].label})
          </a></Button>
        )}
      </footer>
    </main>
  );
}
