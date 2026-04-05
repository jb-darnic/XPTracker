// ============================================================================
// XPMeter Improved: Session Tracker
// ============================================================================
// Manages XP sessions with:
// - Sliding window rate calculation (configurable window)
// - AFK detection with automatic timer pausing
// - XP drop counting (diff between consecutive readings)
// - Session persistence to localStorage
// - Full session history with summaries

import { EventBus } from "../events/EventBus";
import { Settings } from "../settings/Settings";
import {
  CounterSnapshot,
  SkillReading,
  SkillRate,
  Session,
  SessionSummary,
  XpMeterEvents,
  SkillId,
} from "../reader/types";

const SESSION_HISTORY_KEY = "xpmeter-session-history";
const MAX_HISTORY = 20;

interface XpDataPoint {
  xp: number;
  timestamp: number;
}

/**
 * Tracks XP rates using a sliding window approach.
 * Automatically pauses tracking during AFK periods.
 */
export class SessionTracker {
  private bus: EventBus<XpMeterEvents>;
  private settings: Settings;

  private session: Session | null = null;
  private xpHistory: Map<SkillId, XpDataPoint[]> = new Map();
  private lastSnapshot: CounterSnapshot | null = null;
  private afkStart: number | null = null;
  private isAfk = false;

  constructor(bus: EventBus<XpMeterEvents>, settings: Settings) {
    this.bus = bus;
    this.settings = settings;

    // Listen for counter updates
    this.bus.on("counter:updated", (snapshot) => this.onSnapshot(snapshot));
    this.bus.on("counter:lost", () => this.onCounterLost());
  }

  /**
   * Start a new session.
   */
  startSession(): void {
    this.session = {
      id: `session-${Date.now()}`,
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      rates: {},
      isActive: true,
      isPaused: false,
      totalAfkMs: 0,
      snapshotCount: 0,
    };
    this.xpHistory.clear();
    this.lastSnapshot = null;
    this.afkStart = null;
    this.isAfk = false;

    this.bus.emit("session:started", this.session);
    this.bus.emit("status:changed", "Session started");
  }

  /**
   * End the current session and return a summary.
   */
  endSession(): SessionSummary | null {
    if (!this.session) return null;

    const summary = this.buildSummary();
    this.bus.emit("session:ended", summary);

    if (this.settings.get("persistSessions")) {
      this.saveToHistory(summary);
    }

    this.session = null;
    this.xpHistory.clear();
    this.lastSnapshot = null;

    return summary;
  }

  /**
   * Pause/resume the current session.
   */
  togglePause(): void {
    if (!this.session) return;

    this.session.isPaused = !this.session.isPaused;
    if (this.session.isPaused) {
      this.bus.emit("session:paused", undefined);
    } else {
      this.bus.emit("session:resumed", undefined);
    }
  }

  getSession(): Session | null {
    return this.session;
  }

  isSessionActive(): boolean {
    return this.session !== null && this.session.isActive && !this.session.isPaused;
  }

  /**
   * Process a new counter snapshot.
   */
  private onSnapshot(snapshot: CounterSnapshot): void {
    if (!this.session || this.session.isPaused) return;

    this.session.snapshotCount++;
    this.session.lastUpdateTime = snapshot.timestamp;

    // Check for AFK
    const afkThreshold = this.settings.get("afkThresholdMs");
    const hasXpChange = this.detectXpChange(snapshot);

    if (!hasXpChange && this.lastSnapshot) {
      if (!this.isAfk) {
        const timeSinceLast = snapshot.timestamp - this.lastSnapshot.timestamp;
        if (timeSinceLast >= afkThreshold) {
          this.isAfk = true;
          this.afkStart = this.lastSnapshot.timestamp;
          this.bus.emit("afk:detected", { durationMs: timeSinceLast });
        }
      }
    } else if (hasXpChange && this.isAfk) {
      // Resume from AFK
      if (this.afkStart) {
        this.session.totalAfkMs += snapshot.timestamp - this.afkStart;
      }
      this.isAfk = false;
      this.afkStart = null;
      this.bus.emit("afk:resumed", undefined);
    }

    // Record data points for each skill
    for (const reading of snapshot.readings) {
      if (reading.xp <= 0) continue;

      if (!this.xpHistory.has(reading.skill)) {
        this.xpHistory.set(reading.skill, []);
      }

      const history = this.xpHistory.get(reading.skill)!;
      history.push({ xp: reading.xp, timestamp: reading.timestamp });

      // Trim history to sliding window
      const windowMs = this.settings.get("rateWindowMs");
      const cutoff = snapshot.timestamp - windowMs;
      while (history.length > 2 && history[0].timestamp < cutoff) {
        history.shift();
      }
    }

    // Calculate rates
    const rates = this.calculateRates(snapshot.timestamp);
    this.session.rates = {};
    for (const rate of rates) {
      this.session.rates[rate.skill] = rate;
    }

    this.lastSnapshot = snapshot;
    this.bus.emit("rate:updated", rates);
  }

  /**
   * Check if any XP values changed since the last snapshot.
   */
  private detectXpChange(snapshot: CounterSnapshot): boolean {
    if (!this.lastSnapshot) return true;

    for (const reading of snapshot.readings) {
      const prev = this.lastSnapshot.readings.find((r) => r.skill === reading.skill);
      if (prev && reading.xp > 0 && prev.xp > 0 && reading.xp !== prev.xp) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate XP rates using the sliding window.
   */
  private calculateRates(now: number): SkillRate[] {
    const rates: SkillRate[] = [];

    for (const [skill, history] of this.xpHistory) {
      if (history.length < 2) continue;

      const first = history[0];
      const last = history[history.length - 1];
      const elapsedMs = last.timestamp - first.timestamp;

      if (elapsedMs <= 0) continue;

      const xpGained = last.xp - first.xp;
      const xpPerHour = (xpGained / elapsedMs) * 3_600_000;

      // Count XP drops (consecutive reading changes)
      let actionsDetected = 0;
      let lastDropSize = 0;
      for (let i = 1; i < history.length; i++) {
        const diff = history[i].xp - history[i - 1].xp;
        if (diff > 0) {
          actionsDetected++;
          lastDropSize = diff;
        }
      }

      rates.push({
        skill,
        currentXp: last.xp,
        startXp: first.xp,
        xpGained,
        xpPerHour: Math.round(xpPerHour),
        actionsDetected,
        elapsedMs,
        lastDropSize,
        isActive: xpGained > 0,
      });
    }

    // Sort: active skills first, then by XP/hr descending
    rates.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return b.xpPerHour - a.xpPerHour;
    });

    return rates;
  }

  /**
   * Handle counter lost event.
   */
  private onCounterLost(): void {
    // Don't end session, just pause tracking
    if (this.session) {
      this.session.isPaused = true;
    }
  }

  /**
   * Build a session summary for persistence.
   */
  private buildSummary(): SessionSummary {
    const session = this.session!;
    const elapsed = session.lastUpdateTime - session.startTime;
    const activeMs = elapsed - session.totalAfkMs;

    const hours = Math.floor(activeMs / 3_600_000);
    const minutes = Math.floor((activeMs % 3_600_000) / 60_000);

    return {
      id: session.id,
      startTime: session.startTime,
      endTime: session.lastUpdateTime,
      duration: `${hours}h ${minutes}m`,
      skills: Object.values(session.rates)
        .filter((r) => r.xpGained > 0)
        .map((r) => ({
          skill: r.skill,
          xpGained: r.xpGained,
          xpPerHour: r.xpPerHour,
        })),
    };
  }

  /**
   * Save session summary to localStorage history.
   */
  private saveToHistory(summary: SessionSummary): void {
    try {
      const raw = localStorage.getItem(SESSION_HISTORY_KEY);
      let history: SessionSummary[] = raw ? JSON.parse(raw) : [];
      history.unshift(summary);
      if (history.length > MAX_HISTORY) {
        history = history.slice(0, MAX_HISTORY);
      }
      localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn("[SessionTracker] Failed to save history:", e);
    }
  }

  /**
   * Load session history from localStorage.
   */
  static loadHistory(): SessionSummary[] {
    try {
      const raw = localStorage.getItem(SESSION_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Format a number with commas.
   */
  static formatXp(xp: number): string {
    if (xp >= 1_000_000) return (xp / 1_000_000).toFixed(1) + "M";
    if (xp >= 10_000) return (xp / 1_000).toFixed(1) + "K";
    return xp.toLocaleString();
  }

  /**
   * Format XP/hr for display.
   */
  static formatRate(rate: number): string {
    if (rate >= 1_000_000) return (rate / 1_000_000).toFixed(2) + "M/hr";
    if (rate >= 1_000) return (rate / 1_000).toFixed(1) + "K/hr";
    return rate.toLocaleString() + "/hr";
  }
}
