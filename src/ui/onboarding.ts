export const ONBOARDING_DISMISSED_KEY = "ccb.onboarding.dismissed.v1";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface OnboardingVisibility {
  showPanel: boolean;
  showChip: boolean;
}

export function loadOnboardingDismissed(storage = getDefaultStorage()): boolean {
  if (!storage) {
    return false;
  }
  return storage.getItem(ONBOARDING_DISMISSED_KEY) === "1";
}

export function saveOnboardingDismissed(storage = getDefaultStorage()): boolean {
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(ONBOARDING_DISMISSED_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

export function resolveOnboardingVisibility(
  turn: number,
  dismissed: boolean,
  expanded: boolean,
): OnboardingVisibility {
  if (dismissed) {
    return { showPanel: false, showChip: false };
  }

  if (turn <= 3) {
    return { showPanel: true, showChip: false };
  }

  return expanded ? { showPanel: true, showChip: false } : { showPanel: false, showChip: true };
}

function getDefaultStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}
