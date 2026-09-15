import { describe, expect, it } from "vitest";
import { minIncrement, nextMinBid } from "./bidding";

describe("minIncrement", () => {
  it("usa los tramos del enunciado con límites inclusivos", () => {
    expect(minIncrement(0)).toBe(50);
    expect(minIncrement(999)).toBe(50);
    expect(minIncrement(1_000)).toBe(50);
    expect(minIncrement(1_001)).toBe(100);
    expect(minIncrement(5_000)).toBe(100);
    expect(minIncrement(5_000.01)).toBe(150);
    expect(minIncrement(10_000)).toBe(150);
    expect(minIncrement(10_001)).toBe(200);
    expect(minIncrement(25_000)).toBe(200);
    expect(minIncrement(25_001)).toBe(250);
    expect(minIncrement(1_000_000)).toBe(250);
  });
});

describe("nextMinBid", () => {
  it("suma el incremento al precio actual", () => {
    expect(nextMinBid(19_250)).toBe(19_450);
    expect(nextMinBid(1_000)).toBe(1_050);
    expect(nextMinBid(25_000)).toBe(25_200);
    expect(nextMinBid(30_000)).toBe(30_250);
  });

  it("sin pujas arranca desde el primer tramo", () => {
    expect(nextMinBid(null)).toBe(50);
    expect(nextMinBid(undefined)).toBe(50);
  });
});
