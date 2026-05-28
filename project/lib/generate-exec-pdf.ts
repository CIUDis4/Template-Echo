import type { ExecReportData, KpiDelta } from './executive-report';
import { format } from 'date-fns';

async function getJsPDF() {
  const { jsPDF } = await import('jspdf');
  return jsPDF;
}

// ─────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────
const C = {
  navy:        [10, 25, 55]    as [number,number,number],
  navyMid:     [18, 40, 80]    as [number,number,number],
  navyLight:   [28, 56, 110]   as [number,number,number],
  blue:        [37, 99, 235]   as [number,number,number],
  blueLight:   [219, 234, 254] as [number,number,number],
  teal:        [13, 148, 136]  as [number,number,number],
  tealLight:   [204, 251, 241] as [number,number,number],
  green:       [22, 163, 74]   as [number,number,number],
  greenLight:  [220, 252, 231] as [number,number,number],
  amber:       [217, 119, 6]   as [number,number,number],
  amberLight:  [254, 243, 199] as [number,number,number],
  orange:      [234, 88, 12]   as [number,number,number],
  red:         [220, 38, 38]   as [number,number,number],
  redLight:    [254, 226, 226] as [number,number,number],
  slate:       [71, 85, 105]   as [number,number,number],
  slateLight:  [248, 250, 252] as [number,number,number],
  slateMid:    [226, 232, 240] as [number,number,number],
  white:       [255, 255, 255] as [number,number,number],
  black:       [15, 23, 42]    as [number,number,number],
  muted:       [148, 163, 184] as [number,number,number],
  gold:        [202, 138, 4]   as [number,number,number],
  goldLight:   [254, 249, 195] as [number,number,number],
};

const W = 210;
const H = 297;
const M = 14;
const CW = W - M * 2;

type Doc = InstanceType<Awaited<ReturnType<typeof getJsPDF>>>;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function hdr(doc: Doc, title: string, pg: number, subtitle?: string) {
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, W, 11, 'F');
  doc.setFillColor(...C.blue);
  doc.rect(0, 0, 3, 11, 'F');
  doc.setTextColor(...C.muted);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TEMPLATE ECHO', M, 7);
  doc.setFont('helvetica', 'normal');
  if (subtitle) {
    doc.text(`${title}  ·  ${subtitle}`, W / 2, 7, { align: 'center' });
  } else {
    doc.text(title, W / 2, 7, { align: 'center' });
  }
  doc.text(`${pg}`, W - M, 7, { align: 'right' });
}

function ftr(doc: Doc, generatedAt: string) {
  doc.setFillColor(...C.navy);
  doc.rect(0, H - 9, W, 9, 'F');
  doc.setFillColor(...C.blue);
  doc.rect(0, H - 9, 3, 9, 'F');
  doc.setTextColor(...C.muted);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${generatedAt}   ·   Template Echo Executive Reporting Centre   ·   CONFIDENTIAL — Management Use Only`, W / 2, H - 3.5, { align: 'center' });
}

function secTitle(doc: Doc, y: number, label: string, accent: [number,number,number] = C.blue): number {
  doc.setFillColor(...C.navy);
  doc.rect(M, y, CW, 7.5, 'F');
  doc.setFillColor(...accent);
  doc.rect(M, y, 3.5, 7.5, 'F');
  doc.setTextColor(...C.white);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(label.toUpperCase(), M + 7, y + 5);
  return y + 7.5 + 4;
}

function divider(doc: Doc, y: number): number {
  doc.setDrawColor(...C.slateMid);
  doc.setLineWidth(0.3);
  doc.line(M, y, M + CW, y);
  return y + 3;
}

function roundRect(doc: Doc, x: number, y: number, w: number, h: number, r: number, fill: [number,number,number], stroke?: [number,number,number]) {
  doc.setFillColor(...fill);
  doc.roundedRect(x, y, w, h, r, r, stroke ? 'FD' : 'F');
  if (stroke) {
    doc.setDrawColor(...stroke);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, w, h, r, r, 'S');
  }
}

// ─────────────────────────────────────────────────────────────
// KPI CARD WITH TREND ARROW
// ─────────────────────────────────────────────────────────────
function kpiCard(
  doc: Doc, x: number, y: number, w: number, h: number,
  label: string, kpi: KpiDelta | { value: number; delta: null; trend: 'neutral'; trendPositive: boolean },
  valueFmt: string, bg: [number,number,number], accent: [number,number,number]
) {
  roundRect(doc, x, y, w, h, 2, bg);
  doc.setFillColor(...accent);
  doc.rect(x, y, 3, h, 'F');

  // Value
  doc.setTextColor(...C.navy);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(valueFmt, x + w / 2 + 1.5, y + h / 2 - 1.5, { align: 'center' });

  // Label
  doc.setTextColor(...C.slate);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text(label, x + w / 2 + 1.5, y + h / 2 + 4.5, { align: 'center' });

  // Delta
  if (kpi.delta !== null && kpi.delta !== 0) {
    const deltaColor = kpi.trendPositive ? C.green : C.red;
    const arrow = kpi.trend === 'up' ? '▲' : '▼';
    const pct = kpi.delta.toFixed(0);
    doc.setTextColor(...deltaColor);
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`${arrow} ${Math.abs(Number(pct))}`, x + w / 2 + 1.5, y + h - 3.5, { align: 'center' });
  }
}

// ─────────────────────────────────────────────────────────────
// GAUGE (ARC) — health score
// ─────────────────────────────────────────────────────────────
function drawGauge(doc: Doc, cx: number, cy: number, r: number, score: number, color: [number,number,number]) {
  const steps = 60;
  const startA = Math.PI; // left
  const totalSweep = Math.PI; // 180°
  const filledSweep = (score / 100) * totalSweep;

  // Background arc
  for (let i = 0; i < steps; i++) {
    const a1 = startA + (totalSweep * i) / steps;
    const a2 = startA + (totalSweep * (i + 1)) / steps;
    doc.setDrawColor(...C.slateMid);
    doc.setLineWidth(4);
    doc.line(
      cx + (r - 2) * Math.cos(a1), cy + (r - 2) * Math.sin(a1),
      cx + (r - 2) * Math.cos(a2), cy + (r - 2) * Math.sin(a2)
    );
  }

  // Filled arc
  const filledSteps = Math.round((filledSweep / totalSweep) * steps);
  for (let i = 0; i < filledSteps; i++) {
    const a1 = startA + (totalSweep * i) / steps;
    const a2 = startA + (totalSweep * (i + 1)) / steps;
    // Gradient from blue to green
    const t = i / steps;
    const rc = Math.round(color[0] * (1 - t) + C.teal[0] * t);
    const gc = Math.round(color[1] * (1 - t) + C.teal[1] * t);
    const bc = Math.round(color[2] * (1 - t) + C.teal[2] * t);
    doc.setDrawColor(rc, gc, bc);
    doc.setLineWidth(4);
    doc.line(
      cx + (r - 2) * Math.cos(a1), cy + (r - 2) * Math.sin(a1),
      cx + (r - 2) * Math.cos(a2), cy + (r - 2) * Math.sin(a2)
    );
  }

  // Needle
  const needleA = startA + filledSweep;
  doc.setDrawColor(...C.navy);
  doc.setLineWidth(1.2);
  doc.line(cx, cy, cx + (r - 6) * Math.cos(needleA), cy + (r - 6) * Math.sin(needleA));
  doc.setFillColor(...C.navy);
  doc.circle(cx, cy, 2, 'F');

  // Labels
  doc.setTextColor(...C.muted);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('0', cx - r + 1, cy + 5);
  doc.text('100', cx + r - 5, cy + 5);
}

// ─────────────────────────────────────────────────────────────
// DONUT CHART
// ─────────────────────────────────────────────────────────────
function donut(doc: Doc, cx: number, cy: number, r: number, data: Array<{ label: string; value: number; color: [number,number,number] }>) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    doc.setTextColor(...C.muted);
    doc.setFontSize(7);
    doc.text('No data', cx, cy + 2, { align: 'center' });
    return;
  }
  let startDeg = -90;
  data.forEach(s => {
    if (s.value === 0) return;
    const sweep = (s.value / total) * 360;
    const steps = Math.max(6, Math.ceil(sweep / 4));
    doc.setFillColor(...s.color);
    for (let i = 0; i < steps; i++) {
      const a1 = ((startDeg + (sweep * i) / steps) * Math.PI) / 180;
      const a2 = ((startDeg + (sweep * (i + 1)) / steps) * Math.PI) / 180;
      doc.triangle(cx, cy, cx + r * Math.cos(a1), cy + r * Math.sin(a1), cx + r * Math.cos(a2), cy + r * Math.sin(a2), 'F');
    }
    startDeg += sweep;
  });
  // Hole
  doc.setFillColor(...C.white);
  doc.circle(cx, cy, r * 0.52, 'F');
  // Centre label
  doc.setTextColor(...C.navy);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(String(total), cx, cy + 2.5, { align: 'center' });
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.muted);
  doc.text('total', cx, cy + 7, { align: 'center' });
}

// ─────────────────────────────────────────────────────────────
// LINE CHART
// ─────────────────────────────────────────────────────────────
function lineChart(
  doc: Doc, x: number, y: number, w: number, h: number,
  series: Array<{ label: string; values: number[]; color: [number,number,number]; dashed?: boolean }>,
  xLabels: string[]
) {
  const allVals = series.flatMap(s => s.values);
  const maxVal = Math.max(...allVals, 1);
  const step = w / Math.max(xLabels.length - 1, 1);

  // Grid
  for (let i = 0; i <= 4; i++) {
    const gy = y + (h / 4) * i;
    doc.setDrawColor(...C.slateMid);
    doc.setLineWidth(0.15);
    doc.line(x, gy, x + w, gy);
    doc.setTextColor(...C.muted);
    doc.setFontSize(5.5);
    doc.text(String(Math.round(maxVal - (maxVal / 4) * i)), x - 2, gy + 1.5, { align: 'right' });
  }

  // Area fill for first series
  if (series.length > 0) {
    const s = series[0];
    const pts: Array<{ x: number; y: number }> = s.values.map((v, i) => ({
      x: x + i * step,
      y: y + h - (v / maxVal) * h,
    }));
    // Fill polygon
    doc.setFillColor(series[0].color[0], series[0].color[1], series[0].color[2]);
    (doc as any).saveGraphicsState?.();
    // Draw area as triangles from baseline
    for (let i = 0; i < pts.length - 1; i++) {
      doc.setFillColor(series[0].color[0], series[0].color[1], series[0].color[2]);
      // Light fill
      const fillColor: [number, number, number] = [
        Math.min(255, series[0].color[0] + 170),
        Math.min(255, series[0].color[1] + 170),
        Math.min(255, series[0].color[2] + 180),
      ];
      doc.setFillColor(...fillColor);
      doc.triangle(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, pts[i].x, y + h, 'F');
      doc.triangle(pts[i + 1].x, pts[i + 1].y, pts[i + 1].x, y + h, pts[i].x, y + h, 'F');
    }
  }

  // Lines
  series.forEach(s => {
    doc.setDrawColor(...s.color);
    doc.setLineWidth(s.dashed ? 0.7 : 1.2);
    s.values.forEach((v, i) => {
      if (i === 0) return;
      const px = x + (i - 1) * step;
      const py = y + h - (s.values[i - 1] / maxVal) * h;
      const nx = x + i * step;
      const ny = y + h - (v / maxVal) * h;
      doc.line(px, py, nx, ny);
    });
    // Dots
    s.values.forEach((v, i) => {
      const px = x + i * step;
      const py = y + h - (v / maxVal) * h;
      doc.setFillColor(...s.color);
      doc.circle(px, py, 1.4, 'F');
      doc.setFillColor(...C.white);
      doc.circle(px, py, 0.7, 'F');
    });
  });

  // X labels
  xLabels.forEach((l, i) => {
    doc.setTextColor(...C.muted);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(l, x + i * step, y + h + 5, { align: 'center' });
  });
}

// ─────────────────────────────────────────────────────────────
// HORIZONTAL BAR
// ─────────────────────────────────────────────────────────────
function hBar(
  doc: Doc, x: number, y: number, maxW: number, maxVal: number,
  items: Array<{ label: string; value: number; value2?: number; color: [number,number,number]; color2?: [number,number,number] }>,
  rowH = 7
): number {
  const barArea = maxW - 42;
  items.forEach((item, i) => {
    const by = y + i * rowH;
    const bw = maxVal > 0 ? (item.value / maxVal) * barArea : 0;
    const bw2 = (item.value2 && maxVal > 0) ? (item.value2 / maxVal) * barArea : 0;

    doc.setTextColor(...C.slate);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    const lbl = item.label.length > 20 ? item.label.slice(0, 19) + '…' : item.label;
    doc.text(lbl, x, by + rowH / 2 + 1.5);

    // Background
    roundRect(doc, x + 42, by + 1, barArea, rowH - 3, 1, C.slateLight);

    // Bar 1
    if (bw > 0) {
      roundRect(doc, x + 42, by + 1, bw, (rowH - 3) / (item.value2 ? 2 : 1), 1, item.color);
    }
    // Bar 2 (stacked)
    if (bw2 > 0 && item.color2) {
      roundRect(doc, x + 42, by + 1 + (rowH - 3) / 2, bw2, (rowH - 3) / 2, 1, item.color2);
    }

    doc.setTextColor(...C.muted);
    doc.setFontSize(6);
    doc.text(String(item.value), x + maxW + 2, by + rowH / 2 + 1.5);
  });
  return y + items.length * rowH;
}

// ─────────────────────────────────────────────────────────────
// RISK BADGE
// ─────────────────────────────────────────────────────────────
function riskBadge(doc: Doc, x: number, y: number, label: string) {
  const colors: Record<string, { bg: [number,number,number]; text: [number,number,number] }> = {
    Critical: { bg: C.red, text: C.white },
    High:     { bg: C.amber, text: C.white },
    Medium:   { bg: C.blue, text: C.white },
    Low:      { bg: C.teal, text: C.white },
  };
  const c = colors[label] || colors.Low;
  roundRect(doc, x, y - 3.5, 16, 5, 1, c.bg);
  doc.setTextColor(...c.text);
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');
  doc.text(label.toUpperCase(), x + 8, y + 0.5, { align: 'center' });
}

// ─────────────────────────────────────────────────────────────
// DECORATIVE GRID WATERMARK
// ─────────────────────────────────────────────────────────────
function drawGridWatermark(doc: Doc) {
  doc.setDrawColor(40, 65, 120);
  doc.setLineWidth(0.2);
  for (let i = 0; i < W; i += 12) {
    doc.line(i, 0, i, H);
  }
  for (let j = 0; j < H; j += 12) {
    doc.line(0, j, W, j);
  }
  // Circuit-style dots at intersections (sample)
  doc.setFillColor(50, 80, 140);
  for (let i = 12; i < W; i += 48) {
    for (let j = 12; j < H; j += 48) {
      doc.circle(i, j, 1, 'F');
    }
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────
export async function generateExecPDF(data: ExecReportData): Promise<void> {
  const JsPDF = await getJsPDF();
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const filename = `TemplateEcho_Executive_Report_${month.replace(' ', '_')}.pdf`;
  let pg = 1;

  // ══════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ══════════════════════════════════════════════════════
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, W, H, 'F');
  drawGridWatermark(doc);

  // Left accent stripe
  doc.setFillColor(...C.blue);
  doc.rect(0, 0, 5, H, 'F');

  // Top gradient band
  for (let i = 0; i < 70; i++) {
    const t = i / 70;
    const r = Math.round(C.navyLight[0] + (C.navy[0] - C.navyLight[0]) * t);
    const g = Math.round(C.navyLight[1] + (C.navy[1] - C.navyLight[1]) * t);
    const b = Math.round(C.navyLight[2] + (C.navy[2] - C.navyLight[2]) * t);
    doc.setFillColor(r, g, b);
    doc.rect(0, i, W, 1, 'F');
  }

  // Teal accent line
  doc.setFillColor(...C.teal);
  doc.rect(5, 72, W - 5, 1.5, 'F');

  // Logo mark
  roundRect(doc, M + 5, 20, 18, 18, 3, C.blue);
  doc.setTextColor(...C.white);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TE', M + 14, 31.5, { align: 'center' });
  doc.setTextColor(...C.teal);
  doc.setFontSize(9);
  doc.text('TEMPLATE ECHO', M + 28, 31.5);
  doc.setTextColor(...C.muted);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Relay Template Engineering Intelligence', M + 28, 37.5);

  // Main title block
  doc.setTextColor(...C.white);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('EXECUTIVE', M + 5, 90);
  doc.setFontSize(26);
  doc.setTextColor(180, 210, 255);
  doc.text('MANAGEMENT REPORT', M + 5, 105);
  doc.setFillColor(...C.blue);
  doc.rect(M + 5, 108, 95, 1.2, 'F');
  doc.setTextColor(...C.muted);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Relay Template Engineering Intelligence & Operational Analytics', M + 5, 116);

  // Report metadata panel
  roundRect(doc, M + 5, 126, CW - 5, 52, 3, C.navyMid, C.navyLight);

  const metaItems: [string, string][] = [
    ['REPORTING PERIOD', data.filters.dateFrom && data.filters.dateTo ? `${data.filters.dateFrom}  →  ${data.filters.dateTo}` : 'All time (no date filter applied)'],
    ['GENERATED ON',     data.generatedAt],
    ['PREPARED BY',      data.generatedBy],
    ['REPORT VERSION',   data.reportVersion],
    ['CLASSIFICATION',   'CONFIDENTIAL — For Management Use Only'],
  ];
  metaItems.forEach(([k, v], i) => {
    const iy = 132 + i * 9;
    doc.setTextColor(...C.teal);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text(k, M + 12, iy);
    doc.setTextColor(...C.white);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(v, M + 12, iy + 4.5);
    if (i < metaItems.length - 1) {
      doc.setDrawColor(...C.navyLight);
      doc.setLineWidth(0.2);
      doc.line(M + 12, iy + 7, M + CW - 10, iy + 7);
    }
  });

  // Health score gauge panel
  const gaugeX = M + 5;
  const gaugeY = 186;
  roundRect(doc, gaugeX, gaugeY, 60, 50, 3, C.navyMid, C.navyLight);
  doc.setTextColor(...C.muted);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('PLATFORM HEALTH SCORE', gaugeX + 30, gaugeY + 6, { align: 'center' });
  const hs = data.healthScore;
  const hsColor = hs.label === 'Excellent' ? C.green : hs.label === 'Good' ? C.blue : hs.label === 'Needs Attention' ? C.amber : C.red;
  drawGauge(doc, gaugeX + 30, gaugeY + 30, 18, hs.score, hsColor);
  doc.setTextColor(...hsColor);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(String(hs.score), gaugeX + 30, gaugeY + 38, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setTextColor(...C.white);
  doc.text(hs.label.toUpperCase(), gaugeX + 30, gaugeY + 44, { align: 'center' });

  // KPI snapshot strip
  const snapKpis = [
    { label: 'Models', value: String(data.kpi.totalModels.value), color: C.blue },
    { label: 'Open Issues', value: String(data.kpi.openIssues.value), color: C.amber },
    { label: 'Critical', value: String(data.kpi.criticalIssues.value), color: C.red },
    { label: 'Resolved', value: String(data.kpi.resolvedIssues.value), color: C.green },
  ];
  const snapX = gaugeX + 64;
  const snapW = (CW - 69) / 4;
  snapKpis.forEach((k, i) => {
    const sx = snapX + i * (snapW + 2);
    roundRect(doc, sx, gaugeY, snapW, 50, 3, C.navyMid, C.navyLight);
    doc.setFillColor(...k.color);
    doc.rect(sx, gaugeY, snapW, 3, 'F');
    doc.setTextColor(...k.color);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(k.value, sx + snapW / 2, gaugeY + 25, { align: 'center' });
    doc.setTextColor(...C.muted);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(k.label, sx + snapW / 2, gaugeY + 33, { align: 'center' });
    // Resolution rate on last
    if (i === 3) {
      doc.setTextColor(...C.teal);
      doc.setFontSize(7);
      doc.text(`${data.kpi.resolutionRate}% rate`, sx + snapW / 2, gaugeY + 40, { align: 'center' });
    }
  });

  // Bottom confidential badge
  roundRect(doc, M + 5, H - 22, 50, 10, 2, C.red);
  doc.setTextColor(...C.white);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('CONFIDENTIAL', M + 30, H - 15.5, { align: 'center' });
  doc.setTextColor(...C.muted);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Template Echo  ·  ${data.reportVersion}  ·  ${data.generatedAt}`, W / 2, H - 7, { align: 'center' });

  // ══════════════════════════════════════════════════════
  // PAGE 2 — EXECUTIVE SUMMARY + NARRATIVE
  // ══════════════════════════════════════════════════════
  doc.addPage();
  pg++;
  hdr(doc, 'Executive Summary', pg, 'Management Intelligence');
  ftr(doc, data.generatedAt);

  let y = 16;
  y = secTitle(doc, y, '01  Executive Summary', C.navy);

  // Summary bullets
  data.executiveSummary.forEach((line, i) => {
    doc.setFillColor(...C.teal);
    doc.circle(M + 2.5, y + 3.5, 1.8, 'F');
    doc.setTextColor(...C.black);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const wrapped = doc.splitTextToSize(line, CW - 10);
    doc.text(wrapped, M + 7, y + 4.5);
    y += wrapped.length > 1 ? wrapped.length * 4.8 + 3 : 9.5;
  });

  y = divider(doc, y + 2);
  y = secTitle(doc, y, '02  Operational Narrative & Insights', C.teal);

  data.narrativeInsights.forEach((line, i) => {
    const bgColor: [number, number, number] = i % 2 === 0 ? C.slateLight : C.white;
    roundRect(doc, M, y, CW, 12, 1.5, bgColor);
    doc.setFillColor(...C.blue);
    doc.roundedRect(M, y, 3, 12, 1, 1, 'F');
    doc.setTextColor(...C.black);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    const wrapped = doc.splitTextToSize(line, CW - 10);
    doc.text(wrapped, M + 7, y + (12 - wrapped.length * 4.5) / 2 + 4);
    y += wrapped.length > 1 ? wrapped.length * 5 + 6 : 14;
  });

  y = divider(doc, y + 2);
  y = secTitle(doc, y, '03  Management Action Items', C.red);
  y += 1;

  const priorityOrder = ['critical', 'high', 'medium', 'low'];
  const sorted = [...data.actionItems].sort((a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority));
  sorted.forEach((item, i) => {
    const pColor = item.priority === 'critical' ? C.red : item.priority === 'high' ? C.amber : item.priority === 'medium' ? C.blue : C.teal;
    const pBg: [number,number,number] = item.priority === 'critical' ? C.redLight : item.priority === 'high' ? C.amberLight : item.priority === 'medium' ? C.blueLight : C.tealLight;
    const rowH = 16;
    roundRect(doc, M, y, CW, rowH, 2, pBg);
    doc.setFillColor(...pColor);
    doc.roundedRect(M, y, 3.5, rowH, 1, 1, 'F');
    // Priority label
    roundRect(doc, M + 6, y + 3, 18, 6, 1, pColor);
    doc.setTextColor(...C.white);
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.text(item.priority.toUpperCase(), M + 15, y + 7, { align: 'center' });
    // Text
    doc.setTextColor(...C.black);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const wrapped = doc.splitTextToSize(item.text, CW - 35);
    doc.text(wrapped, M + 27, y + 5.5);
    // Owner
    doc.setTextColor(...C.slate);
    doc.setFontSize(6);
    doc.text(`Owner: ${item.owner}  ·  Impact: ${item.impact}`, M + 27, y + rowH - 3);
    y += rowH + 2;
  });

  // ══════════════════════════════════════════════════════
  // PAGE 3 — KPI DASHBOARD
  // ══════════════════════════════════════════════════════
  doc.addPage();
  pg++;
  hdr(doc, 'KPI Dashboard', pg, 'Performance Metrics');
  ftr(doc, data.generatedAt);

  y = 16;
  y = secTitle(doc, y, '04  Key Performance Indicators', C.blue);
  y += 2;

  // Row 1 — 5 cards
  const cw5 = (CW - 8) / 5;
  const ch = 28;
  const row1: Array<{ label: string; kpi: KpiDelta; fmt: string; bg: [number,number,number]; accent: [number,number,number] }> = [
    { label: 'Total Models', kpi: data.kpi.totalModels, fmt: String(data.kpi.totalModels.value), bg: C.blueLight, accent: C.blue },
    { label: 'Total Feedback', kpi: data.kpi.totalFeedback, fmt: String(data.kpi.totalFeedback.value), bg: C.slateLight, accent: C.slate },
    { label: 'Open Issues', kpi: data.kpi.openIssues, fmt: String(data.kpi.openIssues.value), bg: C.amberLight, accent: C.amber },
    { label: 'Resolved', kpi: data.kpi.resolvedIssues, fmt: String(data.kpi.resolvedIssues.value), bg: C.greenLight, accent: C.green },
    { label: 'Critical', kpi: data.kpi.criticalIssues, fmt: String(data.kpi.criticalIssues.value), bg: C.redLight, accent: C.red },
  ];
  row1.forEach((k, i) => kpiCard(doc, M + i * (cw5 + 2), y, cw5, ch, k.label, k.kpi, k.fmt, k.bg, k.accent));
  y += ch + 4;

  // Row 2 — 4 cards
  const cw4 = (CW - 6) / 4;
  const row2: Array<{ label: string; kpi: KpiDelta; fmt: string; bg: [number,number,number]; accent: [number,number,number] }> = [
    { label: 'Avg Fix Hours', kpi: data.kpi.avgFixHours, fmt: data.kpi.avgFixHours.value.toFixed(1) + 'h', bg: C.tealLight, accent: C.teal },
    { label: 'Community Ratings', kpi: data.kpi.totalRatings, fmt: String(data.kpi.totalRatings.value), bg: C.goldLight, accent: C.gold },
    { label: 'Active Users', kpi: data.kpi.activeUsers, fmt: String(data.kpi.activeUsers.value), bg: C.greenLight, accent: C.green },
    { label: 'Pending Approval', kpi: data.kpi.pendingApproval, fmt: String(data.kpi.pendingApproval.value), bg: C.blueLight, accent: C.blue },
  ];
  row2.forEach((k, i) => kpiCard(doc, M + i * (cw4 + 2), y, cw4, ch, k.label, k.kpi, k.fmt, k.bg, k.accent));
  y += ch + 8;

  // Health score + contributors
  y = secTitle(doc, y, '05  Platform Engineering Health Score', C.teal);
  y += 3;

  const gaugeW = 70;
  drawGauge(doc, M + gaugeW / 2, y + 22, 22, hs.score, hsColor);
  doc.setTextColor(...hsColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(String(hs.score) + '/100', M + gaugeW / 2, y + 26, { align: 'center' });
  doc.setTextColor(...C.navy);
  doc.setFontSize(9);
  doc.text(hs.label, M + gaugeW / 2, y + 34, { align: 'center' });

  // Contributors table
  const contX = M + gaugeW + 6;
  const contW = CW - gaugeW - 6;
  doc.setTextColor(...C.muted);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('SCORE CONTRIBUTORS', contX, y + 5);
  hs.contributors.forEach((c, i) => {
    const cy2 = y + 10 + i * 10;
    const dColor = c.delta >= 0 ? C.green : C.red;
    const dBg: [number,number,number] = c.delta >= 0 ? C.greenLight : C.redLight;
    roundRect(doc, contX, cy2, contW, 8, 1.5, dBg);
    doc.setTextColor(...C.black);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(c.label, contX + 3, cy2 + 5);
    doc.setTextColor(...dColor);
    doc.setFontSize(7);
    doc.text((c.delta >= 0 ? '+' : '') + String(c.delta), contX + contW - 3, cy2 + 5, { align: 'right' });
    doc.setTextColor(...C.muted);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(c.description, contX + 3, cy2 + 9 + (8 - 10));
  });
  y += Math.max(48, hs.contributors.length * 10 + 15) + 6;

  // Resolution rate bar
  y = divider(doc, y);
  y = secTitle(doc, y, '06  Resolution Rate', C.green);
  y += 3;
  roundRect(doc, M, y, CW, 10, 2, C.slateLight);
  const rr = data.kpi.resolutionRate;
  const rrColor = rr >= 70 ? C.green : rr >= 40 ? C.blue : C.red;
  roundRect(doc, M, y, (rr / 100) * CW, 10, 2, rrColor);
  doc.setTextColor(...C.white);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`${rr}% of issues resolved or closed`, M + 4, y + 6.5);
  y += 16;

  // Manufacturer risk table
  y = secTitle(doc, y, '07  Manufacturer Risk Overview', C.amber);
  y += 1;
  const mfgCols = [55, 18, 18, 22, 24, 28];
  const mfgHdrs = ['Manufacturer', 'Total', 'Active', 'Open Issues', 'Critical', 'Risk Score'];
  roundRect(doc, M, y, CW, 7, 0, C.navy);
  doc.setTextColor(...C.white);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  let cx2 = M + 2;
  mfgHdrs.forEach((h, i) => { doc.text(h, cx2, y + 4.8); cx2 += mfgCols[i]; });
  y += 7;
  data.manufacturerCounts.slice(0, 8).forEach((m, idx) => {
    const rowBg: [number,number,number] = idx % 2 === 0 ? C.slateLight : C.white;
    roundRect(doc, M, y, CW, 6.5, 0, rowBg);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    cx2 = M + 2;
    const cells = [m.manufacturer.slice(0, 28), String(m.total), String(m.active), String(m.openIssues), String(m.criticalIssues), `${m.riskScore}%`];
    cells.forEach((c, i) => {
      if (i === 3 && m.openIssues > 0) doc.setTextColor(...C.amber);
      else if (i === 4 && m.criticalIssues > 0) doc.setTextColor(...C.red);
      else if (i === 5) {
        const rc = m.riskScore > 60 ? C.red : m.riskScore > 30 ? C.amber : C.green;
        doc.setTextColor(...rc);
      } else doc.setTextColor(...C.black);
      doc.text(c, cx2, y + 4.5);
      cx2 += mfgCols[i];
    });
    y += 6.5;
  });

  // ══════════════════════════════════════════════════════
  // PAGE 4 — CHARTS
  // ══════════════════════════════════════════════════════
  doc.addPage();
  pg++;
  hdr(doc, 'Analytics & Trends', pg, 'Executive Charts');
  ftr(doc, data.generatedAt);

  y = 16;
  y = secTitle(doc, y, '08  Feedback & Community Engagement Trend (6 Months)', C.blue);
  y += 3;

  lineChart(
    doc, M + 8, y, CW - 8, 40,
    [
      { label: 'Total Feedback', values: data.monthlyTrend.map(m => m.total), color: C.blue },
      { label: 'Resolved', values: data.monthlyTrend.map(m => m.resolved), color: C.green, dashed: true },
      { label: 'Ratings', values: data.monthlyTrend.map(m => m.ratings), color: C.gold, dashed: true },
    ],
    data.monthlyTrend.map(m => m.month)
  );
  // Legend
  const legendItems = [
    { label: 'Total Feedback', color: C.blue },
    { label: 'Resolved', color: C.green },
    { label: 'Community Ratings', color: C.gold },
  ];
  legendItems.forEach((l, i) => {
    const lx = M + 8 + i * 62;
    const ly = y + 48;
    roundRect(doc, lx, ly, 10, 3.5, 1, l.color);
    doc.setTextColor(...C.slate);
    doc.setFontSize(6.5);
    doc.text(l.label, lx + 12, ly + 3);
  });
  y += 58;

  // Two charts side by side
  const half = (CW - 6) / 2;

  // Severity donut
  y = secTitle(doc, y, '09  Issues by Severity', C.navy);
  const donutY = y;
  const sevData = [
    { label: 'Critical', value: data.severityCounts[0].count, color: C.red },
    { label: 'High',     value: data.severityCounts[1].count, color: C.amber },
    { label: 'Medium',   value: data.severityCounts[2].count, color: C.blue },
    { label: 'Low',      value: data.severityCounts[3].count, color: C.teal },
  ];
  donut(doc, M + half / 2, donutY + 22, 18, sevData);
  sevData.forEach((s, i) => {
    const lx = M + half + 4;
    const ly = donutY + 8 + i * 9;
    roundRect(doc, lx, ly, 5, 4.5, 1, s.color);
    doc.setTextColor(...C.slate);
    doc.setFontSize(7);
    doc.text(`${s.label}: ${s.value} (${data.severityCounts[i].pct}%)`, lx + 7, ly + 3.5);
  });

  // Rating distribution
  const ratingX = M + half + 6;
  y = secTitle(doc, donutY + half / 3, '10  Quality Grade Distribution', C.gold);
  const ratingColors: [number, number, number][] = [C.green, C.teal, C.blue, C.amber, C.red];
  const maxR = Math.max(...data.ratingDist.map(r => r.count), 1);
  data.ratingDist.forEach((r, i) => {
    const by = y + i * 8;
    const bw = (r.count / maxR) * (half - 22);
    doc.setTextColor(...C.slate);
    doc.setFontSize(7);
    doc.text(r.grade, ratingX, by + 5.5);
    roundRect(doc, ratingX + 10, by, half - 22, 6, 1, C.slateLight);
    if (bw > 0) roundRect(doc, ratingX + 10, by, bw, 6, 1, ratingColors[i]);
    doc.setTextColor(...C.muted);
    doc.setFontSize(6);
    doc.text(`${r.count} (${r.pct}%)`, ratingX + half - 10, by + 4.5, { align: 'right' });
  });

  y = donutY + 50;

  // Models by manufacturer
  y = secTitle(doc, y, '11  Relay Models by Manufacturer', C.teal);
  y += 2;
  const maxMfg = Math.max(...data.manufacturerCounts.map(m => m.total), 1);
  hBar(
    doc, M, y, CW - 6, maxMfg,
    data.manufacturerCounts.slice(0, 10).map((m, i) => ({
      label: m.manufacturer,
      value: m.total,
      value2: m.active,
      color: i % 2 === 0 ? C.blue : C.teal,
      color2: i % 2 === 0 ? C.teal : C.green,
    })),
    8
  );
  y += 10 * 8 + 8;

  // Workload forecast
  y = secTitle(doc, y, '12  Engineering Workload Forecast', C.amber);
  y += 3;
  const allForecastVals = data.workloadForecast.flatMap(f => [f.actual, f.projected]);
  lineChart(
    doc, M + 8, y, CW - 8, 30,
    [
      { label: 'Actual Hours', values: data.workloadForecast.map(f => f.actual), color: C.blue },
      { label: 'Projected Hours', values: data.workloadForecast.map(f => f.projected), color: C.amber, dashed: true },
    ],
    data.workloadForecast.map(f => f.month)
  );
  // Note
  doc.setTextColor(...C.muted);
  doc.setFontSize(6);
  doc.text('* Projected values based on recent trend extrapolation. Actual results may vary.', M + 8, y + 37);
  y += 45;

  // ══════════════════════════════════════════════════════
  // PAGE 5 — ENGINEERING ANALYSIS
  // ══════════════════════════════════════════════════════
  doc.addPage();
  pg++;
  hdr(doc, 'Engineering Analysis', pg, 'Risk & Model Intelligence');
  ftr(doc, data.generatedAt);

  y = 16;
  y = secTitle(doc, y, '13  Relay Family Risk Matrix', C.red);
  y += 2;

  // Risk matrix table
  const fCols = [50, 18, 18, 20, 18, 20, 22];
  const fHdrs = ['Relay Family', 'Critical', 'High', 'Medium', 'Low', 'Total', 'Risk Score'];
  roundRect(doc, M, y, CW, 7, 0, C.navy);
  doc.setTextColor(...C.white);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  cx2 = M + 2;
  fHdrs.forEach((h, i) => { doc.text(h, cx2, y + 4.8); cx2 += fCols[i]; });
  y += 7;

  data.familyRiskMatrix.forEach((f, idx) => {
    const rowBg: [number,number,number] = idx % 2 === 0 ? C.slateLight : C.white;
    roundRect(doc, M, y, CW, 7, 0, rowBg);
    // Risk colour stripe
    const rColor = f.riskScore > 60 ? C.red : f.riskScore > 30 ? C.amber : C.green;
    doc.setFillColor(...rColor);
    doc.rect(M, y, 2, 7, 'F');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    cx2 = M + 2;
    const cells = [f.family.slice(0, 26), String(f.critical), String(f.high), String(f.medium), String(f.low), String(f.total), String(f.riskScore)];
    cells.forEach((c, i) => {
      if (i === 1 && f.critical > 0) doc.setTextColor(...C.red);
      else if (i === 2 && f.high > 0) doc.setTextColor(...C.amber);
      else if (i === 6) doc.setTextColor(...rColor);
      else doc.setTextColor(...C.black);
      doc.text(c, cx2, y + 4.8);
      cx2 += fCols[i];
    });
    y += 7;
  });
  y += 6;

  y = secTitle(doc, y, '14  Top Risk Templates — Ranked by Engineering Priority', C.red);
  y += 2;

  const pCols = [50, 32, 20, 22, 20, 20, 22];
  const pHdrs = ['Model Name', 'Manufacturer', 'Family', 'Open', 'Critical', 'Hours', 'Risk'];
  roundRect(doc, M, y, CW, 7, 0, C.navy);
  doc.setTextColor(...C.white);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  cx2 = M + 2;
  pHdrs.forEach((h, i) => { doc.text(h, cx2, y + 4.8); cx2 += pCols[i]; });
  y += 7;

  data.problematicModels.forEach((m, idx) => {
    const rowBg: [number,number,number] = idx % 2 === 0 ? C.slateLight : C.white;
    roundRect(doc, M, y, CW, 7, 0, rowBg);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    cx2 = M + 2;
    const cells = [m.model_name.slice(0, 28), m.manufacturer.slice(0, 18), m.relay_family.slice(0, 12), String(m.open_issues), String(m.critical_issues), String(m.total_hours) + 'h', ''];
    cells.forEach((c, i) => {
      if (i === 3 && m.open_issues > 0) doc.setTextColor(...C.amber);
      else if (i === 4 && m.critical_issues > 0) doc.setTextColor(...C.red);
      else doc.setTextColor(...C.black);
      doc.text(c, cx2, y + 4.8);
      cx2 += pCols[i];
    });
    // Risk badge
    riskBadge(doc, M + pCols.slice(0, 6).reduce((a, b) => a + b, 0) + 2, y + 4.8, m.risk_label);
    y += 7;
  });
  y += 6;

  y = secTitle(doc, y, '15  Top Community-Reviewed Models', C.blue);
  y += 2;

  const tCols = [55, 35, 20, 22, 30, 18];
  const tHdrs = ['Model Name', 'Manufacturer', 'Ratings', 'Quality', 'Popularity', 'Status'];
  roundRect(doc, M, y, CW, 7, 0, C.blue);
  doc.setTextColor(...C.white);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  cx2 = M + 2;
  tHdrs.forEach((h, i) => { doc.text(h, cx2, y + 4.8); cx2 += tCols[i]; });
  y += 7;

  data.topRatedModels.forEach((m, idx) => {
    const rowBg: [number,number,number] = idx % 2 === 0 ? C.slateLight : C.white;
    roundRect(doc, M, y, CW, 6.5, 0, rowBg);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    cx2 = M + 2;
    const cells = [m.model_name.slice(0, 30), m.manufacturer.slice(0, 20), String(m.rating_count), m.quality_grade, m.popularity_grade, ''];
    cells.forEach((c, i) => {
      const isGrade = i === 3 || i === 4;
      if (isGrade && c === 'A+') doc.setTextColor(...C.green);
      else if (isGrade && c === 'A') doc.setTextColor(...C.teal);
      else if (isGrade && c === 'B') doc.setTextColor(...C.blue);
      else if (isGrade && (c === 'C' || c === 'D')) doc.setTextColor(...C.amber);
      else doc.setTextColor(...C.black);
      doc.text(c, cx2, y + 4.5);
      cx2 += tCols[i];
    });
    y += 6.5;
  });

  // ══════════════════════════════════════════════════════
  // PAGE 6+ — APPENDIX
  // ══════════════════════════════════════════════════════
  doc.addPage();
  pg++;
  hdr(doc, 'Appendix — Detailed Issue Register', pg, 'Full Feedback Listing');
  ftr(doc, data.generatedAt);

  y = 16;
  y = secTitle(doc, y, '16  Detailed Feedback Register', C.slate);
  y += 2;

  const aCols = [58, 30, 20, 22, 22, 24, 8];
  const aHdrs = ['Issue Title', 'Model', 'Severity', 'Status', 'Family', 'Submitter', 'h'];
  roundRect(doc, M, y, CW, 7, 0, C.slate);
  doc.setTextColor(...C.white);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  cx2 = M + 2;
  aHdrs.forEach((h, i) => { doc.text(h, cx2, y + 4.8); cx2 += aCols[i]; });
  y += 7;

  const sevColors: Record<string, [number, number, number]> = {
    critical: C.red, high: C.amber, medium: C.blue, low: C.teal,
  };
  const statusColors: Record<string, [number, number, number]> = {
    open: C.amber, in_progress: C.blue, resolved: C.green, closed: C.slate,
  };

  data.appendixFeedback.forEach((f, idx) => {
    if (y > H - 20) {
      doc.addPage();
      pg++;
      hdr(doc, 'Appendix (continued)', pg, 'Detailed Issue Register');
      ftr(doc, data.generatedAt);
      y = 16;
      roundRect(doc, M, y, CW, 7, 0, C.slate);
      doc.setTextColor(...C.white);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      cx2 = M + 2;
      aHdrs.forEach((h, i) => { doc.text(h, cx2, y + 4.8); cx2 += aCols[i]; });
      y += 7;
    }

    const rowBg: [number,number,number] = idx % 2 === 0 ? C.slateLight : C.white;
    roundRect(doc, M, y, CW, 6, 0, rowBg);

    // Severity left stripe
    const sc = sevColors[f.severity] || C.slate;
    doc.setFillColor(...sc);
    doc.rect(M, y, 1.5, 6, 'F');

    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    cx2 = M + 2;
    const cells = [
      f.title.slice(0, 36),
      f.model.slice(0, 18),
      f.severity,
      f.status.replace('_', ' '),
      f.family.slice(0, 14),
      f.submitter.slice(0, 16),
      String(f.hours),
    ];
    cells.forEach((c, i) => {
      if (i === 2) doc.setTextColor(...(sevColors[f.severity] || C.slate));
      else if (i === 3) doc.setTextColor(...(statusColors[f.status] || C.slate));
      else doc.setTextColor(...C.black);
      doc.text(c, cx2, y + 4);
      cx2 += aCols[i];
    });
    y += 6;
  });

  // End note
  y += 4;
  doc.setTextColor(...C.muted);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total entries shown: ${data.appendixFeedback.length}  ·  Report generated from live database data.`, M, y);

  doc.save(filename);
}
