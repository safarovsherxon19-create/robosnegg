import { expect, it } from "vitest";
import { bannerStage } from "./video-banner";

it("changes stages at 50%, 65%, 80%, 95% and completion", () => {
  expect(bannerStage(50, 100)).not.toBe(bannerStage(65, 100));
  expect(bannerStage(79, 100)).not.toBe(bannerStage(80, 100));
  expect(bannerStage(94, 100)).not.toBe(bannerStage(95, 100));
  expect(bannerStage(99, 100)).not.toBe(bannerStage(100, 100));
});