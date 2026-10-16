import { describe, expect, it } from "vitest";
import { buildCycle, Game } from "./snake";

const sizes: [number, number][] = [[10, 10], [16, 16], [20, 20], [30, 30], [16, 28], [32, 18]];
const edgeSizes: [number, number][] = [[6, 5], [5, 6], [2, 8]];

describe("randomized safe robot", () => {
  it("starts only Shorts at exactly 50% for both modes", () => {
    for (const mode of ["classic", "double"] as const) {
      expect(new Game(10, 10, undefined, mode, "shorts").snake.length).toBe(50);
      expect(new Game(32, 18, undefined, mode, "shorts").progress).toBe(0.5);
    }
  });
  it("starts Long at 0% progress with a small snake in both modes", () => {
    for (const mode of ["classic", "double"] as const) {
      const game = new Game(32, 18, undefined, mode, "long");
      expect(game.snake.length).toBe(3);
      expect(game.progress).toBe(0);
    }
  });
  it("varies half-filled starting positions and does not reuse actual cycle layouts", () => {
    let previous: Game | undefined;
    const seen = new Set<string>();
    for (let run = 0; run < 32; run++) {
      const game = new Game(10, 10, previous?.variant, "classic", "shorts");
      const signature = JSON.stringify(game.path);
      expect(seen.has(signature)).toBe(false);
      if (previous) expect(game.snake[0]).not.toEqual(previous.snake[0]);
      seen.add(signature); previous = game;
    }
  });
  it("keeps every transformed cycle adjacent, closed and complete", () => {
    for (const [w, h] of [...sizes, ...edgeSizes]) {
      for (let variant = 0; variant < 16; variant++) {
        const { path, order } = buildCycle(w, h, variant, 17);
        expect(new Set(path.map((p) => `${p.x},${p.y}`)).size).toBe(w * h);
        path.forEach((p, i) => {
          const q = path[(i + 1) % path.length];
          if (!q) throw new Error("Missing next cell");
          expect(Math.abs(p.x - q.x) + Math.abs(p.y - q.y)).toBe(1);
          expect(order[p.y * w + p.x]).toBe(i);
        });
      }
    }
  });

  it("double mode starts with 3 fruit and replaces each eaten fruit at once", () => {
    const game = new Game(20, 20, undefined, "double");
    expect(game.foods.length).toBe(3);
    let eats = 0;
    while (eats < 20) { if (game.step()) eats++; expect(game.foods.length).toBe(3); }
  });

  it("classic mode always shows exactly one fruit", () => {
    const game = new Game(10, 10);
    while (!game.won) { expect(game.foods.length).toBe(1); game.step(); }
  });

  it("finishes every board without collisions across randomized restarts", () => {
    for (const [w, h] of [...sizes, [12, 7], [9, 14]] as [number, number][]) {
      let previous: number | undefined;
      for (let run = 0; run < 8; run++) {
        const game = new Game(w, h, previous, run % 2 ? "double" : "classic", run % 2 ? "shorts" : "long");
        expect(game.variant).not.toBe(previous);
        previous = game.variant;
        const limit = game.N * game.N;
        while (!game.won && game.steps < limit) {
          const next = game.next();
          const tail = game.snake.at(-1);
          const eating = game.foodAt(next) >= 0;
          if (game.occ[game.idx(next)] && (eating || tail?.x !== next.x || tail?.y !== next.y)) throw new Error("Collision");
          const before = game.snake.length;
          expect(game.step() ? game.snake.length === before + 1 : game.snake.length === before).toBe(true);
        }
        expect(game.won).toBe(true);
        expect(game.snake.length).toBe(w * h);
        expect(game.eaten).toBe(w * h - game.initialLength);
        expect(game.progress).toBe(1);
      }
    }
  }, 60000);
});
describe("skills", () => {
  it("noob crashes after reaching 30% and never wins", () => {
    for (let r = 0; r < 20; r++) {
      const g = new Game(10, 10, undefined, "classic", "long", "noob");
      while (!g.over && g.steps < 100000) g.step();
      expect(g.lost).toBe(true);
      expect(g.won).toBe(false);
    }
  });
  it("hacker always fills the board without dying", () => {
    for (let r = 0; r < 10; r++) {
      const g = new Game(10, 10, undefined, r % 2 ? "double" : "classic", "long", "hacker");
      while (!g.over && g.steps < 100000) g.step();
      expect(g.won).toBe(true);
      expect(g.lost).toBe(false);
    }
  });
});
