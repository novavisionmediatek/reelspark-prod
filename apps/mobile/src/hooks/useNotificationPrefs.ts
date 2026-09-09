import { useCallback, useSyncExternalStore } from 'react';

export interface NotificationPrefs {
  videoStatus: boolean;
  referralRewards: boolean;
  productUpdates: boolean;
}

const STORAGE_KEY = 'reelspark:notificationPrefs';

const DEFAULTS: NotificationPrefs = {
  videoStatus: true,
  referralRewards: true,
  productUpdates: false,
};

const listeners = new Set<() => void>();

function read(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<NotificationPrefs>) };
  } catch {
    return DEFAULTS;
  }
}

// Cached snapshot so useSyncExternalStore gets a stable reference between renders;
// only reassigned when a preference actually changes.
let snapshot: NotificationPrefs = read();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function useNotificationPrefs() {
  const prefs = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);

  const setPref = useCallback((key: keyof NotificationPrefs, value: boolean) => {
    snapshot = { ...snapshot, [key]: value };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      /* storage unavailable — keep the in-memory value for this session */
    }
    listeners.forEach((l) => l());
  }, []);

  return { prefs, setPref };
}
