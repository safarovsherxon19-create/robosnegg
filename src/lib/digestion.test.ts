import { describe, expect, it } from "vitest";
import { digestionPulse } from "./digestion";

describe("swallowed fruit", () => {
  it("starts at the head and travels continuously toward the tail", () => {
    expect(digestionPulse(0, 10)?.position).toBe(0);
    expect(digestionPulse(0.5, 10)?.position).toBe(1.25);
    expect(digestionPulse(1, 10)?.position).toBe(2.5);
  });
  it("shrinks away at the tail", () => {
    const early = digestionPulse(1, 10);
    const late = digestionPulse(3.6, 10);
    expect(late?.swelling).toBeLessThan(early?.swelling ?? 0);
    expect(digestionPulse(4, 10)).toBeNull();
  });
});