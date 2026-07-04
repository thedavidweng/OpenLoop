import { describe, expect, it } from "vitest";
import {
  AB_LOOP_MIN_GAP_SECONDS,
  isAbLoopBPlacementValid,
  resolveAbLoopSeekTarget,
} from "@/app/components/player/playback-ab-loop";

describe("isAbLoopBPlacementValid", () => {
  it("rejects B points within the minimum gap of A", () => {
    expect(isAbLoopBPlacementValid(10, 10)).toBe(false);
    expect(isAbLoopBPlacementValid(10, 10 + AB_LOOP_MIN_GAP_SECONDS - 0.001)).toBe(false);
  });

  it("accepts B points at or beyond the minimum gap from A", () => {
    expect(isAbLoopBPlacementValid(10, 10 + AB_LOOP_MIN_GAP_SECONDS)).toBe(true);
    expect(isAbLoopBPlacementValid(10, 20)).toBe(true);
  });
});

describe("resolveAbLoopSeekTarget", () => {
  it("seeks to loop start when playback passes loop end", () => {
    expect(resolveAbLoopSeekTarget(20, 80, 85)).toBe(20);
    expect(resolveAbLoopSeekTarget(80, 20, 85)).toBe(20);
  });

  it("does not seek before loop end", () => {
    expect(resolveAbLoopSeekTarget(20, 80, 50)).toBeNull();
  });

  it("does not seek when the loop region is narrower than the minimum gap", () => {
    const narrowB = 20 + AB_LOOP_MIN_GAP_SECONDS - 0.001;
    expect(resolveAbLoopSeekTarget(20, narrowB, 85)).toBeNull();
  });
});
