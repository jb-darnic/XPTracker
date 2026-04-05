// ============================================================================
// XPMeter Improved: Notification Manager
// ============================================================================
// Detects and alerts on:
// - Level ups (XP crossing level boundaries between readings)
// - AFK threshold reached
// - XP milestones (every N XP gained, configurable)
// - Goal completion
//
// Uses Web Audio API for sound and Alt1 overlay for visual alerts.

import * as a1lib from "alt1/base";
import { EventBus } from "../events/EventBus";
import { Settings } from "../settings/Settings";
import { SkillRate, XpMeterEvents, SkillId } from "../reader/types";
import { xpToLevel, XP_TABLE } from "../data/xp-table";
import { SKILL_DISPLAY_NAMES } from "../reader/constants";
import { SessionTracker } from "../tracker/SessionTracker";

const OVERLAY_GROUP_NOTIF = "xpmeter-notifications";
const MILESTONE_INTERVAL = 1_000_000; // Alert every 1M XP gained

interface SkillState {
  lastKnownLevel: number;
  lastMilestone: number; // last milestone XP threshold crossed
}

export class NotificationManager {
  private bus: EventBus<XpMeterEvents>;
  private settings: Settings;
  private skillStates: Map<SkillId, SkillState> = new Map();
  private audioCtx: AudioContext | null = null;
  private notifLog: { time: number; message: string; type: string }[] = [];
  private enabled = true;

  constructor(bus: EventBus<XpMeterEvents>, settings: Settings) {
    this.bus = bus;
    this.settings = settings;

    this.bus.on("rate:updated", (rates) => this.checkForEvents(rates));
    this.bus.on("afk:detected", () => this.onAfkDetected());
    this.bus.on("session:started", () => this.reset());
  }

  /**
   * Check for level-ups and milestones.
   */
  private checkForEvents(rates: SkillRate[]): void {
    if (!this.enabled) return;

    for (const rate of rates) {
      if (rate.currentXp <= 0) continue;

      const currentLevel = xpToLevel(rate.currentXp);
      let state = this.skillStates.get(rate.skill);

      if (!state) {
        // First reading for this skill, initialize without alerting
        state = {
          lastKnownLevel: currentLevel,
          lastMilestone: Math.floor(rate.startXp / MILESTONE_INTERVAL) * MILESTONE_INTERVAL,
        };
        this.skillStates.set(rate.skill, state);
        continue;
      }

      // Level-up detection
      if (currentLevel > state.lastKnownLevel) {
        const levelsGained = currentLevel - state.lastKnownLevel;
        for (let l = state.lastKnownLevel + 1; l <= currentLevel; l++) {
          this.triggerLevelUp(rate.skill, l);
        }
        state.lastKnownLevel = currentLevel;
      }

      // XP milestone detection (every 1M)
      const currentMilestone = Math.floor(rate.currentXp / MILESTONE_INTERVAL) * MILESTONE_INTERVAL;
      if (currentMilestone > state.lastMilestone && state.lastMilestone > 0) {
        this.triggerMilestone(rate.skill, currentMilestone);
        state.lastMilestone = currentMilestone;
      } else if (state.lastMilestone === 0) {
        state.lastMilestone = currentMilestone;
      }
    }
  }

  /**
   * Trigger a level-up notification.
   */
  private triggerLevelUp(skill: SkillId, level: number): void {
    const name = SKILL_DISPLAY_NAMES[skill] || skill;
    const message = `${name} level ${level}!`;

    this.log(message, "levelup");
    this.showOverlayAlert(message, [255, 215, 0]); // Gold
    this.playSound("levelup");

    // Show in-app notification
    this.showAppNotification(message, "levelup");
  }

  /**
   * Trigger an XP milestone notification.
   */
  private triggerMilestone(skill: SkillId, xp: number): void {
    const name = SKILL_DISPLAY_NAMES[skill] || skill;
    const xpStr = SessionTracker.formatXp(xp);
    const message = `${name}: ${xpStr} reached!`;

    this.log(message, "milestone");
    this.showOverlayAlert(message, [60, 200, 64]); // Green
    this.playSound("milestone");
    this.showAppNotification(message, "milestone");
  }

  /**
   * Handle AFK detection.
   */
  private onAfkDetected(): void {
    if (!this.settings.get("alertOnAfk")) return;

    const message = "AFK detected, timer paused";
    this.log(message, "afk");
    this.showOverlayAlert(message, [232, 168, 40]); // Amber
    this.playSound("afk");
  }

  /**
   * Show an overlay alert on the game screen.
   */
  private showOverlayAlert(text: string, rgb: [number, number, number]): void {
    if (!window.alt1) return;

    try {
      alt1.overLaySetGroup(OVERLAY_GROUP_NOTIF);
      const color = a1lib.mixColor(rgb[0], rgb[1], rgb[2]);
      const x = Math.round(alt1.rsWidth / 2);
      const y = 60;
      alt1.overLayTextEx(text, color, 16, x, y, 4000, "", true, true);
    } catch {
      // Overlay unavailable
    }
  }

  /**
   * Show a notification inside the app UI.
   */
  private showAppNotification(message: string, type: string): void {
    const container = document.getElementById("notifContainer");
    if (!container) return;

    const notif = document.createElement("div");
    notif.className = `app-notif notif-${type}`;
    notif.textContent = message;
    container.prepend(notif);

    // Auto-remove after animation
    setTimeout(() => {
      notif.style.opacity = "0";
      notif.style.transform = "translateY(-8px)";
      setTimeout(() => notif.remove(), 300);
    }, 4000);

    // Keep max 5 notifications visible
    while (container.children.length > 5) {
      container.lastChild?.remove();
    }
  }

  /**
   * Play a notification sound using Web Audio API.
   */
  private playSound(type: "levelup" | "milestone" | "afk"): void {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      if (type === "levelup") {
        // Triumphant ascending chord
        this.playTone(ctx, 523.25, now, 0.15, 0.3);       // C5
        this.playTone(ctx, 659.25, now + 0.1, 0.15, 0.3);  // E5
        this.playTone(ctx, 783.99, now + 0.2, 0.2, 0.35);   // G5
        this.playTone(ctx, 1046.50, now + 0.3, 0.3, 0.25);  // C6
      } else if (type === "milestone") {
        // Short bright ding
        this.playTone(ctx, 880, now, 0.1, 0.25);
        this.playTone(ctx, 1108.73, now + 0.08, 0.15, 0.2);
      } else if (type === "afk") {
        // Gentle low double-tap
        this.playTone(ctx, 330, now, 0.08, 0.15);
        this.playTone(ctx, 330, now + 0.15, 0.08, 0.15);
      }
    } catch {
      // Audio unavailable
    }
  }

  private playTone(ctx: AudioContext, freq: number, startTime: number, duration: number, volume: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  /**
   * Get the notification log.
   */
  getLog(): { time: number; message: string; type: string }[] {
    return this.notifLog;
  }

  private log(message: string, type: string): void {
    this.notifLog.unshift({ time: Date.now(), message, type });
    if (this.notifLog.length > 50) this.notifLog.pop();
  }

  /**
   * Reset state for a new session.
   */
  reset(): void {
    this.skillStates.clear();
    this.notifLog = [];
  }

  /**
   * Enable/disable notifications.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}
