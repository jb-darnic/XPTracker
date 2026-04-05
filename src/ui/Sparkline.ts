// ============================================================================
// XPMeter Improved: Sparkline
// ============================================================================
// Tiny inline canvas-based sparklines (40x16px) showing per-skill
// rate trend over the last 10-15 minutes.
// Renders directly into a skill row. Green = trending up, red = trending down.

const SPARKLINE_W = 44;
const SPARKLINE_H = 16;
const MAX_SPARK_POINTS = 30; // ~30 points at 30s intervals = 15 min

/**
 * Manages sparkline data and rendering for all tracked skills.
 */
export class SparklineManager {
  private data: Map<string, number[]> = new Map();
  private canvases: Map<string, HTMLCanvasElement> = new Map();

  /**
   * Record a new rate value for a skill.
   */
  addPoint(skill: string, rate: number): void {
    if (!this.data.has(skill)) this.data.set(skill, []);
    const arr = this.data.get(skill)!;
    arr.push(rate);
    if (arr.length > MAX_SPARK_POINTS) arr.shift();
  }

  /**
   * Get or create a canvas element for a skill's sparkline.
   */
  getCanvas(skill: string): HTMLCanvasElement {
    if (this.canvases.has(skill)) return this.canvases.get(skill)!;

    const canvas = document.createElement("canvas");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SPARKLINE_W * dpr;
    canvas.height = SPARKLINE_H * dpr;
    canvas.style.width = SPARKLINE_W + "px";
    canvas.style.height = SPARKLINE_H + "px";
    canvas.style.display = "block";
    canvas.style.opacity = "0.85";

    this.canvases.set(skill, canvas);
    return canvas;
  }

  /**
   * Render the sparkline for a specific skill.
   */
  render(skill: string): void {
    const canvas = this.canvases.get(skill);
    if (!canvas) return;

    const points = this.data.get(skill) || [];
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = SPARKLINE_W;
    const h = SPARKLINE_H;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (points.length < 2) return;

    const maxVal = Math.max(...points) * 1.1 || 1;
    const minVal = 0;
    const range = maxVal - minVal || 1;

    // Determine trend color
    const recent = points.slice(-5);
    const older = points.slice(-10, -5);
    const recentAvg = recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
    const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;

    let lineColor: string;
    let fillColor: string;
    if (recentAvg > olderAvg * 1.03) {
      // Trending up
      lineColor = "#3cc840";
      fillColor = "rgba(60, 200, 64, 0.15)";
    } else if (recentAvg < olderAvg * 0.97) {
      // Trending down
      lineColor = "#c84040";
      fillColor = "rgba(200, 64, 64, 0.12)";
    } else {
      // Stable
      lineColor = "#d4a017";
      fillColor = "rgba(212, 160, 23, 0.10)";
    }

    const pad = 1;
    const chartW = w - pad * 2;
    const chartH = h - pad * 2;

    const toX = (i: number) => pad + (i / (points.length - 1)) * chartW;
    const toY = (v: number) => pad + chartH - ((v - minVal) / range) * chartH;

    // Area fill
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(0));
    for (let i = 0; i < points.length; i++) {
      if (i === 0) {
        ctx.lineTo(toX(i), toY(points[i]));
      } else {
        const px = toX(i - 1);
        const py = toY(points[i - 1]);
        const cx = toX(i);
        const cy = toY(points[i]);
        const midX = (px + cx) / 2;
        ctx.bezierCurveTo(midX, py, midX, cy, cx, cy);
      }
    }
    ctx.lineTo(toX(points.length - 1), toY(0));
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Line
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      if (i === 0) {
        ctx.moveTo(toX(i), toY(points[i]));
      } else {
        const px = toX(i - 1);
        const py = toY(points[i - 1]);
        const cx = toX(i);
        const cy = toY(points[i]);
        const midX = (px + cx) / 2;
        ctx.bezierCurveTo(midX, py, midX, cy, cx, cy);
      }
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Current value dot (last point)
    const lastX = toX(points.length - 1);
    const lastY = toY(points[points.length - 1]);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
  }

  /**
   * Render all tracked sparklines.
   */
  renderAll(): void {
    for (const [skill] of this.data) {
      this.render(skill);
    }
  }

  /**
   * Clear all data (on session reset).
   */
  clear(): void {
    this.data.clear();
    for (const [, canvas] of this.canvases) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, SPARKLINE_W, SPARKLINE_H);
      }
    }
  }
}
