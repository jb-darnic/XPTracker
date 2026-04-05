// ============================================================================
// XPMeter Improved: Settings
// ============================================================================

import {
  DEFAULT_POLL_INTERVAL,
  DEFAULT_AFK_THRESHOLD,
  DEFAULT_RATE_WINDOW,
} from "../reader/constants";

const STORAGE_KEY = "xpmeter-improved-settings";

export interface XpMeterSettings {
  pollIntervalMs: number;
  rateWindowMs: number;
  afkThresholdMs: number;
  overlayEnabled: boolean;
  overlayPosition: "above" | "below" | "left" | "right";
  showActionsPerHour: boolean;
  alertOnAfk: boolean;
  persistSessions: boolean;
  debugMode: boolean;
  compactMode: boolean;
  showTotalOnly: boolean;
}

const DEFAULTS: XpMeterSettings = {
  pollIntervalMs: DEFAULT_POLL_INTERVAL,
  rateWindowMs: DEFAULT_RATE_WINDOW,
  afkThresholdMs: DEFAULT_AFK_THRESHOLD,
  overlayEnabled: true,
  overlayPosition: "below",
  showActionsPerHour: false,
  alertOnAfk: true,
  persistSessions: true,
  debugMode: false,
  compactMode: false,
  showTotalOnly: false,
};

/**
 * Manages user settings with localStorage persistence.
 * All values have typed defaults and auto-save on change.
 */
export class Settings {
  private data: XpMeterSettings;
  private changeCallbacks: ((settings: XpMeterSettings) => void)[] = [];

  constructor() {
    this.data = this.load();
  }

  get<K extends keyof XpMeterSettings>(key: K): XpMeterSettings[K] {
    return this.data[key];
  }

  set<K extends keyof XpMeterSettings>(key: K, value: XpMeterSettings[K]): void {
    this.data[key] = value;
    this.save();
    this.notifyChange();
  }

  getAll(): Readonly<XpMeterSettings> {
    return { ...this.data };
  }

  reset(): void {
    this.data = { ...DEFAULTS };
    this.save();
    this.notifyChange();
  }

  onChange(cb: (settings: XpMeterSettings) => void): () => void {
    this.changeCallbacks.push(cb);
    return () => {
      this.changeCallbacks = this.changeCallbacks.filter((c) => c !== cb);
    };
  }

  private load(): XpMeterSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULTS, ...parsed };
      }
    } catch (e) {
      console.warn("[Settings] Failed to load, using defaults:", e);
    }
    return { ...DEFAULTS };
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn("[Settings] Failed to save:", e);
    }
  }

  private notifyChange(): void {
    const snapshot = this.getAll();
    this.changeCallbacks.forEach((cb) => cb(snapshot));
  }
}
