// ============================================================================
// XPMeter Improved: Main Entry Point (v2 with graph, goals, sparklines, notifs)
// ============================================================================

/// <reference path="../node_modules/alt1/dist/base/alt1api.d.ts" />
/// <reference path="../node_modules/alt1/dist/base/imagedata-extensions.d.ts" />

// @ts-ignore
import * as a1lib from "alt1";
import { EventBus } from "./events/EventBus";

// Declare alt1 globals
declare const alt1: any;
declare global { interface Window { alt1: any; } }
import { Settings } from "./settings/Settings";
import { XpCounterReader } from "./reader/XpCounterReader";
import { SessionTracker } from "./tracker/SessionTracker";
import { OverlayManager } from "./overlay/OverlayManager";
import { RateGraph } from "./ui/Graph";
import { SparklineManager } from "./ui/Sparkline";
import { GoalTracker, GoalType } from "./ui/GoalTracker";
import { NotificationManager } from "./notifications/NotificationManager";
import { XpMeterEvents, SkillRate, ReaderState, SkillId } from "./reader/types";
import { SKILL_DISPLAY_NAMES } from "./reader/constants";
import { xpToLevel, xpToMilestone, formatEta } from "./data/xp-table";

import "./index.html";
import "./appconfig.json";

// ---- Init ----
const bus = new EventBus<XpMeterEvents>();
const settings = new Settings();
const reader = new XpCounterReader(bus);
const tracker = new SessionTracker(bus, settings);
const overlay = new OverlayManager(bus, settings);
const sparklines = new SparklineManager();
const goals = new GoalTracker();
const notifications = new NotificationManager(bus, settings);

let graph: RateGraph | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let sessionStartTime = 0;
let sessionTimerInterval: ReturnType<typeof setInterval> | null = null;
let lastRates: SkillRate[] = [];
let graphCollapsed = false;

// ---- DOM ----
const $ = (id: string) => document.getElementById(id)!;
const $statusDot = $("statusDot");
const $statusText = $("statusText");
const $sessionTimer = $("sessionTimer");
const $skillList = $("skillList");
const $emptyState = $("emptyState");
const $footer = $("footer");
const $totalRate = $("totalRate");
const $totalGained = $("totalGained");
const $afkBanner = $("afkBanner");
const $warningBanner = $("warningBanner");
const $historyList = $("historyList");
const $goalsContainer = $("goalsContainer");
const $graphPanel = $("graphPanel");
const $graphCanvasWrap = $("graphCanvasWrap");
const $graphSkillBar = $("graphSkillBar");
const $goalPopup = $("goalPopup");
const $btnSession = $("btnSession") as HTMLButtonElement;
const $btnPause = $("btnPause") as HTMLButtonElement;
const $btnReset = $("btnReset") as HTMLButtonElement;

// ---- Init Graph ----
graph = new RateGraph($graphCanvasWrap, bus);

// ---- Event Wiring ----
bus.on("status:changed", (msg) => { $statusText.textContent = msg; });
bus.on("counter:found", () => setStatusDot("tracking"));
bus.on("counter:lost", () => {
  setStatusDot("lost");
  setTimeout(async () => { if (reader.getState() === "lost") await reader.find(); }, 2000);
});
bus.on("error:detection", (err) => {
  setStatusDot("error");
  if (err.message.includes("precise")) showWarning("Enable precise XP values in RuneMetrics");
});
bus.on("rate:updated", (rates) => {
  lastRates = rates;
  renderSkillRows(rates);
  updateGraphSkillButtons(rates);
  updateGoalsTab(rates);
  // Feed sparklines
  for (const r of rates) {
    sparklines.addPoint(r.skill, r.xpPerHour);
  }
  sparklines.renderAll();
});
bus.on("afk:detected", () => { $afkBanner.classList.add("visible"); });
bus.on("afk:resumed", () => { $afkBanner.classList.remove("visible"); });
bus.on("session:ended", () => renderHistory());

// ---- Status ----
function setStatusDot(state: ReaderState | "searching") { $statusDot.className = "status-dot " + state; }
function showWarning(msg: string) {
  $warningBanner.textContent = msg;
  $warningBanner.classList.add("visible");
  setTimeout(() => $warningBanner.classList.remove("visible"), 8000);
}

// ---- Graph Toggle ----
$("graphToggle").addEventListener("click", () => {
  graphCollapsed = !graphCollapsed;
  $graphPanel.classList.toggle("collapsed", graphCollapsed);
});

// ---- Graph Skill Selector ----
function updateGraphSkillButtons(rates: SkillRate[]) {
  const active = rates.filter((r) => r.xpPerHour > 0);
  const currentSkill = graph?.getActiveSkill() || "__total__";

  let html = `<button class="graph-skill-btn ${currentSkill === "__total__" ? "active" : ""}" data-graph-skill="__total__">Total</button>`;
  for (const r of active) {
    if (r.skill === "total") continue;
    const name = SKILL_DISPLAY_NAMES[r.skill] || r.skill;
    const short = name.length > 6 ? name.slice(0, 5) + "." : name;
    html += `<button class="graph-skill-btn ${currentSkill === r.skill ? "active" : ""}" data-graph-skill="${r.skill}">${short}</button>`;
  }
  $graphSkillBar.innerHTML = html;

  $graphSkillBar.querySelectorAll(".graph-skill-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const skill = (btn as HTMLElement).dataset.graphSkill || "__total__";
      graph?.setActiveSkill(skill);
      $graphSkillBar.querySelectorAll(".graph-skill-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
}

// ---- Skill Rows (with sparklines and inline goals) ----
function renderSkillRows(rates: SkillRate[]) {
  if (rates.length === 0) { $emptyState.style.display = ""; $footer.style.display = "none"; return; }
  $emptyState.style.display = "none";
  $footer.style.display = "";

  const scrollTop = $skillList.scrollTop;
  const existingRows = $skillList.querySelectorAll(".skill-row");
  const rowMap = new Map<string, HTMLElement>();
  existingRows.forEach((el) => { const s = (el as HTMLElement).dataset.skill; if (s) rowMap.set(s, el as HTMLElement); });

  for (const [skill, el] of rowMap) {
    if (!rates.find((r) => r.skill === skill)) { el.remove(); rowMap.delete(skill); }
  }

  for (const rate of rates) {
    let row = rowMap.get(rate.skill);
    if (!row) {
      row = createSkillRow(rate);
      $skillList.appendChild(row);
    }
    updateSkillRow(row, rate);
  }

  // Totals
  const totalSkill = rates.find((r) => r.skill === "total");
  const sumRate = rates.filter((r) => r.skill !== "total" && r.xpPerHour > 0).reduce((s, r) => s + r.xpPerHour, 0);
  const sumGained = rates.filter((r) => r.skill !== "total" && r.xpGained > 0).reduce((s, r) => s + r.xpGained, 0);
  $totalRate.textContent = SessionTracker.formatRate(totalSkill?.xpPerHour || sumRate);
  $totalGained.textContent = SessionTracker.formatXp(totalSkill?.xpGained || sumGained);
  $skillList.scrollTop = scrollTop;
}

function createSkillRow(rate: SkillRate): HTMLElement {
  const row = document.createElement("div");
  row.className = "skill-row";
  row.dataset.skill = rate.skill;
  row.innerHTML = `
    <div class="skill-info">
      <div class="skill-name" data-skill="${rate.skill}"></div>
      <div class="skill-xp-gained"></div>
    </div>
    <div class="skill-sparkline"></div>
    <div class="skill-rate-col">
      <div class="skill-rate"></div>
      <div class="skill-actions"></div>
    </div>
  `;

  // Sparkline canvas
  const sparkContainer = row.querySelector(".skill-sparkline")!;
  sparkContainer.appendChild(sparklines.getCanvas(rate.skill));

  // Skill name click -> goal popup
  row.querySelector(".skill-name")!.addEventListener("click", (e) => {
    showGoalPopup(rate.skill, rate.currentXp, e as MouseEvent);
  });

  return row;
}

function updateSkillRow(row: HTMLElement, rate: SkillRate) {
  const isActive = rate.xpPerHour > 0;
  row.className = `skill-row ${isActive ? "active" : "inactive"}`;

  row.querySelector(".skill-name")!.textContent = SKILL_DISPLAY_NAMES[rate.skill] || rate.skill;
  row.querySelector(".skill-xp-gained")!.textContent = rate.xpGained > 0 ? `+${SessionTracker.formatXp(rate.xpGained)}` : "";

  const rateEl = row.querySelector(".skill-rate")!;
  rateEl.textContent = rate.xpPerHour > 0 ? SessionTracker.formatRate(rate.xpPerHour) : "0/hr";
  rateEl.className = `skill-rate ${rate.xpPerHour > 0 ? "" : "zero"}`;

  const actionsEl = row.querySelector(".skill-actions")!;
  if (settings.get("showActionsPerHour") && rate.actionsDetected > 0) {
    actionsEl.textContent = `${Math.round((rate.actionsDetected / rate.elapsedMs) * 3_600_000)} act/hr`;
  } else { actionsEl.textContent = ""; }

  // Inline goal progress bar
  const existingGoalBar = row.querySelector(".skill-goal-bar");
  const existingGoalEta = row.querySelector(".skill-goal-eta");
  const goal = goals.getGoal(rate.skill);

  if (goal && rate.currentXp > 0 && rate.xpPerHour > 0) {
    const ms = xpToMilestone(rate.currentXp, goal.type);
    const pct = goal.targetXp > 0 ? Math.min(100, (rate.currentXp / ms.targetXp) * 100) : 100;
    const etaMs = rate.xpPerHour > 0 ? (ms.xpNeeded / rate.xpPerHour) * 3_600_000 : Infinity;

    if (!existingGoalBar) {
      const bar = document.createElement("div");
      bar.className = "skill-goal-bar";
      bar.innerHTML = `<div class="skill-goal-fill" style="width:${pct.toFixed(1)}%"></div>`;
      row.appendChild(bar);

      const eta = document.createElement("div");
      eta.className = "skill-goal-eta";
      eta.innerHTML = `<span>${ms.label}</span><span>${formatEta(etaMs)}</span>`;
      row.appendChild(eta);
    } else {
      (existingGoalBar.querySelector(".skill-goal-fill") as HTMLElement).style.width = `${pct.toFixed(1)}%`;
      if (existingGoalEta) existingGoalEta.innerHTML = `<span>${ms.label}</span><span>${formatEta(etaMs)}</span>`;
    }
  } else {
    existingGoalBar?.remove();
    existingGoalEta?.remove();
  }
}

// ---- Goal Popup ----
function showGoalPopup(skill: SkillId, currentXp: number, e: MouseEvent) {
  const hasGoal = goals.hasGoal(skill);
  const options: { type: GoalType | "remove"; label: string }[] = [
    { type: "next", label: `Next Level (${xpToLevel(currentXp) + 1})` },
    { type: "99", label: "Level 99" },
    { type: "120", label: "Level 120" },
    { type: "200m", label: "200M XP" },
  ];
  if (hasGoal) options.push({ type: "remove", label: "Remove Goal" });

  $goalPopup.innerHTML = options.map((o) =>
    `<button class="goal-option ${o.type === "remove" ? "remove" : ""}" data-skill="${skill}" data-type="${o.type}">${o.label}</button>`
  ).join("");

  $goalPopup.style.left = e.clientX + "px";
  $goalPopup.style.top = e.clientY + "px";
  $goalPopup.classList.add("visible");

  const handler = (ev: Event) => {
    const target = ev.target as HTMLElement;
    if (target.classList.contains("goal-option")) {
      const sk = target.dataset.skill as SkillId;
      const type = target.dataset.type as string;
      if (type === "remove") {
        goals.removeGoal(sk);
      } else {
        goals.setGoal(sk, type as GoalType);
      }
      $goalPopup.classList.remove("visible");
      renderSkillRows(lastRates);
      updateGoalsTab(lastRates);
    }
  };

  $goalPopup.addEventListener("click", handler, { once: true });
  setTimeout(() => {
    document.addEventListener("click", () => {
      $goalPopup.classList.remove("visible");
      $goalPopup.removeEventListener("click", handler);
    }, { once: true });
  }, 50);
}

// ---- Goals Tab ----
function updateGoalsTab(rates: SkillRate[]) {
  goals.renderGoals($goalsContainer, rates);
}

// ---- Session Timer ----
function startSessionTimer() {
  sessionStartTime = Date.now();
  if (sessionTimerInterval) clearInterval(sessionTimerInterval);
  sessionTimerInterval = setInterval(updateSessionTimer, 1000);
  updateSessionTimer();
}
function stopSessionTimer() {
  if (sessionTimerInterval) clearInterval(sessionTimerInterval);
  sessionTimerInterval = null;
  $sessionTimer.textContent = "";
}
function updateSessionTimer() {
  const e = Date.now() - sessionStartTime;
  const h = String(Math.floor(e / 3600000)).padStart(2, "0");
  const m = String(Math.floor((e % 3600000) / 60000)).padStart(2, "0");
  const s = String(Math.floor((e % 60000) / 1000)).padStart(2, "0");
  $sessionTimer.textContent = `${h}:${m}:${s}`;
}

// ---- History ----
function renderHistory() {
  const history = SessionTracker.loadHistory();
  if (history.length === 0) {
    $historyList.innerHTML = `<div class="empty-state"><div class="icon">&#x231A;</div><div class="message">No session history yet</div></div>`;
    return;
  }
  $historyList.innerHTML = history.map((s) => {
    const d = new Date(s.startTime);
    const ds = `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    const sk = s.skills.slice(0,3).map((x) => `${SKILL_DISPLAY_NAMES[x.skill]||x.skill}: ${SessionTracker.formatRate(x.xpPerHour)}`).join(" | ");
    return `<div class="history-entry"><div class="history-meta"><span>${ds}</span><span>${s.duration}</span></div><div class="history-skills">${sk||"No XP gained"}</div></div>`;
  }).join("");
}

// ---- Tabs ----
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = (tab as HTMLElement).dataset.tab;
    if (!target) return;
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`.tab-content[data-tab="${target}"]`)?.classList.add("active");
    if (target === "history") renderHistory();
    if (target === "goals") updateGoalsTab(lastRates);
  });
});

// ---- Settings ----
const settingsMap: [string, keyof any, (v: string) => any][] = [
  ["settingPollInterval", "pollIntervalMs", (v) => Math.max(300, Math.min(5000, parseInt(v)))],
  ["settingAfkThreshold", "afkThresholdMs", (v) => Math.max(5, Math.min(300, parseInt(v))) * 1000],
  ["settingRateWindow", "rateWindowMs", (v) => Math.max(1, Math.min(60, parseInt(v))) * 60000],
];
settingsMap.forEach(([id, key, parse]) => {
  const el = $(id) as HTMLInputElement;
  el.addEventListener("change", () => { (settings as any).set(key, parse(el.value)); if (key === "pollIntervalMs") restartPolling(); });
});

["settingOverlay:overlayEnabled", "settingActions:showActionsPerHour", "settingPersist:persistSessions"].forEach((pair) => {
  const [id, key] = pair.split(":");
  const el = $(id) as HTMLInputElement;
  el.checked = (settings as any).get(key);
  el.addEventListener("change", () => (settings as any).set(key, el.checked));
});

$("settingGraph")?.addEventListener("change", function() {
  const show = (this as HTMLInputElement).checked;
  $graphPanel.style.display = show ? "" : "none";
});

$("btnClearHistory")?.addEventListener("click", () => {
  localStorage.removeItem("xpmeter-session-history");
  localStorage.removeItem("xpmeter-goals");
  renderHistory();
});

// ---- Session Controls ----
$btnSession.addEventListener("click", async () => {
  if (tracker.isSessionActive()) return;
  $btnSession.disabled = true;
  $btnSession.textContent = "Searching...";
  setStatusDot("searching");
  bus.emit("status:changed", "Searching for RuneMetrics...");

  try {
    const pos = await reader.find();

    if (!pos) {
      // find() returned null — restore the Start button
      $btnSession.disabled = false;
      $btnSession.textContent = "Start";
      setStatusDot("error");
      bus.emit("status:changed", "Could not find RuneMetrics. Make sure counters are visible.");
      return;
    }

    // Success — switch to active session UI
    $btnSession.style.display = "none";
    $btnSession.disabled = false;
    $btnSession.textContent = "Start";
    $btnPause.style.display = "";
    $btnReset.style.display = "";
    tracker.startSession();
    startSessionTimer();
    startPolling();
    if (settings.get("debugMode")) reader.showDebugOverlay();
  } catch (err) {
    // Unexpected error — restore the Start button
    console.error("[XPMeter] Start failed:", err);
    $btnSession.disabled = false;
    $btnSession.textContent = "Start";
    setStatusDot("error");
    bus.emit("status:changed", "Error starting session. Try again.");
  }
});

$btnPause.addEventListener("click", () => {
  tracker.togglePause();
  const session = tracker.getSession();
  $btnPause.textContent = session?.isPaused ? "Resume" : "Pause";
  $btnPause.classList.toggle("active", !!session?.isPaused);
  bus.emit("status:changed", session?.isPaused ? "Paused" : "Resumed");
});

$btnReset.addEventListener("click", () => {
  tracker.endSession();
  stopPolling();
  stopSessionTimer();
  graph?.clear();
  sparklines.clear();
  $btnSession.style.display = "";
  $btnPause.style.display = "none";
  $btnReset.style.display = "none";
  $btnPause.textContent = "Pause";
  $btnPause.classList.remove("active");
  $skillList.querySelectorAll(".skill-row").forEach((r) => r.remove());
  $emptyState.style.display = "";
  $footer.style.display = "none";
  $afkBanner.classList.remove("visible");
  lastRates = [];
  setStatusDot("idle");
  bus.emit("status:changed", "Session ended");
});

// ---- Polling ----
function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    if (!tracker.isSessionActive()) return;
    if (!reader.getPosition()) { reader.find(); return; }
    const snapshot = reader.read();
    if (snapshot?.readings.some((r) => r.isRounded)) {
      showWarning("Abbreviated XP values detected. Enable precise values for accurate rates.");
    }
  }, settings.get("pollIntervalMs"));
}
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
function restartPolling() { if (tracker.isSessionActive()) startPolling(); }

// ---- Alt1 Init ----
if (window.alt1) {
  alt1.identifyAppUrl("./appconfig.json");
  bus.emit("status:changed", "Ready. Press Start to begin tracking.");
} else {
  const addUrl = `alt1://addapp/${new URL("./appconfig.json", document.location.href).href}`;
  $statusText.innerHTML = `Not in Alt1. <a href="${addUrl}" style="color:var(--gold)">Add to Alt1</a>`;
}

renderHistory();
