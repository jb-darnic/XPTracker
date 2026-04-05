// ============================================================================
// XPMeter Improved: XP Counter Reader
// ============================================================================
// Ported and improved from alt1/xpcounter. Key improvements:
// - Typed interfaces throughout
// - Multi-font OCR support (10pt-18pt)
// - Fuzzy color matching with configurable tolerance
// - Auto re-detection on consecutive failures
// - Event-driven state machine instead of callback arrays
// - Rounded value detection with explicit warning

/// <reference path="../../node_modules/alt1/dist/base/alt1api.d.ts" />
/// <reference path="../../node_modules/alt1/dist/base/imagedata-extensions.d.ts" />

// @ts-ignore
import * as a1lib from "alt1";
// @ts-ignore
import * as OCR from "alt1/ocr";
// @ts-ignore
import { webpackImages, findSubbuffer, simpleCompare, ImgRef } from "alt1/base";
import { EventBus } from "../events/EventBus";

// Declare alt1 globals
declare const alt1: any;
declare global { interface Window { alt1: any; } }
import {
  CounterPosition,
  CounterSnapshot,
  SkillReading,
  ReaderState,
  XpMeterEvents,
  SkillId,
} from "./types";
import {
  SKILL_ABBREVS,
  ABBREV_TO_SKILL,
  ICON_SIZE,
  PIN_AREA,
  COUNTER_WIDTH,
  STATS_LIST_COLORS,
  COLOR_TOLERANCE,
  XP_CIRCLE_COLORS,
  XP_TEXT_COLOR,
  MAX_CONSECUTIVE_FAILURES,
} from "./constants";

// Fonts: support multiple sizes for different interface scale settings
const chatfonts: { size: string; def: OCR.FontDefinition }[] = [
  { size: "10pt", def: require("alt1/fonts/chatbox/10pt.js") },
  { size: "12pt", def: require("alt1/fonts/chatbox/12pt.js") },
  { size: "14pt", def: require("alt1/fonts/chatbox/14pt.js") },
];

// Skill icon reference images
const imgs = webpackImages({
  skills: require("./imgs/skills.data.png"),
});

/**
 * Tolerance-based color difference check.
 */
function colorClose(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number, tol: number): boolean {
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2) < tol;
}

/**
 * Improved XP Counter Reader.
 *
 * Detects the RuneMetrics XP counter interface on screen,
 * reads skill icons and XP values, and emits structured snapshots.
 */
export class XpCounterReader {
  private state: ReaderState = "idle";
  private position: CounterPosition | null = null;
  private skillIcons: ImageData[] = [];
  private consecutiveFailures = 0;
  private detectedFont: typeof chatfonts[number] | null = null;
  private bus: EventBus<XpMeterEvents>;

  constructor(bus: EventBus<XpMeterEvents>) {
    this.bus = bus;
    this.initIcons();
  }

  /**
   * Initialize skill icon sprites from the packed strip.
   */
  private async initIcons(): Promise<void> {
    await imgs.promise;
    this.skillIcons = [];

    for (let x = 0; x < imgs.skills.width; x += ICON_SIZE.w) {
      const icon = imgs.skills.clone(new a1lib.Rect(x, 0, ICON_SIZE.w, ICON_SIZE.h));
      // Clear the pin indicator area to avoid false mismatches
      for (let xx = 0; xx < PIN_AREA.x + PIN_AREA.w; xx++) {
        for (let yy = PIN_AREA.y; yy < PIN_AREA.y + PIN_AREA.h; yy++) {
          icon.setPixel(xx, yy, 0, 0, 0, 0);
        }
      }
      this.skillIcons.push(icon);
    }
  }

  getState(): ReaderState {
    return this.state;
  }

  getPosition(): CounterPosition | null {
    return this.position;
  }

  /**
   * Scan the full screen to find the RuneMetrics XP counter interface.
   * Improved: uses tolerance-based color matching and groups by proximity.
   */
  async find(img?: ImgRef): Promise<CounterPosition | null> {
    this.state = "searching";
    this.bus.emit("status:changed", "Searching for RuneMetrics...");

    if ((!window.alt1 || !alt1.rsLinked) && !img) {
      this.state = "error";
      this.bus.emit("error:detection", {
        message: "Alt1 not connected or RS3 not detected",
        recoverable: true,
      });
      return null;
    }

    let buffer: ImageData;
    if (!img) {
      buffer = a1lib.capture(0, 0, alt1.rsWidth, alt1.rsHeight);
    } else {
      buffer = img.toData();
    }

    if (this.skillIcons.length === 0) {
      await imgs.promise;
      if (this.skillIcons.length === 0) {
        this.state = "error";
        this.bus.emit("error:detection", {
          message: "Skill icons failed to load",
          recoverable: false,
        });
        return null;
      }
    }

    type Match = { skill: number; x: number; y: number };
    const matches: Match[] = [];

    // Scan each skill icon against the full screen buffer
    for (let i = 0; i < this.skillIcons.length; i++) {
      const positions = findSubbuffer(buffer, this.skillIcons[i]);

      for (const pos of positions) {
        let isStatsList = false;
        let isXpCircle = false;

        // Check for stats list indicator (orange-ish text to the right)
        for (let xx = 0; xx < 10; xx++) {
          const p = buffer.getPixel(pos.x + 30 + xx, pos.y + 8);
          for (const sc of STATS_LIST_COLORS) {
            if (colorClose(p[0], p[1], p[2], sc.r, sc.g, sc.b, COLOR_TOLERANCE)) {
              isStatsList = true;
              break;
            }
          }
          if (isStatsList) break;
        }

        // Check for XP circle indicator (only on first match per icon)
        if (matches.filter((m) => m.skill === i).length === 0) {
          const p1 = buffer.getPixel(pos.x + 14, pos.y + 31);
          const p2 = buffer.getPixel(pos.x + 15, pos.y + 31);
          if (
            colorClose(p1[0], p1[1], p1[2], XP_CIRCLE_COLORS.primary.r, XP_CIRCLE_COLORS.primary.g, XP_CIRCLE_COLORS.primary.b, COLOR_TOLERANCE) &&
            colorClose(p2[0], p2[1], p2[2], XP_CIRCLE_COLORS.secondary.r, XP_CIRCLE_COLORS.secondary.g, XP_CIRCLE_COLORS.secondary.b, COLOR_TOLERANCE)
          ) {
            isXpCircle = true;
          }
        }

        if (!isStatsList && !isXpCircle) {
          matches.push({ skill: i, x: pos.x, y: pos.y });
        }
      }
    }

    // Group matches by X-coordinate to find vertical columns
    const groups = new Map<number, Match[]>();
    for (const m of matches) {
      // Use proximity grouping (within 3px) instead of exact X match
      let foundGroup = false;
      for (const [gx, arr] of groups) {
        if (Math.abs(gx - m.x) < 3) {
          arr.push(m);
          foundGroup = true;
          break;
        }
      }
      if (!foundGroup) {
        groups.set(m.x, [m]);
      }
    }

    // Find the largest group (most vertically aligned skill icons)
    let bestGroup: Match[] = [];
    for (const [, arr] of groups) {
      if (arr.length > bestGroup.length) {
        bestGroup = arr;
      }
    }

    if (bestGroup.length < 2) {
      this.state = "lost";
      this.bus.emit("error:detection", {
        message: "Could not find RuneMetrics counters. Ensure they are visible and not abbreviated.",
        recoverable: true,
      });
      return null;
    }

    const minY = Math.min(...bestGroup.map((m) => m.y));
    const maxY = Math.max(...bestGroup.map((m) => m.y));

    this.position = {
      x: bestGroup[0].x,
      y: minY,
      width: COUNTER_WIDTH,
      height: maxY - minY + ICON_SIZE.h,
      rowCount: bestGroup.length,
      rowHeight: ICON_SIZE.h,
    };

    this.state = "tracking";
    this.consecutiveFailures = 0;
    this.bus.emit("counter:found", this.position);
    this.bus.emit("status:changed", `Found ${bestGroup.length} skill counters`);

    return this.position;
  }

  /**
   * Read current skill identifiers from the detected position.
   */
  readSkills(img?: ImgRef): SkillId[] | null {
    if (!this.position) return null;

    const captured = img || a1lib.captureHold(this.position.x, this.position.y, ICON_SIZE.w, this.position.height);
    const buf = captured.toData(this.position.x, this.position.y, ICON_SIZE.w, captured.height);

    const skills: SkillId[] = [];
    let misses = 0;

    for (let i = 0; (i + 1) * ICON_SIZE.h <= buf.height; i++) {
      let found = false;
      for (let a = 0; a < this.skillIcons.length; a++) {
        if (simpleCompare(buf, this.skillIcons[a], 0, i * ICON_SIZE.h) < Infinity) {
          const abbrev = SKILL_ABBREVS[a];
          const skillId = ABBREV_TO_SKILL[abbrev];
          if (skillId) {
            skills.push(skillId);
            found = true;
          }
          break;
        }
      }

      if (found) {
        misses = 0;
      } else {
        misses++;
      }
      if (misses > 1) break;
    }

    return skills;
  }

  /**
   * Read current XP values using multi-font OCR.
   */
  readValues(skillCount: number, img?: ImgRef): { values: number[]; rounded: boolean } | null {
    if (!this.position) return null;

    const captured = img || a1lib.captureHold(
      this.position.x,
      this.position.y,
      this.position.width,
      this.position.height
    );
    const buf = captured.toData(
      this.position.x,
      this.position.y,
      this.position.width,
      this.position.height
    );

    const values: number[] = [];
    let rounded = false;

    // Auto-detect font on first read, then cache
    const fontsToTry = this.detectedFont ? [this.detectedFont] : chatfonts;

    for (let i = 0; i < skillCount; i++) {
      let bestResult: { value: number; isRounded: boolean } | null = null;

      for (const font of fontsToTry) {
        const obj = OCR.readLine(buf, font.def, XP_TEXT_COLOR, 30, i * ICON_SIZE.h + 18, true, false);
        if (!obj || !obj.text) continue;

        const parsed = this.parseXpValue(obj.text);
        if (parsed !== null) {
          bestResult = parsed;
          // Cache the working font
          if (!this.detectedFont) {
            this.detectedFont = font;
          }
          break;
        }
      }

      if (bestResult) {
        values.push(bestResult.value);
        if (bestResult.isRounded) rounded = true;
      } else {
        values.push(-1);
      }
    }

    return { values, rounded };
  }

  /**
   * Parse an XP value string, handling K/M/T abbreviations and locale decimals.
   */
  private parseXpValue(text: string): { value: number; isRounded: boolean } | null {
    let multiplier = 1;
    let isRounded = false;

    if (/M$/i.test(text)) { multiplier = 1_000_000; isRounded = true; }
    else if (/[TK]$/i.test(text)) { multiplier = 1_000; isRounded = true; }

    let n: number;
    if (multiplier === 1) {
      n = parseInt(text.replace(/[,.\s]/g, ""), 10);
    } else {
      n = parseFloat(text.replace(/,/g, "."));
    }

    n *= multiplier;
    if (isNaN(n)) return null;

    return { value: n, isRounded };
  }

  /**
   * Perform a complete read cycle: skills + values.
   * Returns a full snapshot or null on failure.
   */
  read(): CounterSnapshot | null {
    if (!this.position) return null;

    try {
      const captured = a1lib.captureHold(
        this.position.x,
        this.position.y,
        this.position.width,
        (this.position.rowCount + 2) * ICON_SIZE.h
      );

      const skills = this.readSkills(captured);
      if (!skills || skills.length === 0) {
        this.handleFailure();
        return null;
      }

      const result = this.readValues(skills.length, captured);
      if (!result) {
        this.handleFailure();
        return null;
      }

      // Successful read: reset failure counter
      this.consecutiveFailures = 0;

      const now = Date.now();
      const readings: SkillReading[] = skills.map((skill, i) => ({
        skill,
        xp: result.values[i] ?? -1,
        isRounded: result.rounded,
        timestamp: now,
      }));

      const snapshot: CounterSnapshot = {
        readings,
        timestamp: now,
        position: { ...this.position },
      };

      this.bus.emit("counter:updated", snapshot);
      return snapshot;
    } catch (e) {
      this.handleFailure();
      return null;
    }
  }

  /**
   * Handle a detection failure. Auto-rescan after N consecutive failures.
   */
  private handleFailure(): void {
    this.consecutiveFailures++;

    if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      this.state = "lost";
      this.position = null;
      this.detectedFont = null;
      this.consecutiveFailures = 0;
      this.bus.emit("counter:lost", undefined);
      this.bus.emit("status:changed", "Lost RuneMetrics, re-scanning...");
    }
  }

  /**
   * Show a debug overlay rectangle around the detected position.
   */
  showDebugOverlay(): void {
    if (!this.position || !window.alt1) return;
    alt1.overLayRect(
      a1lib.mixColor(0, 255, 128),
      this.position.x,
      this.position.y,
      this.position.width,
      this.position.height,
      2000,
      2
    );
  }
}
