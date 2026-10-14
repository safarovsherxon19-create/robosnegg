import { expect, it } from "vitest";
import { MAX_CLIP_BYTES, validateMemeFile } from "./meme-library";

it("accepts videos up to the actual 5 GB hosting limit", () => {
  expect(MAX_CLIP_BYTES).toBe(5 * 1024 ** 3);
  expect(validateMemeFile({ type: "video/mp4", size: MAX_CLIP_BYTES })).toBe("");
  expect(validateMemeFile({ type: "video/mp4", size: MAX_CLIP_BYTES + 1 })).not.toBe("");
});
it("rejects non-video files", () => {
  expect(validateMemeFile({ type: "image/png", size: 100 })).not.toBe("");
});