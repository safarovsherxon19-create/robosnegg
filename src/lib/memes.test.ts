import { expect, it } from "vitest";
import { MEME_CLIPS, MemeBag, nextMemeTime, memeSlot, gameLayout, memeRect, type MemeClip } from "./memes";

const clips: MemeClip[] = Array.from({ length: 6 }, (_, i) => ({ id: String(i), name: String(i), caption: "", url: "" }));

it("varies memes without repeating until all six originals have played", () => {
  const bag = new MemeBag();
  const ids = Array.from({ length: 6 }, () => bag.next(clips, () => 0)?.id);
  expect(new Set(ids).size).toBe(6);
  expect(bag.next(clips, () => 0)?.id).not.toBe(ids[5]);
});
it("keeps meme variety across restarts with the same bag", () => {
  const bag = new MemeBag();
  const first = bag.next(clips, () => 0);
  expect(bag.next(clips, () => 0)?.id).not.toBe(first?.id);
});
it("waits one to two seconds after the preceding clip ends", () => {
  expect(nextMemeTime(4, () => 0)).toBe(5);
  expect(nextMemeTime(4, () => 0.5)).toBe(5.5);
  expect(nextMemeTime(4, () => 1)).toBe(6);
});
it("handles an empty or single clip library safely", () => {
  const bag = new MemeBag();
  expect(bag.next([])).toBeNull();
  expect(bag.next(clips.slice(0, 1))?.id).toBe("0");
  expect(bag.next(clips.slice(0, 1))?.id).toBe("0");
});
it("removes all generated default clips", () => { expect(MEME_CLIPS).toEqual([]); });
it("uses only three bottom positions for Shorts", () => {
  const board = gameLayout(1080, 1920, 10, 10, true);
  expect(board.oy).toBe(280);
  expect([0, .5, .999].map(r => memeSlot("shorts", -1, () => r))).toEqual([0, 1, 2]);
  for (const slot of [0, 1, 2]) {
    const rect = memeRect(1080, 1920, board, slot);
    expect(rect.y).toBeGreaterThan(board.oy + board.bh);
    expect(rect.y + rect.height).toBeLessThanOrEqual(1920);
  }
});
it("keeps all four Long meme slots outside the board", () => {
  for (const [columns, rows] of [[20, 20], [32, 18]]) {
    const board = gameLayout(1920, 1080, columns, rows, true);
    expect([0, .3, .6, .99].map(r => memeSlot("long", -1, () => r))).toEqual([0, 1, 2, 3]);
    for (const slot of [0, 1, 2, 3]) {
      const rect = memeRect(1920, 1080, board, slot);
      expect(slot % 2 === 0 ? rect.x + rect.width <= board.ox : rect.x >= board.ox + board.bw).toBe(true);
    }
  }
});
it("does not reuse the preceding position", () => {
  expect(memeSlot("shorts", 0, () => 0)).toBe(1);
  expect(memeSlot("long", 3, () => .999)).toBe(2);
});