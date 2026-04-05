// ============================================================================
// XPMeter Improved: Type Definitions
// ============================================================================

/**
 * All RS3 skill identifiers. Matches the order in the skill icon sprite strip.
 */
export type SkillId =
  | "total"
  | "attack"
  | "strength"
  | "ranged"
  | "magic"
  | "defence"
  | "hitpoints"
  | "prayer"
  | "summoning"
  | "dungeoneering"
  | "agility"
  | "thieving"
  | "slayer"
  | "hunter"
  | "smithing"
  | "crafting"
  | "fletching"
  | "herblore"
  | "runecrafting"
  | "cooking"
  | "construction"
  | "firemaking"
  | "woodcutting"
  | "farming"
  | "fishing"
  | "mining"
  | "divination"
  | "invention"
  | "combat"
  | "archaeology"
  | "necromancy";

/**
 * Position of the RuneMetrics counter interface on screen.
 */
export interface CounterPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  rowCount: number;
  rowHeight: number;
}

/**
 * A single XP reading for one skill at a point in time.
 */
export interface SkillReading {
  skill: SkillId;
  xp: number;
  isRounded: boolean;
  timestamp: number;
}

/**
 * A complete snapshot of all visible counters.
 */
export interface CounterSnapshot {
  readings: SkillReading[];
  timestamp: number;
  position: CounterPosition;
}

/**
 * Computed XP rate data for a single skill.
 */
export interface SkillRate {
  skill: SkillId;
  currentXp: number;
  startXp: number;
  xpGained: number;
  xpPerHour: number;
  actionsDetected: number;
  elapsedMs: number;
  lastDropSize: number;
  isActive: boolean;
}

/**
 * A tracked session with full state.
 */
export interface Session {
  id: string;
  startTime: number;
  lastUpdateTime: number;
  rates: Record<string, SkillRate>;
  isActive: boolean;
  isPaused: boolean;
  totalAfkMs: number;
  snapshotCount: number;
}

/**
 * Serializable session summary for localStorage persistence.
 */
export interface SessionSummary {
  id: string;
  startTime: number;
  endTime: number;
  duration: string;
  skills: { skill: SkillId; xpGained: number; xpPerHour: number }[];
}

/**
 * All events emitted by the XPMeter system.
 */
export interface XpMeterEvents {
  "counter:found": CounterPosition;
  "counter:lost": void;
  "counter:updated": CounterSnapshot;
  "rate:updated": SkillRate[];
  "session:started": Session;
  "session:paused": void;
  "session:resumed": void;
  "session:ended": SessionSummary;
  "afk:detected": { durationMs: number };
  "afk:resumed": void;
  "error:detection": { message: string; recoverable: boolean };
  "status:changed": string;
}

/**
 * Reader detection state machine.
 */
export type ReaderState =
  | "idle"
  | "searching"
  | "tracking"
  | "lost"
  | "error";
