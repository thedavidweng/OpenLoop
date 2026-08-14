import { describe, expect, it } from "vitest";
import {
  CATALOG_ENGINES,
  CATALOG_PACKS,
  CATALOG_SLOTS,
  packsForEngine,
  slotIdForVariant,
  slotsForPack,
} from "@/app/lib/model-catalog";
import { DEFAULT_MODEL_REGISTRY } from "@/app/lib/model-catalog";

describe("model catalog", () => {
  it("registers ACE-Step as the only bound engine", () => {
    const ace = CATALOG_ENGINES.find((engine) => engine.id === "ace-step");
    const music3 = CATALOG_ENGINES.find((engine) => engine.id === "minimax-music3");
    expect(ace?.runtime).toBe("ace-step-http");
    expect(music3?.runtime).toBe("unbound");
  });

  it("keeps a stable turbo slot for a future Music 3 pack", () => {
    const turbo = CATALOG_SLOTS.find((slot) => slot.id === "minimax-music3/turbo");
    expect(turbo).toBeDefined();
    expect(turbo?.selectable).toBe(false);
    expect(turbo?.packId).toBe("minimax-music3/turbo");
  });

  it("maps ACE-Step variants onto catalog slots", () => {
    expect(slotIdForVariant("lite")).toBe("ace-step/lite");
    expect(slotIdForVariant("turbo")).toBe("ace-step/turbo");
    expect(slotIdForVariant("pro")).toBe("ace-step/pro");
  });

  it("groups packs by engine", () => {
    const acePacks = packsForEngine(DEFAULT_MODEL_REGISTRY, "ace-step");
    const music3Packs = packsForEngine(DEFAULT_MODEL_REGISTRY, "minimax-music3");
    expect(acePacks.map((pack) => pack.id)).toEqual(["ace-step/standard", "ace-step/xl"]);
    expect(music3Packs.every((pack) => pack.installPolicy === "announced")).toBe(true);
  });

  it("shares the Standard pack across Lite and Turbo slots", () => {
    const slots = slotsForPack(DEFAULT_MODEL_REGISTRY, "ace-step/standard");
    expect(slots.map((slot) => slot.aceVariant)).toEqual(["lite", "turbo"]);
  });

  it("has a pack for every slot", () => {
    const packIds = new Set(CATALOG_PACKS.map((pack) => pack.id));
    for (const slot of CATALOG_SLOTS) {
      expect(packIds.has(slot.packId)).toBe(true);
    }
  });
});
