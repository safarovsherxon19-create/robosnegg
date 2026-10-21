// Cube Battle physics simulation (browser-safe, pure TS, no DOM).
export type Level = "saw" | "weapons" | "multiply" | "maze";
export const LEVELS: Record<Level, string> = {
  saw: "Sawblade Arena",
  weapons: "Weapon Arena",
  multiply: "1 Hit = +1 Cube",
  maze: "Maze Race",
};
export const CUBE_COLORS = [
  ["Red", "#ff3b3b"], ["Blue", "#2f7bff"], ["Green", "#22d36b"], ["Yellow", "#ffd400"],
  ["Purple", "#a855f7"], ["Orange", "#ff8a00"], ["Pink", "#ff4fb8"], ["Cyan", "#14e0ff"],
] as const;

export interface Cube { id: number; team: number; x: number; y: number; vx: number; vy: number; s: number; hp: number; alive: boolean; flash: number; rot: number; vr: number }
export interface Saw { x: number; y: number; r: number; a: number; ox: number; oy: number; ax: number; ay: number; f: number }
export interface Gun { x: number; y: number; a: number; cd: number; kind: "minigun" | "rpg" }
export interface Bullet { x: number; y: number; vx: number; vy: number; kind: "minigun" | "rpg"; life: number }
export interface Block { x: number; y: number; w: number; h: number; hp: number }
export interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }
export type Sfx = "hit" | "bounce" | "kill" | "shoot" | "boom" | "pop" | "win" | "break";

export class Arena {
  W = 1000; H = 1000;
  cubes: Cube[] = []; saws: Saw[] = []; guns: Gun[] = []; bullets: Bullet[] = []; blocks: Block[] = []; sparks: Spark[] = [];
  walls: Block[] = []; goal = { x: 0, y: 0, w: 0, h: 0 };
  t = 0; winner: number | null = null; over = false; nextId = 0; shake = 0;
  events: Sfx[] = [];
  private rnd: () => number;
  constructor(public level: Level, public teams = 6, seed = Math.random() * 1e9) {
    let s = seed >>> 0 || 1;
    this.rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    this.setup();
  }
  private add(team: number, x: number, y: number, s = 46) {
    const a = this.rnd() * Math.PI * 2, sp = 260 + this.rnd() * 180;
    this.cubes.push({ id: this.nextId++, team, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s, hp: 100, alive: true, flash: 0, rot: 0, vr: (this.rnd() - 0.5) * 4 });
  }
  private setup() {
    const r = this.rnd, cx = this.W / 2, cy = this.H / 2;
    if (this.level === "maze") {
      const cols = 6, rows = 7, cw = this.W / cols, ch = (this.H - 120) / rows;
      for (let j = 1; j < rows; j++) {
        const gap = Math.floor(r() * cols), gap2 = Math.floor(r() * cols);
        for (let i = 0; i < cols; i++) if (i !== gap && i !== gap2) this.walls.push({ x: i * cw + 6, y: 60 + j * ch, w: cw - 12, h: 14, hp: 1 });
      }
      this.goal = { x: cx - 80, y: this.H - 50, w: 160, h: 40 };
      for (let i = 0; i < this.teams; i++) this.add(i, 120 + i * (this.W - 240) / Math.max(1, this.teams - 1), 40, 36);
      return;
    }
    for (let i = 0; i < this.teams; i++) {
      const a = (i / this.teams) * Math.PI * 2;
      this.add(i, cx + Math.cos(a) * 320, cy + Math.sin(a) * 320, this.level === "multiply" ? 34 : 50);
    }
    if (this.level === "saw") {
      this.saws.push({ x: cx, y: cy, r: 70, a: 0, ox: cx, oy: cy, ax: 0, ay: 0, f: 0 });
      for (let i = 0; i < 2; i++) this.saws.push({ x: 0, y: 0, r: 44, a: 0, ox: cx, oy: cy, ax: 260 + r() * 120, ay: 260 + r() * 120, f: 0.4 + r() * 0.5 });
    } else if (this.level === "weapons") {
      this.guns.push({ x: cx, y: cy, a: 0, cd: 0.5, kind: "minigun" });
      this.guns.push({ x: 120, y: 120, a: 0, cd: 2, kind: "rpg" });
      this.guns.push({ x: this.W - 120, y: this.H - 120, a: 0, cd: 2.6, kind: "rpg" });
    } else {
      const n = 7, bw = (this.W - 160) / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++)
        this.blocks.push({ x: 80 + i * bw + 4, y: 380 + j * 80, w: bw - 8, h: 60, hp: 3 });
    }
  }
  alive() { return this.cubes.filter((c) => c.alive); }
  counts() {
    const n = new Array(this.teams).fill(0);
    for (const c of this.cubes) if (c.alive) n[c.team]++;
    return n as number[];
  }
  private burst(x: number, y: number, color: string, n = 18, sp = 420) {
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2, v = sp * (0.3 + this.rnd());
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + this.rnd() * 0.5, color, size: 4 + this.rnd() * 8 });
    }
  }
  private damage(c: Cube, d: number) {
    c.hp -= d; c.flash = 0.12;
    if (c.hp <= 0 && c.alive) {
      c.alive = false; this.shake = 14; this.events.push("kill");
      this.burst(c.x, c.y, CUBE_COLORS[c.team % 8][1], 34, 600);
    }
  }
  private explode(x: number, y: number) {
    this.events.push("boom"); this.shake = 22; this.burst(x, y, "#ffb020", 40, 700);
    for (const c of this.cubes) if (c.alive) {
      const dx = c.x - x, dy = c.y - y, d = Math.hypot(dx, dy);
      if (d < 200) { const k = (1 - d / 200); c.vx += dx / (d || 1) * 900 * k; c.vy += dy / (d || 1) * 900 * k; this.damage(c, 55 * k); }
    }
  }
  step(dt: number) {
    if (this.over) { this.t += dt; this.updateSparks(dt); return; }
    this.t += dt; this.shake *= 0.86;
    const L = this.level;
    for (const s of this.saws) {
      s.a += dt * 9;
      if (s.ax) { s.x = s.ox + Math.cos(this.t * s.f) * s.ax; s.y = s.oy + Math.sin(this.t * s.f * 1.3) * s.ay; }
    }
    for (const c of this.cubes) {
      if (!c.alive) continue;
      if (L === "maze") c.vy += 900 * dt;
      c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt; c.flash = Math.max(0, c.flash - dt);
      const h = c.s / 2;
      if (c.x < h) { c.x = h; c.vx = Math.abs(c.vx); this.events.push("bounce"); }
      if (c.x > this.W - h) { c.x = this.W - h; c.vx = -Math.abs(c.vx); this.events.push("bounce"); }
      if (c.y < h) { c.y = h; c.vy = Math.abs(c.vy); this.events.push("bounce"); }
      if (c.y > this.H - h) { c.y = this.H - h; c.vy = -Math.abs(c.vy) * (L === "maze" ? 0.8 : 1); this.events.push("bounce"); }
      if (L !== "maze") { // keep chaos alive
        const sp = Math.hypot(c.vx, c.vy), want = 340;
        if (sp < want) { c.vx *= 1 + dt; c.vy *= 1 + dt; if (sp < 30) { c.vx += (this.rnd() - 0.5) * 300; c.vy += (this.rnd() - 0.5) * 300; } }
        else if (sp > 900) { c.vx *= 0.98; c.vy *= 0.98; }
      }
      for (const s of this.saws) {
        const dx = c.x - s.x, dy = c.y - s.y, d = Math.hypot(dx, dy);
        if (d < s.r + h) {
          c.vx = dx / (d || 1) * 600; c.vy = dy / (d || 1) * 600;
          this.events.push("hit"); this.burst(c.x, c.y, "#ffe08a", 8, 300); this.damage(c, 34);
        }
      }
      for (const w of L === "maze" ? this.walls : this.blocks) this.collideBox(c, w);
      if (L === "maze" && c.y > this.goal.y - h && c.x > this.goal.x && c.x < this.goal.x + this.goal.w) {
        this.winner = c.team; this.finish();
      }
    }
    // cube vs cube
    const A = this.alive();
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      const a = A[i]!, b = A[j]!, dx = b.x - a.x, dy = b.y - a.y, m = (a.s + b.s) / 2;
      if (Math.abs(dx) < m && Math.abs(dy) < m) {
        const ox = m - Math.abs(dx), oy = m - Math.abs(dy);
        if (ox < oy) { const sx = Math.sign(dx) || 1; a.x -= sx * ox / 2; b.x += sx * ox / 2; [a.vx, b.vx] = [b.vx, a.vx]; }
        else { const sy = Math.sign(dy) || 1; a.y -= sy * oy / 2; b.y += sy * oy / 2; [a.vy, b.vy] = [b.vy, a.vy]; }
        if (a.team !== b.team && L !== "maze") {
          this.events.push("hit"); this.burst((a.x + b.x) / 2, (a.y + b.y) / 2, "#ffffff", 6, 250);
          this.damage(a, 6 + this.rnd() * 10); this.damage(b, 6 + this.rnd() * 10);
        }
      }
    }
    for (const g of this.guns) {
      const targets = this.alive(); if (!targets.length) break;
      const tg = targets[Math.floor(this.rnd() * targets.length)]!;
      g.a = g.kind === "minigun" ? g.a + dt * 2.4 : Math.atan2(tg.y - g.y, tg.x - g.x);
      g.cd -= dt;
      if (g.cd <= 0) {
        const sp = g.kind === "rpg" ? 520 : 1100;
        this.bullets.push({ x: g.x, y: g.y, vx: Math.cos(g.a) * sp, vy: Math.sin(g.a) * sp, kind: g.kind, life: 3 });
        g.cd = g.kind === "rpg" ? 1.8 + this.rnd() * 1.4 : 0.08; this.events.push("shoot");
      }
    }
    for (const b of this.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.x < 0 || b.y < 0 || b.x > this.W || b.y > this.H) { if (b.kind === "rpg") this.explode(b.x, b.y); b.life = 0; continue; }
      for (const c of this.cubes) if (c.alive && Math.abs(c.x - b.x) < c.s / 2 && Math.abs(c.y - b.y) < c.s / 2) {
        if (b.kind === "rpg") this.explode(b.x, b.y); else { c.vx += b.vx * 0.15; c.vy += b.vy * 0.15; this.damage(c, 4); this.events.push("hit"); }
        b.life = 0; break;
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    this.blocks = this.blocks.filter((b) => b.hp > 0);
    this.updateSparks(dt);
    if (L !== "maze") {
      const teamsLeft = this.counts().map((n, i) => [n, i]).filter(([n]) => n! > 0);
      if (L === "multiply" && !this.blocks.length) {
        const best = this.counts().reduce((bi, n, i, a) => (n > a[bi]! ? i : bi), 0);
        this.winner = best; this.finish();
      } else if (teamsLeft.length <= 1) { this.winner = teamsLeft[0]?.[1] ?? 0; this.finish(); }
    }
    if (this.t > 120 && !this.over) { const n = this.counts(); this.winner = n.indexOf(Math.max(...n)); this.finish(); }
  }
  private finish() { if (this.over) return; this.over = true; this.events.push("win"); }
  private collideBox(c: Cube, w: Block) {
    const h = c.s / 2, nx = Math.max(w.x, Math.min(c.x, w.x + w.w)), ny = Math.max(w.y, Math.min(c.y, w.y + w.h));
    const dx = c.x - nx, dy = c.y - ny;
    if (Math.abs(dx) >= h || Math.abs(dy) >= h) return;
    if (h - Math.abs(dx) < h - Math.abs(dy)) { c.x = nx + Math.sign(dx || c.x - (w.x + w.w / 2)) * h; c.vx = -c.vx; }
    else { c.y = ny + Math.sign(dy || c.y - (w.y + w.h / 2)) * h; c.vy = -c.vy * (this.level === "maze" ? 0.7 : 1); }
    if (this.level === "multiply") {
      w.hp--; this.events.push(w.hp <= 0 ? "break" : "pop");
      this.burst(nx, ny, CUBE_COLORS[c.team % 8][1], 10, 300);
      if (this.cubes.length < 400) this.add(c.team, c.x, c.y, 30);
    } else this.events.push("bounce");
  }
  private updateSparks(dt: number) {
    for (const p of this.sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; p.life -= dt; }
    this.sparks = this.sparks.filter((p) => p.life > 0);
  }
}
