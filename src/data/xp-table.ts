// ============================================================================
// XPMeter Improved: RS3 XP Level Table
// ============================================================================
// Complete XP requirements for levels 1-120 (+ 150 virtual).
// Used by: GoalTracker (ETA), NotificationManager (level-up detection)

export const XP_TABLE: number[] = [
  0,           // Level 1
  83,          // Level 2
  174,         // Level 3
  276,         // Level 4
  388,         // Level 5
  512,         // Level 6
  650,         // Level 7
  801,         // Level 8
  969,         // Level 9
  1154,        // Level 10
  1358,        // Level 11
  1584,        // Level 12
  1833,        // Level 13
  2107,        // Level 14
  2411,        // Level 15
  2746,        // Level 16
  3115,        // Level 17
  3523,        // Level 18
  3973,        // Level 19
  4470,        // Level 20
  5018,        // Level 21
  5624,        // Level 22
  6291,        // Level 23
  7028,        // Level 24
  7842,        // Level 25
  8740,        // Level 26
  9730,        // Level 27
  10824,       // Level 28
  12031,       // Level 29
  13363,       // Level 30
  14833,       // Level 31
  16456,       // Level 32
  18247,       // Level 33
  20224,       // Level 34
  22406,       // Level 35
  24815,       // Level 36
  27473,       // Level 37
  30408,       // Level 38
  33648,       // Level 39
  37224,       // Level 40
  41171,       // Level 41
  45529,       // Level 42
  50339,       // Level 43
  55649,       // Level 44
  61512,       // Level 45
  67983,       // Level 46
  75127,       // Level 47
  83014,       // Level 48
  91721,       // Level 49
  101333,      // Level 50
  111945,      // Level 51
  123660,      // Level 52
  136594,      // Level 53
  150872,      // Level 54
  166636,      // Level 55
  184040,      // Level 56
  203254,      // Level 57
  224466,      // Level 58
  247886,      // Level 59
  273742,      // Level 60
  302288,      // Level 61
  333804,      // Level 62
  368599,      // Level 63
  407015,      // Level 64
  449428,      // Level 65
  496254,      // Level 66
  547953,      // Level 67
  605032,      // Level 68
  668051,      // Level 69
  737627,      // Level 70
  814445,      // Level 71
  899257,      // Level 72
  992895,      // Level 73
  1096278,     // Level 74
  1210421,     // Level 75
  1336443,     // Level 76
  1475581,     // Level 77
  1629200,     // Level 78
  1798808,     // Level 79
  1986068,     // Level 80
  2192818,     // Level 81
  2421087,     // Level 82
  2673114,     // Level 83
  2951373,     // Level 84
  3258594,     // Level 85
  3597792,     // Level 86
  3972294,     // Level 87
  4385776,     // Level 88
  4842295,     // Level 89
  5346332,     // Level 90
  5902831,     // Level 91
  6517253,     // Level 92
  7195629,     // Level 93
  7944614,     // Level 94
  8771558,     // Level 95
  9684577,     // Level 96
  10692629,    // Level 97
  11805606,    // Level 98
  13034431,    // Level 99
  14391160,    // Level 100
  15889109,    // Level 101
  17542976,    // Level 102
  19368992,    // Level 103
  21385073,    // Level 104
  23611006,    // Level 105
  26068632,    // Level 106
  28782069,    // Level 107
  31777943,    // Level 108
  35085654,    // Level 109
  38737661,    // Level 110
  42769801,    // Level 111
  47221641,    // Level 112
  52136869,    // Level 113
  57563718,    // Level 114
  63555443,    // Level 115
  70170840,    // Level 116
  77474828,    // Level 117
  85539082,    // Level 118
  94442737,    // Level 119
  104273167,   // Level 120
];

export const MAX_XP = 200_000_000;

/**
 * Get the level for a given XP value.
 */
export function xpToLevel(xp: number): number {
  for (let i = XP_TABLE.length - 1; i >= 0; i--) {
    if (xp >= XP_TABLE[i]) return i + 1;
  }
  return 1;
}

/**
 * Get XP required for a specific level.
 */
export function levelToXp(level: number): number {
  if (level < 1) return 0;
  if (level > XP_TABLE.length) return XP_TABLE[XP_TABLE.length - 1];
  return XP_TABLE[level - 1];
}

/**
 * Get XP remaining to next level.
 */
export function xpToNextLevel(currentXp: number): { nextLevel: number; xpNeeded: number; xpProgress: number; progressPct: number } {
  const currentLevel = xpToLevel(currentXp);
  const nextLevel = currentLevel + 1;

  if (nextLevel > XP_TABLE.length) {
    const xpNeeded = MAX_XP - currentXp;
    return { nextLevel: 121, xpNeeded: Math.max(0, xpNeeded), xpProgress: currentXp - XP_TABLE[XP_TABLE.length - 1], progressPct: currentXp / MAX_XP * 100 };
  }

  const currentLevelXp = XP_TABLE[currentLevel - 1];
  const nextLevelXp = XP_TABLE[nextLevel - 1];
  const xpNeeded = nextLevelXp - currentXp;
  const levelRange = nextLevelXp - currentLevelXp;
  const xpProgress = currentXp - currentLevelXp;
  const progressPct = levelRange > 0 ? (xpProgress / levelRange) * 100 : 100;

  return { nextLevel, xpNeeded, xpProgress, progressPct };
}

/**
 * Calculate XP remaining to a milestone.
 */
export function xpToMilestone(currentXp: number, milestone: "next" | "99" | "120" | "200m" | number): { targetXp: number; xpNeeded: number; label: string } {
  let targetXp: number;
  let label: string;

  if (milestone === "next") {
    const info = xpToNextLevel(currentXp);
    targetXp = info.nextLevel <= XP_TABLE.length ? XP_TABLE[info.nextLevel - 1] : MAX_XP;
    label = `Level ${info.nextLevel}`;
  } else if (milestone === "99") {
    targetXp = 13_034_431;
    label = "Level 99";
  } else if (milestone === "120") {
    targetXp = 104_273_167;
    label = "Level 120";
  } else if (milestone === "200m") {
    targetXp = MAX_XP;
    label = "200M XP";
  } else {
    targetXp = milestone;
    label = `${(milestone / 1_000_000).toFixed(0)}M XP`;
  }

  return {
    targetXp,
    xpNeeded: Math.max(0, targetXp - currentXp),
    label,
  };
}

/**
 * Format a duration in ms to a human-readable ETA string.
 */
export function formatEta(ms: number): string {
  if (ms <= 0) return "Done!";
  if (!isFinite(ms)) return "N/A";

  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 99) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
