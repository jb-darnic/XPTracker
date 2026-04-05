// ============================================================================
// XPMeter Improved: Goal Tracker
// ============================================================================
// Set targets per skill (next level, 99, 120, 200M, or custom).
// Shows progress bar and ETA based on current XP rate.
// Persists goals to localStorage.

import { SkillId, SkillRate } from "../reader/types";
import { SKILL_DISPLAY_NAMES } from "../reader/constants";
import { xpToLevel, xpToNextLevel, xpToMilestone, formatEta, levelToXp } from "../data/xp-table";
import { SessionTracker } from "../tracker/SessionTracker";

const GOALS_STORAGE_KEY = "xpmeter-goals";

export type GoalType = "next" | "99" | "120" | "200m" | number;

export interface SkillGoal {
  skill: SkillId;
  type: GoalType;
  targetXp: number;
  label: string;
}

export interface GoalProgress {
  goal: SkillGoal;
  currentXp: number;
  currentLevel: number;
  xpRemaining: number;
  progressPct: number;
  eta: string;
  xpPerHour: number;
}

/**
 * Manages skill goals, calculates progress and ETA.
 */
export class GoalTracker {
  private goals: Map<SkillId, SkillGoal> = new Map();

  constructor() {
    this.load();
  }

  /**
   * Set a goal for a skill.
   */
  setGoal(skill: SkillId, type: GoalType): void {
    // We need a placeholder targetXp; it gets recalculated on each update
    // when we know the current XP.
    const milestone = xpToMilestone(0, type);
    this.goals.set(skill, {
      skill,
      type,
      targetXp: milestone.targetXp,
      label: milestone.label,
    });
    this.save();
  }

  /**
   * Remove a goal for a skill.
   */
  removeGoal(skill: SkillId): void {
    this.goals.delete(skill);
    this.save();
  }

  /**
   * Get all active goals.
   */
  getGoals(): SkillGoal[] {
    return Array.from(this.goals.values());
  }

  /**
   * Check if a skill has a goal set.
   */
  hasGoal(skill: SkillId): boolean {
    return this.goals.has(skill);
  }

  getGoal(skill: SkillId): SkillGoal | undefined {
    return this.goals.get(skill);
  }

  /**
   * Calculate progress for all goals given current rates.
   */
  calculateProgress(rates: SkillRate[]): GoalProgress[] {
    const results: GoalProgress[] = [];

    for (const [skill, goal] of this.goals) {
      const rate = rates.find((r) => r.skill === skill);
      const currentXp = rate?.currentXp || 0;
      const xpPerHour = rate?.xpPerHour || 0;

      if (currentXp <= 0) continue;

      // Recalculate target based on current XP (important for "next level")
      const milestone = xpToMilestone(currentXp, goal.type);
      goal.targetXp = milestone.targetXp;
      goal.label = milestone.label;

      const xpRemaining = milestone.xpNeeded;
      const currentLevel = xpToLevel(currentXp);

      // Progress percentage
      let progressPct: number;
      if (goal.type === "next") {
        const info = xpToNextLevel(currentXp);
        progressPct = info.progressPct;
      } else {
        progressPct = goal.targetXp > 0
          ? Math.min(100, (currentXp / goal.targetXp) * 100)
          : 100;
      }

      // ETA
      const etaMs = xpPerHour > 0 ? (xpRemaining / xpPerHour) * 3_600_000 : Infinity;

      results.push({
        goal,
        currentXp,
        currentLevel,
        xpRemaining,
        progressPct: Math.min(100, Math.max(0, progressPct)),
        eta: formatEta(etaMs),
        xpPerHour,
      });
    }

    return results;
  }

  /**
   * Render goal progress into a container element.
   */
  renderGoals(container: HTMLElement, rates: SkillRate[]): void {
    const progress = this.calculateProgress(rates);

    if (progress.length === 0) {
      container.innerHTML = `
        <div style="padding:12px 10px; text-align:center; font-size:10px; color:#5a5650;">
          No goals set. Click a skill name to set a goal.
        </div>
      `;
      return;
    }

    container.innerHTML = progress.map((p) => {
      const barColor = p.progressPct >= 100 ? "#3cc840" : "#d4a017";
      const barBg = p.progressPct >= 100 ? "rgba(60,200,64,0.1)" : "rgba(212,160,23,0.08)";

      return `
        <div class="goal-row" data-skill="${p.goal.skill}">
          <div class="goal-header">
            <span class="goal-skill">${SKILL_DISPLAY_NAMES[p.goal.skill]}</span>
            <span class="goal-target">${p.goal.label}</span>
            <span class="goal-eta">${p.eta}</span>
          </div>
          <div class="goal-bar-track" style="background:${barBg}">
            <div class="goal-bar-fill" style="width:${p.progressPct.toFixed(1)}%; background:${barColor};"></div>
          </div>
          <div class="goal-detail">
            <span>Lvl ${p.currentLevel} | ${SessionTracker.formatXp(p.xpRemaining)} remaining</span>
            <span>${p.progressPct.toFixed(1)}%</span>
          </div>
        </div>
      `;
    }).join("");
  }

  /**
   * Render the goal selector modal/dropdown for a skill.
   */
  static renderGoalSelector(skill: SkillId, currentXp: number): string {
    const currentLevel = xpToLevel(currentXp);
    const options: { type: GoalType; label: string; disabled: boolean }[] = [
      { type: "next", label: `Level ${currentLevel + 1}`, disabled: currentLevel >= 120 },
      { type: "99", label: "Level 99", disabled: currentXp >= 13_034_431 },
      { type: "120", label: "Level 120", disabled: currentXp >= 104_273_167 },
      { type: "200m", label: "200M XP", disabled: currentXp >= 200_000_000 },
    ];

    return options
      .filter((o) => !o.disabled)
      .map((o) => `<button class="goal-option" data-skill="${skill}" data-type="${o.type}">${o.label}</button>`)
      .join("");
  }

  private save(): void {
    try {
      const data: Record<string, { type: GoalType }> = {};
      for (const [skill, goal] of this.goals) {
        data[skill] = { type: goal.type };
      }
      localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("[GoalTracker] Failed to save:", e);
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(GOALS_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      for (const [skill, val] of Object.entries(data)) {
        if (val && typeof val === "object" && "type" in (val as any)) {
          this.setGoal(skill as SkillId, (val as any).type);
        }
      }
    } catch (e) {
      console.warn("[GoalTracker] Failed to load:", e);
    }
  }
}
