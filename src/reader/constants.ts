// ============================================================================
// XPMeter Improved: Constants
// ============================================================================

import { SkillId } from "./types";

/**
 * 3-letter abbreviation to full SkillId mapping.
 * Order matches the skill icon sprite strip in skills.data.png.
 */
export const SKILL_ABBREVS: string[] = [
  "tot", "att", "str", "ran", "mag", "def", "hpx", "pra", "sum", "dun",
  "agi", "thi", "sla", "hun", "smi", "cra", "fle", "her", "run", "coo",
  "con", "fir", "woo", "far", "fis", "min", "div", "inv", "com", "arc", "nec",
];

export const ABBREV_TO_SKILL: Record<string, SkillId> = {
  tot: "total",    att: "attack",       str: "strength",
  ran: "ranged",   mag: "magic",        def: "defence",
  hpx: "hitpoints", pra: "prayer",     sum: "summoning",
  dun: "dungeoneering", agi: "agility", thi: "thieving",
  sla: "slayer",   hun: "hunter",       smi: "smithing",
  cra: "crafting", fle: "fletching",    her: "herblore",
  run: "runecrafting", coo: "cooking",  con: "construction",
  fir: "firemaking", woo: "woodcutting", far: "farming",
  fis: "fishing",  min: "mining",       div: "divination",
  inv: "invention", com: "combat",      arc: "archaeology",
  nec: "necromancy",
};

export const SKILL_TO_ABBREV: Record<SkillId, string> = Object.fromEntries(
  Object.entries(ABBREV_TO_SKILL).map(([k, v]) => [v, k])
) as Record<SkillId, string>;

/**
 * Display names for skills.
 */
export const SKILL_DISPLAY_NAMES: Record<SkillId, string> = {
  total: "Total",         attack: "Attack",         strength: "Strength",
  ranged: "Ranged",       magic: "Magic",           defence: "Defence",
  hitpoints: "Constitution", prayer: "Prayer",      summoning: "Summoning",
  dungeoneering: "Dungeoneering", agility: "Agility", thieving: "Thieving",
  slayer: "Slayer",       hunter: "Hunter",         smithing: "Smithing",
  crafting: "Crafting",   fletching: "Fletching",   herblore: "Herblore",
  runecrafting: "Runecrafting", cooking: "Cooking",  construction: "Construction",
  firemaking: "Firemaking", woodcutting: "Woodcutting", farming: "Farming",
  fishing: "Fishing",     mining: "Mining",         divination: "Divination",
  invention: "Invention", combat: "Combat",         archaeology: "Archaeology",
  necromancy: "Necromancy",
};

/**
 * Skill icon sprite dimensions.
 */
export const ICON_SIZE = { w: 27, h: 27 };

/**
 * Pin indicator area to clear during icon matching.
 */
export const PIN_AREA = { x: -3, y: 10, w: 8, h: 8 };

/**
 * Default counter width (pixels) for the RuneMetrics panel.
 */
export const COUNTER_WIDTH = 140;

/**
 * Colors that indicate the stats list (not RuneMetrics counters).
 * Used to filter false positives during detection.
 * Tolerance-based matching, not exact.
 */
export const STATS_LIST_COLORS = [
  { r: 240, g: 190, b: 121 },
  { r: 255, g: 140, b: 0 },
  { r: 255, g: 203, b: 5 },
];

/**
 * Color tolerance for stats list detection.
 */
export const COLOR_TOLERANCE = 30;

/**
 * XP circle indicator colors (yellow arc below skill icon).
 */
export const XP_CIRCLE_COLORS = {
  primary: { r: 249, g: 220, b: 0 },
  secondary: { r: 186, g: 190, b: 202 },
};

/**
 * OCR text color for RuneMetrics XP values.
 */
export const XP_TEXT_COLOR: [number, number, number] = [255, 255, 255];

/**
 * Maximum consecutive detection failures before re-scanning.
 */
export const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Default polling interval in ms.
 */
export const DEFAULT_POLL_INTERVAL = 1000;

/**
 * Default AFK threshold in ms.
 */
export const DEFAULT_AFK_THRESHOLD = 30000;

/**
 * Default sliding window duration for rate calculation (ms).
 */
export const DEFAULT_RATE_WINDOW = 5 * 60 * 1000;
