import { expect, it } from "vitest";
import { ASMR_MIX } from "./audio";

it("makes existing bite and turn samples stronger than the previous mix", () => {
  expect(ASMR_MIX.bite).toBeGreaterThan(1);
  expect(ASMR_MIX.turn).toBeGreaterThan(0.55);
});

it("keeps music quieter than the previous mix so ASMR remains prominent", () => {
  expect(ASMR_MIX.music).toBeLessThan(0.22);
});