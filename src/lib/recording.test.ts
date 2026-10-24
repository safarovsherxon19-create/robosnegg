import { describe, expect, it } from "vitest";
import { recordingSize } from "./recording";

describe("recording dimensions", () => {
  it("reduces vertical full-HD capture to 720p with the same aspect ratio", () => {
    expect(recordingSize(1080, 1920)).toEqual({ width: 720, height: 1280 });
  });
  it("preserves landscape framing and never upscales small canvases", () => {
    expect(recordingSize(1920, 1080)).toEqual({ width: 1280, height: 720 });
    expect(recordingSize(640, 360)).toEqual({ width: 640, height: 360 });
  });
});