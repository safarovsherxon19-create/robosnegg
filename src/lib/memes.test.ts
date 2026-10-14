import { expect, it } from "vitest";
import { MEME_CLIPS, MemeBag, nextMemeTime } from "./memes";

it("varies memes without repeating until all six originals have played", () => {
  const bag = new MemeBag();
  const ids = Array.from({ length: 6 }, () => bag.next(MEME_CLIPS, () => 0)?.id);
  expect(new Set(ids).size).toBe(6);
  expect(bag.next(MEME_CLIPS, () => 0)?.id).not.toBe(ids[5]);
});
it("keeps meme variety across restarts with the same bag", () => {
  const bag = new MemeBag();
  const first = bag.next(MEME_CLIPS, () => 0);
  expect(bag.next(MEME_CLIPS, () => 0)?.id).not.toBe(first?.id);
});
it("schedules different moments with ten to eighteen seconds between reactions", () => {
  expect(nextMemeTime(4, () => 0)).toBe(14);
  expect(nextMemeTime(4, () => 0.5)).toBe(18);
});
it("handles an empty or single clip library safely", () => {
  const bag = new MemeBag();
  expect(bag.next([])).toBeNull();
  expect(bag.next(MEME_CLIPS.slice(0, 1))?.id).toBe("wait");
  expect(bag.next(MEME_CLIPS.slice(0, 1))?.id).toBe("wait");
});