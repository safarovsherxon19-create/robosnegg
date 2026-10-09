import { describe, expect, it } from "vitest";
import { buildCycle, Game } from "./snake";

const sizes: [number, number][] = [[10, 10], [16, 16], [20, 20], [30, 30], [16, 28], [32, 18]];
const edgeSizes: [number, number][] = [[6, 5], [5, 6], [2, 8]];

describe("randomized safe robot", () => {
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

  it("double mode spawns 1, then 2, then 4 fruit", () => {
    const game = new Game(20, 20, undefined, "double");
    const waves: number[] = [game.foods.length];
    while (waves.length < 3) { const before = game.foods.length; game.step(); if (game.foods.length > before) waves.push(game.foods.length); }
    expect(waves).toEqual([1, 2, 4]);
  });

  it("classic mode always shows exactly one fruit", () => {
    const game = new Game(10, 10);
    while (!game.won) { expect(game.foods.length).toBe(1); game.step(); }
  });

  it("finishes every board without collisions across randomized restarts", () => {
    for (const [w, h] of [...sizes, [12, 7], [9, 14]] as [number, number][]) {
      let previous: number | undefined;
      for (let run = 0; run < 8; run++) {
        const game = new Game(w, h, previous, run % 2 ? "double" : "classic");
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
        expect(game.eaten).toBe(w * h - 3);
      }
    }
  }, 60000);
});