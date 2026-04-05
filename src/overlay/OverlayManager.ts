// ============================================================================
// XPMeter Improved: Overlay Manager
// ============================================================================
// Abstracts the Alt1 overlay API into a managed system with:
// - Named overlay groups for batch management
// - Auto-refresh for active overlays
// - Position anchoring relative to detected RuneMetrics
// - Configurable layout (above/below/left/right)

import * as a1lib from "alt1/base";
import { EventBus } from "../events/EventBus";
import { Settings } from "../settings/Settings";
import { SkillRate, XpMeterEvents, CounterPosition } from "../reader/types";
import { SKILL_DISPLAY_NAMES } from "../reader/constants";
import { SessionTracker } from "../tracker/SessionTracker";

const OVERLAY_GROUP = "xpmeter-rates";
const OVERLAY_DURATION = 2000;

/**
 * Manages in-game overlay rendering for XP rates.
 */
export class OverlayManager {
  private bus: EventBus<XpMeterEvents>;
  private settings: Settings;
  private counterPos: CounterPosition | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private lastRates: SkillRate[] = [];

  constructor(bus: EventBus<XpMeterEvents>, settings: Settings) {
    this.bus = bus;
    this.settings = settings;

    this.bus.on("counter:found", (pos) => {
      this.counterPos = pos;
    });

    this.bus.on("counter:lost", () => {
      this.counterPos = null;
      this.clearOverlay();
    });

    this.bus.on("rate:updated", (rates) => {
      this.lastRates = rates;
      if (this.settings.get("overlayEnabled")) {
        this.renderRates(rates);
      }
    });

    // Auto-refresh overlay since elements expire
    this.refreshTimer = setInterval(() => {
      if (this.settings.get("overlayEnabled") && this.lastRates.length > 0) {
        this.renderRates(this.lastRates);
      }
    }, OVERLAY_DURATION - 200);
  }

  /**
   * Render XP rates as overlay text near the RuneMetrics counters.
   */
  private renderRates(rates: SkillRate[]): void {
    if (!window.alt1 || !this.counterPos) return;

    try {
      alt1.overLaySetGroup(OVERLAY_GROUP);
      alt1.overLayFreezeGroup(OVERLAY_GROUP);
      alt1.overLayClearGroup(OVERLAY_GROUP);

      const pos = this.counterPos;
      const direction = this.settings.get("overlayPosition");
      const activeRates = rates.filter((r) => r.xpPerHour > 0);

      if (activeRates.length === 0) return;

      let baseX: number;
      let baseY: number;

      switch (direction) {
        case "right":
          baseX = pos.x + pos.width + 8;
          baseY = pos.y;
          break;
        case "left":
          baseX = pos.x - 120;
          baseY = pos.y;
          break;
        case "above":
          baseX = pos.x;
          baseY = pos.y - (activeRates.length * 16) - 4;
          break;
        case "below":
        default:
          baseX = pos.x;
          baseY = pos.y + pos.height + 4;
          break;
      }

      for (let i = 0; i < activeRates.length; i++) {
        const rate = activeRates[i];
        const text = `${SessionTracker.formatRate(rate.xpPerHour)}`;
        const color = rate.isActive
          ? a1lib.mixColor(50, 255, 50)
          : a1lib.mixColor(180, 180, 180);

        alt1.overLayTextEx(
          text,
          color,
          10,
          baseX,
          baseY + i * 16,
          OVERLAY_DURATION,
          "",
          false,
          true
        );
      }
    } catch (e) {
      console.warn("[Overlay] Render error:", e);
    }
  }

  /**
   * Clear all overlay elements.
   */
  clearOverlay(): void {
    if (!window.alt1) return;
    try {
      alt1.overLayClearGroup(OVERLAY_GROUP);
    } catch {
      // Ignore if overlay API unavailable
    }
  }

  /**
   * Clean up on destroy.
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this.clearOverlay();
  }
}
