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

export class Game {
  W: number; H: number; N: number;
  order: number[]; path: P[];
  snake: P[] = []; // head first
  food: P | null = null; fruit = FRUITS[0];
  eaten = 0; won = false; steps = 0;
  occ: Uint8Array;
  variant: number;

  constructor(W: number, H: number, previousVariant?: number) {
    this.W = W; this.H = H; this.N = W * H;
    const choices = Array.from({ length: 16 }, (_, i) => i).filter((i) => i !== previousVariant);
    this.variant = choices[Math.floor(Math.random() * choices.length)];
    const c = buildCycle(W, H, this.variant, Math.floor(Math.random() * this.N)); this.order = c.order; this.path = c.path;
    this.occ = new Uint8Array(this.N);
    // start with length 3 along cycle
    for (let i = 2; i >= 0; i--) this.snake.push(this.path[i]);
    this.snake.forEach((p) => (this.occ[this.idx(p)] = 1));
    this.spawn();
  }
  idx(p: P) { return p.y * this.W + p.x; }
  dist(a: number, b: number) { return (b - a + this.N) % this.N; }
  spawn() {
    const free: P[] = [];
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) if (!this.occ[y * this.W + x]) free.push({ x, y });
    if (!free.length) { this.food = null; this.won = true; return; }
    this.food = free[Math.floor(Math.random() * free.length)];
    this.fruit = FRUITS[Math.floor(Math.random() * FRUITS.length)];
  }
  next(): P {
    const head = this.snake[0], tail = this.snake[this.snake.length - 1];
    const ho = this.order[this.idx(head)];
    const cycleNext = this.path[(ho + 1) % this.N];
    const len = this.snake.length;
    if (!this.food || len > this.N * 0.55) return cycleNext;
    const to = this.order[this.idx(tail)];
    const fo = this.order[this.idx(this.food)];
    const distTail = this.dist(ho, to);
    const distFood = this.dist(ho, fo);
    const buffer = 4;
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
  step(): boolean { // returns true if ate
    if (this.won) return false;
    const n = this.next();
    this.steps++;
    const ate = !!this.food && n.x === this.food.x && n.y === this.food.y;
    if (!ate) { const t = this.snake.pop(); if (t) this.occ[this.idx(t)] = 0; }
    this.snake.unshift(n); this.occ[this.idx(n)] = 1;
    if (ate) { this.eaten++; this.spawn(); }
    if (this.snake.length >= this.N) { this.won = true; this.food = null; }
    return ate;
  }
}
