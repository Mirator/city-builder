import { describe, expect, it } from "vitest";
import {
  loadOnboardingDismissed,
  resolveOnboardingVisibility,
  saveOnboardingDismissed,
} from "./onboarding";

class MemoryStorage {
  private readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("onboarding helpers", () => {
  it("persists dismissed status", () => {
    const storage = new MemoryStorage();
    expect(loadOnboardingDismissed(storage)).toBe(false);
    expect(saveOnboardingDismissed(storage)).toBe(true);
    expect(loadOnboardingDismissed(storage)).toBe(true);
  });

  it("resolves panel and chip visibility by turn and expansion state", () => {
    expect(resolveOnboardingVisibility(1, false, false)).toEqual({
      showPanel: true,
      showChip: false,
    });
    expect(resolveOnboardingVisibility(4, false, false)).toEqual({
      showPanel: false,
      showChip: true,
    });
    expect(resolveOnboardingVisibility(4, false, true)).toEqual({
      showPanel: true,
      showChip: false,
    });
    expect(resolveOnboardingVisibility(2, true, false)).toEqual({
      showPanel: false,
      showChip: false,
    });
  });
});
