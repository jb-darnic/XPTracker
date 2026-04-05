// ============================================================================
// XPMeter Improved: Real-Time Rate Graph
// ============================================================================
// Canvas-based area chart showing XP/hr over session duration.
// Plots data points every ~30s. Smooth bezier curves with gold fill.
// Supports hover tooltip for exact values.

import { SkillRate, SkillId, XpMeterEvents } from "../reader/types";
import { EventBus } from "../events/EventBus";
import { SessionTracker } from "../tracker/SessionTracker";

interface DataPoint {
  timestamp: number;
  rate: number;
}

const MAX_POINTS = 120; // 120 points * 30s = 60 min of data
const SAMPLE_INTERVAL = 30_000; // Record a point every 30 seconds

export class RateGraph {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;
  private bus: EventBus<XpMeterEvents>;
  private history: Map<string, DataPoint[]> = new Map();
  private activeSkill: string = "__total__";
  private lastSampleTime = 0;
  private hoverX: number | null = null;
  private animFrame: number | null = null;

  // Design tokens
  private readonly COLORS = {
    bg: "#0e0e11",
    grid: "rgba(42, 42, 51, 0.6)",
    gridLabel: "rgba(138, 134, 128, 0.7)",
    lineGold: "#d4a017",
    fillGold: "rgba(212, 160, 23, 0.12)",
    lineGreen: "#3cc840",
    fillGreen: "rgba(60, 200, 64, 0.10)",
    hover: "rgba(255, 255, 255, 0.8)",
    hoverLine: "rgba(212, 160, 23, 0.3)",
    tooltip: "#1e1e24",
    tooltipBorder: "#3a3524",
    tooltipText: "#d8d4cc",
  };

  constructor(container: HTMLElement, bus: EventBus<XpMeterEvents>) {
    this.container = container;
    this.bus = bus;

    this.canvas = document.createElement("canvas");
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.display = "block";
    container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext("2d")!;

    // Mouse hover for tooltip
    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.hoverX = e.clientX - rect.left;
      this.scheduleRender();
    });
    this.canvas.addEventListener("mouseleave", () => {
      this.hoverX = null;
      this.scheduleRender();
    });

    // Listen for rate updates
    this.bus.on("rate:updated", (rates) => this.onRateUpdate(rates));

    // Handle resize
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(container);
    this.resize();
  }

  /**
   * Switch which skill the graph shows.
   */
  setActiveSkill(skill: string): void {
    this.activeSkill = skill;
    this.scheduleRender();
  }

  getActiveSkill(): string {
    return this.activeSkill;
  }

  /**
   * Clear all graph data (on session reset).
   */
  clear(): void {
    this.history.clear();
    this.lastSampleTime = 0;
    this.scheduleRender();
  }

  /**
   * Record data points from rate updates.
   */
  private onRateUpdate(rates: SkillRate[]): void {
    const now = Date.now();
    if (now - this.lastSampleTime < SAMPLE_INTERVAL) return;
    this.lastSampleTime = now;

    // Record total rate
    const totalRate = rates
      .filter((r) => r.skill !== "total" && r.xpPerHour > 0)
      .reduce((sum, r) => sum + r.xpPerHour, 0);

    this.addPoint("__total__", { timestamp: now, rate: totalRate });

    // Record per-skill rates
    for (const r of rates) {
      this.addPoint(r.skill, { timestamp: now, rate: r.xpPerHour });
    }

    this.scheduleRender();
  }

  private addPoint(key: string, point: DataPoint): void {
    if (!this.history.has(key)) this.history.set(key, []);
    const arr = this.history.get(key)!;
    arr.push(point);
    if (arr.length > MAX_POINTS) arr.shift();
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.scheduleRender();
  }

  private scheduleRender(): void {
    if (this.animFrame) return;
    this.animFrame = requestAnimationFrame(() => {
      this.animFrame = null;
      this.render();
    });
  }

  private render(): void {
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);
    const ctx = this.ctx;

    const pad = { top: 8, right: 8, bottom: 20, left: 44 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    // Clear
    ctx.clearRect(0, 0, w, h);

    const points = this.history.get(this.activeSkill) || [];

    if (points.length < 2) {
      // Empty state
      ctx.fillStyle = this.COLORS.gridLabel;
      ctx.font = "10px 'Barlow', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Collecting data...", w / 2, h / 2);
      return;
    }

    // Calculate bounds
    const rates = points.map((p) => p.rate);
    const maxRate = Math.max(...rates) * 1.15 || 1;
    const minRate = 0;
    const timeStart = points[0].timestamp;
    const timeEnd = points[points.length - 1].timestamp;
    const timeRange = timeEnd - timeStart || 1;

    const toX = (t: number) => pad.left + ((t - timeStart) / timeRange) * chartW;
    const toY = (r: number) => pad.top + chartH - ((r - minRate) / (maxRate - minRate)) * chartH;

    // Grid lines (horizontal)
    ctx.strokeStyle = this.COLORS.grid;
    ctx.lineWidth = 0.5;
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillStyle = this.COLORS.gridLabel;
    ctx.textAlign = "right";

    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const rate = minRate + ((maxRate - minRate) * i) / gridLines;
      const y = toY(rate);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      if (i > 0) {
        const label = rate >= 1_000_000
          ? (rate / 1_000_000).toFixed(1) + "M"
          : rate >= 1_000
          ? (rate / 1_000).toFixed(0) + "K"
          : rate.toFixed(0);
        ctx.fillText(label, pad.left - 4, y + 3);
      }
    }

    // Time labels (bottom)
    ctx.textAlign = "center";
    const elapsed = timeRange / 60_000;
    const timeSteps = Math.min(5, Math.floor(elapsed / 2) + 1);
    for (let i = 0; i <= timeSteps; i++) {
      const t = timeStart + (timeRange * i) / timeSteps;
      const x = toX(t);
      const mins = Math.round((t - timeStart) / 60_000);
      ctx.fillText(`${mins}m`, x, h - 4);
    }

    // Area fill
    const isTotal = this.activeSkill === "__total__";
    const lineColor = isTotal ? this.COLORS.lineGold : this.COLORS.lineGreen;
    const fillColor = isTotal ? this.COLORS.fillGold : this.COLORS.fillGreen;

    ctx.beginPath();
    ctx.moveTo(toX(points[0].timestamp), toY(0));
    for (let i = 0; i < points.length; i++) {
      const x = toX(points[i].timestamp);
      const y = toY(points[i].rate);
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        // Smooth bezier between points
        const prev = points[i - 1];
        const px = toX(prev.timestamp);
        const py = toY(prev.rate);
        const cpx = (px + x) / 2;
        ctx.bezierCurveTo(cpx, py, cpx, y, x, y);
      }
    }
    ctx.lineTo(toX(points[points.length - 1].timestamp), toY(0));
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const x = toX(points[i].timestamp);
      const y = toY(points[i].rate);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prev = points[i - 1];
        const px = toX(prev.timestamp);
        const py = toY(prev.rate);
        const cpx = (px + x) / 2;
        ctx.bezierCurveTo(cpx, py, cpx, y, x, y);
      }
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Hover tooltip
    if (this.hoverX !== null && this.hoverX >= pad.left && this.hoverX <= w - pad.right) {
      const hoverTime = timeStart + ((this.hoverX - pad.left) / chartW) * timeRange;

      // Find closest point
      let closest = points[0];
      let closestDist = Infinity;
      for (const p of points) {
        const dist = Math.abs(p.timestamp - hoverTime);
        if (dist < closestDist) {
          closestDist = dist;
          closest = p;
        }
      }

      const cx = toX(closest.timestamp);
      const cy = toY(closest.rate);

      // Vertical guide line
      ctx.strokeStyle = this.COLORS.hoverLine;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, pad.top);
      ctx.lineTo(cx, pad.top + chartH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dot
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
      ctx.strokeStyle = this.COLORS.hover;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Tooltip box
      const rateText = SessionTracker.formatRate(closest.rate);
      const minsAgo = Math.round((closest.timestamp - timeStart) / 60_000);
      const tooltipText = `${rateText} @ ${minsAgo}m`;

      ctx.font = "10px 'JetBrains Mono', monospace";
      const tw = ctx.measureText(tooltipText).width + 12;
      const th = 18;
      let tx = cx - tw / 2;
      if (tx < pad.left) tx = pad.left;
      if (tx + tw > w - pad.right) tx = w - pad.right - tw;
      const ty = cy - th - 8;

      ctx.fillStyle = this.COLORS.tooltip;
      ctx.strokeStyle = this.COLORS.tooltipBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw, th, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = this.COLORS.tooltipText;
      ctx.textAlign = "center";
      ctx.fillText(tooltipText, tx + tw / 2, ty + 13);
    }
  }

  destroy(): void {
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
  }
}
