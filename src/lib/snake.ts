// @ts-nocheck -- array index access is bounds-checked by game logic
export type P = { x: number; y: number };
export const FRUITS = ["🍎", "🍌", "🍇", "🍓", "🍒", "🍊", "🍉", "🍍", "🥝", "🍑", "🍐", "🥭", "🍋", "🫐"];

// Hamiltonian cycle (H must be even). Returns order index for each cell.
export function buildCycle(W: number, H: number, variant = 0, offset = 0): { order: number[]; path: P[] } {
  if (W < 2 || H < 2 || (W % 2 && H % 2)) throw new Error("Maydonning bir tomoni juft bo'lishi kerak");
  const transpose = H % 2 !== 0 || (W % 2 === 0 && Boolean(variant & 1));
  const width = transpose ? H : W, height = transpose ? W : H;
  let path: P[] = [];
  for (let x = 0; x < width; x++) path.push({ x, y: 0 });
  for (let y = 1; y < height; y++) {
    if (y % 2 === 1) for (let x = width - 1; x >= 1; x--) path.push({ x, y });
    else for (let x = 1; x < width; x++) path.push({ x, y });
  }
  for (let y = height - 1; y >= 1; y--) path.push({ x: 0, y });
  path = path.map((p) => {
    const x = transpose ? p.y : p.x, y = transpose ? p.x : p.y;
    return { x: variant & 2 ? W - 1 - x : x, y: variant & 4 ? H - 1 - y : y };
  });
  if (variant & 8) path.reverse();
  const shift = ((offset % path.length) + path.length) % path.length;
  path = [...path.slice(shift), ...path.slice(0, shift)];
  const order = new Array(W * H).fill(0);
  path.forEach((p, i) => (order[p.y * W + p.x] = i));
  return { order, path };
}

export type Mode = "classic" | "double";
export type Food = { p: P; fruit: string };

export type VideoFormat = "shorts" | "long";
export type Skill = "noob" | "pro" | "hacker";
const runHistory = new Map<string, { used: Set<string>; head?: string }>();

/** Do not reuse an actual cycle/start layout until the finite pool is exhausted. */
function freshCycle(W: number, H: number, previousVariant?: number) {
  const key = `${W}x${H}`;
  const history = runHistory.get(key) ?? { used: new Set<string>() };
  runHistory.set(key, history);
  const candidates = Array.from({ length: 16 * W * H }, (_, i) => i);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  for (let pass = 0; pass < 2; pass++) {
    for (const candidate of candidates) {
      const variant = Math.floor(candidate / (W * H)), offset = candidate % (W * H);
      if (variant === previousVariant) continue;
      const cycle = buildCycle(W, H, variant, offset);
      const signature = cycle.path.map((p) => p.y * W + p.x).join(",");
      const head = cycle.path[0];
      const headKey = `${head.x},${head.y}`;
      if (headKey === history.head || history.used.has(signature)) continue;
      history.used.add(signature); history.head = headKey;
      return { ...cycle, variant };
    }
    history.used.clear();
  }
  throw new Error("No valid cycle start available");
}

export class Game {
  W: number; H: number; N: number;
  order: number[]; path: P[];
  snake: P[] = []; // head first
  foods: Food[] = [];
  mode: Mode;
  /** Step numbers when fruit was eaten — drives the swallow bulge travelling down the body. */
  bulges: number[] = [];
  turned = false;
  eaten = 0; won = false; steps = 0;
  occ: Uint8Array;
  variant: number;
  initialLength: number;
  format: VideoFormat;
  get progress() {
    return this.format === "shorts" ? this.snake.length / this.N
      : (this.snake.length - this.initialLength) / (this.N - this.initialLength);
  }

  skill: Skill;
  lost = false;
  teleported = false;
  crashAt = 0.3 + Math.random() * 0.08;
  constructor(W: number, H: number, previousVariant?: number, mode: Mode = "classic", format: VideoFormat = "long", skill: Skill = "pro") {
    this.W = W; this.H = H; this.N = W * H; this.mode = mode;
    this.format = format; this.skill = skill;
    const c = freshCycle(W, H, previousVariant); this.variant = c.variant; this.order = c.order; this.path = c.path;
    this.occ = new Uint16Array(this.N);
    this.initialLength = format === "shorts" ? Math.floor(this.N / 2) : Math.min(3, this.N - 1);
    for (let i = 0; i < this.initialLength; i++) this.snake.push(this.path[(this.N - i) % this.N]);
    this.snake.forEach((p) => (this.occ[this.idx(p)] = 1));
    this.spawnWave();
  }
  idx(p: P) { return p.y * this.W + p.x; }
  dist(a: number, b: number) { return (b - a + this.N) % this.N; }
  foodAt(p: P) { return this.foods.findIndex((f) => f.p.x === p.x && f.p.y === p.y); }
  spawnWave() {
    const taken = new Set(this.foods.map((f) => this.idx(f.p)));
    const free: P[] = [];
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) { const i = y * this.W + x; if (!this.occ[i] && !taken.has(i)) free.push({ x, y }); }
    if (!free.length && !this.foods.length) { this.won = true; return; }
    const want = this.mode === "double" ? 3 : 1; // double: always keep 3 fruit on the board
    const count = Math.min(free.length, want - this.foods.length);
    for (let k = 0; k < count; k++) {
      const j = Math.floor(Math.random() * free.length);
      const [p] = free.splice(j, 1);
      this.foods.push({ p, fruit: FRUITS[Math.floor(Math.random() * FRUITS.length)] });
    }
  }
  /** Fruit closest ahead along the cycle (no shortcut can jump over it). */
  target(): Food | null {
    const ho = this.order[this.idx(this.snake[0])];
    let best: Food | null = null, bd = Infinity;
    for (const f of this.foods) { const d = this.dist(ho, this.order[this.idx(f.p)]); if (d < bd) { bd = d; best = f; } }
    return best;
  }
  inside(p: P) { return p.x >= 0 && p.y >= 0 && p.x < this.W && p.y < this.H; }
  /** Noob: wobbly greedy chasing, then crashes into a wall or itself after 30%. */
  noobNext(): P {
    const head = this.snake[0], tail = this.snake[this.snake.length - 1];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: head.x + dx, y: head.y + dy }));
    const safe = dirs.filter((n) => this.inside(n) && (!this.occ[this.idx(n)] || (n.x === tail.x && n.y === tail.y)));
    if (this.progress >= this.crashAt || !safe.length) {
      const deadly = dirs.filter((n) => !safe.includes(n));
      return deadly[Math.floor(Math.random() * deadly.length)] ?? dirs[0];
    }
    const food = this.target()?.p;
    if (!food || Math.random() < 0.3) return safe[Math.floor(Math.random() * safe.length)];
    return safe.reduce((a, b) => (Math.abs(b.x - food.x) + Math.abs(b.y - food.y) < Math.abs(a.x - food.x) + Math.abs(a.y - food.y) ? b : a));
  }
  /** Hacker: plays normally by shortest free path; opens portals only when stuck. */
  portals: { a: P; b: P; at: number }[] = [];
  teleports = 0;
  private pendingPortal: P | null = null;
  hackerNext(): P {
    const head = this.snake[0], neck = this.snake[1];
    this.pendingPortal = null;
    if (!this.foods.length) return head;
    const goal = new Set(this.foods.map((f) => this.idx(f.p)));
    const prev = new Int32Array(this.N).fill(-1);
    const start = this.idx(head); prev[start] = start;
    const queue = [start];
    let found = -1;
    for (let qi = 0; qi < queue.length && found < 0; qi++) {
      const c = queue[qi], cx = c % this.W, cy = (c / this.W) | 0;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => Math.random() - 0.5);
      for (const [dx, dy] of dirs) {
        const n = { x: cx + dx, y: cy + dy };
        if (!this.inside(n)) continue;
        const ni = this.idx(n);
        if (prev[ni] >= 0 || this.occ[ni]) continue;
        prev[ni] = c; queue.push(ni);
        if (goal.has(ni)) { found = ni; break; }
      }
    }
    if (found >= 0) {
      let c = found;
      while (prev[c] !== start) c = prev[c];
      return { x: c % this.W, y: (c / this.W) | 0 };
    }
    // Stuck: open a portal in front of the head and another beside a fruit.
    const food = this.foods[Math.floor(Math.random() * this.foods.length)].p;
    const exits = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: food.x + dx, y: food.y + dy }))
      .filter((n) => this.inside(n) && !this.occ[this.idx(n)] && this.foodAt(n) < 0);
    const exit = exits[Math.floor(Math.random() * exits.length)] ?? food;
    const dx = neck ? head.x - neck.x : 1, dy = neck ? head.y - neck.y : 0;
    const ahead = { x: head.x + dx, y: head.y + dy };
    this.pendingPortal = this.inside(ahead) ? ahead : head;
    return exit;
  }
  next(): P {
    if (this.skill === "noob") return this.noobNext();
    if (this.skill === "hacker") return this.hackerNext();
    const head = this.snake[0], tail = this.snake[this.snake.length - 1];
    const ho = this.order[this.idx(head)];
    const cycleNext = this.path[(ho + 1) % this.N];
    const len = this.snake.length;
    const food = this.target();
    if (!food || len > this.N * 0.55) return cycleNext;
    const to = this.order[this.idx(tail)];
    const fo = this.order[this.idx(food.p)];
    const distTail = this.dist(ho, to);
    const distFood = this.dist(ho, fo);
    const buffer = 4 + this.foods.length;
    let best = cycleNext, bestD = this.dist(this.order[this.idx(cycleNext)], fo);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) {
      const n = { x: head.x + dx, y: head.y + dy };
      if (n.x < 0 || n.y < 0 || n.x >= this.W || n.y >= this.H) continue;
      const ni = this.idx(n);
      if (this.occ[ni]) continue;
      const no = this.order[ni];
      const dn = this.dist(ho, no);
      if (dn === 0 || dn > distFood) continue;
      if (distTail !== 0 && dn >= distTail - buffer) continue;
      const df = this.dist(no, fo);
      if (df < bestD) { bestD = df; best = n; }
    }
    return best;
  }
  get over() { return this.won || this.lost; }
  step(): boolean { // returns true if ate
    if (this.won || this.lost) return false;
    const n = this.next();
    const h0 = this.snake[0], h1 = this.snake[1];
    if (this.skill === "noob") {
      const tail = this.snake[this.snake.length - 1];
      const hitsBody = this.inside(n) && this.occ[this.idx(n)] && !(n.x === tail.x && n.y === tail.y && this.foodAt(n) < 0);
      if (!this.inside(n) || hitsBody) { this.lost = true; this.steps++; return false; }
    }
    if (this.pendingPortal) { this.portals.push({ a: this.pendingPortal, b: n, at: this.steps + 1 }); this.teleports++; this.pendingPortal = null; this.teleported = true; } else this.teleported = false;
    this.turned = !!h1 && (n.x - h0.x !== h0.x - h1.x || n.y - h0.y !== h0.y - h1.y);
    this.steps++;
    const fi = this.foodAt(n);
    const ate = fi >= 0;
    if (!ate) { const t = this.snake.pop(); if (t) this.occ[this.idx(t)]--; }
    this.snake.unshift(n); this.occ[this.idx(n)]++;
    if (ate) {
      this.foods.splice(fi, 1); this.eaten++;
      this.bulges.push(this.steps);
      if (this.snake.length < this.N) this.spawnWave();
    }
    this.portals = this.portals.filter((p) => this.steps - p.at < 2);
    this.bulges = this.bulges.filter((b) => this.steps - b < this.snake.length);
    if (this.snake.length >= this.N) { this.won = true; this.foods = []; this.portals = []; }
    return ate;
  }
}
