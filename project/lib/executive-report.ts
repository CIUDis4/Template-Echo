import { supabase } from './supabase';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export interface ExecReportFilters {
  dateFrom: string;
  dateTo: string;
  manufacturer: string;
  severity: string;
  relayFamily: string;
  statusFilter: 'all' | 'open' | 'closed';
  ratingsFilter: 'all' | 'community' | 'official';
  reportMode: 'full' | 'executive' | 'snapshot' | 'kpi' | 'workload';
}

export interface ManufacturerCount {
  manufacturer: string;
  total: number;
  active: number;
  deprecated: number;
  review: number;
  openIssues: number;
  criticalIssues: number;
  riskScore: number;
}

export interface SeverityCount {
  severity: string;
  count: number;
  pct: number;
}

export interface MonthlyTrend {
  month: string;
  open: number;
  resolved: number;
  total: number;
  ratings: number;
}

export interface RatingDist {
  grade: string;
  count: number;
  pct: number;
}

export interface ProblematicModel {
  model_name: string;
  manufacturer: string;
  relay_family: string;
  open_issues: number;
  critical_issues: number;
  total_hours: number;
  risk_score: number;
  risk_label: 'Critical' | 'High' | 'Medium' | 'Low';
}

export interface TopRatedModel {
  model_name: string;
  manufacturer: string;
  rating_count: number;
  quality_grade: string;
  popularity_grade: string;
}

export interface MostUsedTemplate {
  model_name: string;
  manufacturer: string;
  relay_family: string;
  usage_count: number;
  quality_grade: string;
  popularity_grade: string;
}

export interface ActionItem {
  priority: 'critical' | 'high' | 'medium' | 'low';
  text: string;
  impact: string;
  owner: string;
}

export interface HealthScore {
  label: 'Excellent' | 'Good' | 'Needs Attention' | 'Critical';
  score: number;
  color: string;
  contributors: Array<{ label: string; delta: number; description: string }>;
}

export interface KpiDelta {
  value: number;
  delta: number | null;
  trend: 'up' | 'down' | 'neutral';
  trendPositive: boolean;
}

export interface FamilyRiskRow {
  family: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  riskScore: number;
}

export interface WorkloadForecast {
  month: string;
  actual: number;
  projected: number;
}

export interface ExecReportData {
  generatedAt: string;
  generatedBy: string;
  reportVersion: string;
  filters: ExecReportFilters;
  kpi: {
    totalModels: KpiDelta;
    totalFeedback: KpiDelta;
    openIssues: KpiDelta;
    resolvedIssues: KpiDelta;
    criticalIssues: KpiDelta;
    avgFixHours: KpiDelta;
    totalRatings: KpiDelta;
    activeUsers: KpiDelta;
    pendingApproval: KpiDelta;
    manufacturers: number;
    inProgressIssues: number;
    resolutionRate: number;
  };
  manufacturerCounts: ManufacturerCount[];
  severityCounts: SeverityCount[];
  monthlyTrend: MonthlyTrend[];
  ratingDist: RatingDist[];
  problematicModels: ProblematicModel[];
  topRatedModels: TopRatedModel[];
  mostUsedTemplates: MostUsedTemplate[];
  familyRiskMatrix: FamilyRiskRow[];
  workloadForecast: WorkloadForecast[];
  healthScore: HealthScore;
  actionItems: ActionItem[];
  executiveSummary: string[];
  narrativeInsights: string[];
  appendixFeedback: Array<{
    title: string;
    model: string;
    family: string;
    severity: string;
    status: string;
    submitter: string;
    hours: number;
    date: string;
  }>;
}

function computeHealthScore(
  openIssues: number,
  criticalIssues: number,
  totalFeedback: number,
  pendingApproval: number,
  totalModels: number,
  totalRatings: number
): HealthScore {
  const contributors: HealthScore['contributors'] = [];
  let score = 100;

  // Open issue burden
  const openRate = totalFeedback > 0 ? openIssues / totalFeedback : 0;
  const openDelta = -Math.round(openRate * 35);
  score += openDelta;
  contributors.push({ label: 'Open Issue Burden', delta: openDelta, description: `${openIssues} unresolved of ${totalFeedback} total` });

  // Critical severity
  const critDelta = -Math.min(Math.round(criticalIssues * 4), 25);
  score += critDelta;
  contributors.push({ label: 'Critical Severity Risk', delta: critDelta, description: `${criticalIssues} critical issue${criticalIssues !== 1 ? 's' : ''} outstanding` });

  // Pending approvals
  const pendRate = totalModels > 0 ? pendingApproval / totalModels : 0;
  const pendDelta = -Math.round(pendRate * 15);
  score += pendDelta;
  contributors.push({ label: 'Grade Approval Backlog', delta: pendDelta, description: `${pendingApproval} model${pendingApproval !== 1 ? 's' : ''} awaiting grade` });

  // Community engagement bonus
  const engagementBonus = totalRatings > 20 ? 5 : totalRatings > 5 ? 2 : 0;
  if (engagementBonus > 0) {
    score += engagementBonus;
    contributors.push({ label: 'Community Engagement', delta: engagementBonus, description: `${totalRatings} community ratings submitted` });
  }

  score = Math.max(0, Math.min(100, score));

  if (score >= 80) return { label: 'Excellent', score: Math.round(score), color: '#16a34a', contributors };
  if (score >= 60) return { label: 'Good', score: Math.round(score), color: '#2563eb', contributors };
  if (score >= 40) return { label: 'Needs Attention', score: Math.round(score), color: '#d97706', contributors };
  return { label: 'Critical', score: Math.round(score), color: '#dc2626', contributors };
}

function generateActionItems(
  kpi: ExecReportData['kpi'],
  problematic: ProblematicModel[],
  familyRisk: FamilyRiskRow[],
  mfg: ManufacturerCount[]
): ActionItem[] {
  const items: ActionItem[] = [];
  const rawOpen = kpi.openIssues.value;
  const rawCrit = kpi.criticalIssues.value;
  const rawPend = kpi.pendingApproval.value;

  if (rawCrit > 0) {
    const worstFamily = familyRisk[0];
    items.push({
      priority: 'critical',
      text: `${rawCrit} critical-severity issue${rawCrit > 1 ? 's are' : ' is'} currently open${worstFamily ? ` — ${worstFamily.family} relay family accounts for the highest risk concentration` : ''}.`,
      impact: 'Direct risk to template reliability and customer confidence',
      owner: 'Engineering Lead',
    });
  }

  if (problematic.length > 0) {
    const top = problematic[0];
    items.push({
      priority: 'high',
      text: `${top.model_name} (${top.manufacturer}) has ${top.open_issues} open issues with an estimated ${top.total_hours}h engineering effort to resolve.`,
      impact: 'High engineering resource commitment required',
      owner: 'Relay Engineering Team',
    });
  }

  if (rawPend > 0) {
    items.push({
      priority: 'high',
      text: `${rawPend} relay model${rawPend > 1 ? 's have' : ' has'} community ratings awaiting official admin grade approval. Delays reduce data integrity.`,
      impact: 'Community trust and data accuracy',
      owner: 'Admin / Grading Team',
    });
  }

  const highRiskMfg = mfg.filter(m => m.riskScore > 60);
  if (highRiskMfg.length > 0) {
    items.push({
      priority: 'medium',
      text: `${highRiskMfg.map(m => m.manufacturer).join(', ')} ${highRiskMfg.length > 1 ? 'show' : 'shows'} elevated engineering risk. Schedule targeted triage sessions.`,
      impact: 'Concentrated risk in specific manufacturer portfolios',
      owner: 'Engineering Management',
    });
  }

  if (rawOpen > 15) {
    items.push({
      priority: 'medium',
      text: `Open issue backlog has reached ${rawOpen}. Recommend scheduling a dedicated engineering sprint to reduce backlog below 10.`,
      impact: 'Operational efficiency and reporting health score',
      owner: 'Project Manager',
    });
  }

  if (kpi.avgFixHours.value > 24) {
    items.push({
      priority: 'medium',
      text: `Average estimated fix time is ${kpi.avgFixHours.value.toFixed(1)}h per issue — above the 24h benchmark. Evaluate complexity distribution and consider issue decomposition.`,
      impact: 'Engineering throughput and sprint planning',
      owner: 'Engineering Lead',
    });
  }

  items.push({
    priority: 'low',
    text: 'Review deprecated relay models for archival or re-certification. Maintaining clean model inventory improves platform analytics accuracy.',
    impact: 'Data hygiene and platform performance',
    owner: 'Admin',
  });

  return items.slice(0, 7);
}

function generateNarrative(
  kpi: ExecReportData['kpi'],
  trend: MonthlyTrend[],
  familyRisk: FamilyRiskRow[],
  mfg: ManufacturerCount[],
  health: HealthScore
): string[] {
  const lines: string[] = [];
  const rawOpen = kpi.openIssues.value;
  const rawCrit = kpi.criticalIssues.value;
  const rawTotal = kpi.totalFeedback.value;
  const rawResolved = kpi.resolvedIssues.value;
  const rawRatings = kpi.totalRatings.value;

  // Stability statement
  if (rawCrit === 0 && rawOpen < 5) {
    lines.push('Template quality stability remains healthy with no critical engineering risks identified in the current reporting period.');
  } else if (rawCrit > 0) {
    lines.push(`Engineering risk is elevated: ${rawCrit} critical-severity issue${rawCrit > 1 ? 's are' : ' is'} outstanding and require immediate management attention.`);
  } else {
    lines.push(`${rawOpen} open issues remain in the engineering backlog. Prioritised resolution is recommended to maintain platform quality scores.`);
  }

  // Trend analysis
  if (trend.length >= 2) {
    const last = trend[trend.length - 1];
    const prev = trend[trend.length - 2];
    if (prev.total > 0) {
      const pct = Math.round(((last.total - prev.total) / prev.total) * 100);
      const dir = pct > 0 ? 'increased' : pct < 0 ? 'decreased' : 'remained stable';
      const pctStr = pct !== 0 ? ` by ${Math.abs(pct)}%` : '';
      lines.push(`Feedback submission volume ${dir}${pctStr} month-over-month (${last.total} vs ${prev.total}), indicating ${pct > 10 ? 'growing' : pct < -10 ? 'declining' : 'steady'} platform engagement.`);
    }
    const ratingLast = last.ratings;
    const ratingPrev = prev.ratings;
    if (ratingPrev > 0 && ratingLast !== ratingPrev) {
      const rPct = Math.round(((ratingLast - ratingPrev) / ratingPrev) * 100);
      lines.push(`Community engagement ${rPct > 0 ? `increased ${rPct}%` : `decreased ${Math.abs(rPct)}%`} compared to the prior month (${ratingLast} vs ${ratingPrev} ratings submitted).`);
    }
  }

  // Resolution rate
  if (rawTotal > 0) {
    const rate = Math.round((rawResolved / rawTotal) * 100);
    if (rate >= 70) {
      lines.push(`Issue resolution rate is strong at ${rate}% — ${rawResolved} of ${rawTotal} feedback entries have been resolved or closed.`);
    } else if (rate >= 40) {
      lines.push(`Issue resolution rate stands at ${rate}% (${rawResolved} of ${rawTotal}). Increasing engineering velocity would improve this metric toward the 70% target.`);
    } else {
      lines.push(`Issue resolution rate is below target at ${rate}% (${rawResolved} of ${rawTotal}). Immediate engineering resource allocation is recommended.`);
    }
  }

  // Family risk concentration
  if (familyRisk.length > 0 && familyRisk[0].riskScore > 30) {
    const top2 = familyRisk.slice(0, 2);
    const totalRisk = familyRisk.reduce((s, f) => s + f.riskScore, 0);
    const top2Risk = top2.reduce((s, f) => s + f.riskScore, 0);
    const pct = totalRisk > 0 ? Math.round((top2Risk / totalRisk) * 100) : 0;
    lines.push(`${top2.map(f => f.family).join(' and ')} relay families account for approximately ${pct}% of total engineering workload — indicating concentrated risk in these product lines.`);
  }

  // Manufacturer landscape
  if (mfg.length > 0) {
    const topMfg = mfg[0];
    lines.push(`${topMfg.manufacturer} represents the largest manufacturer portfolio with ${topMfg.total} tracked models (${topMfg.active} active, ${topMfg.deprecated} deprecated).`);
  }

  // Ratings and grades
  if (rawRatings > 0) {
    lines.push(`${rawRatings} community rating${rawRatings !== 1 ? 's have' : ' has'} been submitted by ${kpi.activeUsers.value} active platform user${kpi.activeUsers.value !== 1 ? 's' : ''}. ${kpi.pendingApproval.value > 0 ? `${kpi.pendingApproval.value} model${kpi.pendingApproval.value !== 1 ? 's' : ''} still await official grade assignment.` : 'All rated models have received official grade assignments.'}`);
  }

  return lines;
}

function generateExecutiveSummary(
  kpi: ExecReportData['kpi'],
  health: HealthScore,
  trend: MonthlyTrend[]
): string[] {
  const lines: string[] = [];
  const rawOpen = kpi.openIssues.value;
  const rawCrit = kpi.criticalIssues.value;
  const rawTotal = kpi.totalFeedback.value;
  const rawResolved = kpi.resolvedIssues.value;

  lines.push(`${kpi.totalModels.value} relay models tracked across ${kpi.manufacturers} manufacturer${kpi.manufacturers !== 1 ? 's' : ''}.`);

  if (trend.length >= 2) {
    const last = trend[trend.length - 1];
    const prev = trend[trend.length - 2];
    if (prev.total > 0) {
      const pct = Math.round(((last.total - prev.total) / prev.total) * 100);
      const dir = pct >= 0 ? `increased ${pct}%` : `decreased ${Math.abs(pct)}%`;
      lines.push(`Feedback volume ${dir} month-over-month (${last.total} vs ${prev.total}).`);
    }
  }

  if (rawCrit > 0) {
    lines.push(`${rawCrit} critical-severity issue${rawCrit > 1 ? 's require' : ' requires'} urgent engineering attention.`);
  } else {
    lines.push('No critical-severity issues outstanding — platform stability is healthy.');
  }

  const rate = rawTotal > 0 ? Math.round((rawResolved / rawTotal) * 100) : 0;
  lines.push(`Resolution rate: ${rate}% (${rawResolved} of ${rawTotal} entries resolved or closed).`);

  lines.push(`${kpi.totalRatings.value} community rating${kpi.totalRatings.value !== 1 ? 's' : ''} submitted. ${kpi.pendingApproval.value} model${kpi.pendingApproval.value !== 1 ? 's' : ''} pending grade approval.`);

  lines.push(`Platform Engineering Health Score: ${health.label} — ${health.score}/100.`);

  return lines;
}

function kpiDelta(current: number, prev: number, lowerIsBetter = false): KpiDelta {
  const delta = prev > 0 ? current - prev : null;
  const trend: KpiDelta['trend'] = delta === null ? 'neutral' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
  const trendPositive = lowerIsBetter ? trend === 'down' : trend === 'up';
  return { value: current, delta, trend, trendPositive };
}

export async function fetchExecReportData(filters: ExecReportFilters, generatedBy: string): Promise<ExecReportData> {
  const [modelsRes, feedbackRes, ratingsRes, profilesRes, usagesRes] = await Promise.all([
    supabase.from('relay_models').select('id, model_name, manufacturer, relay_family, status, official_quality_grade, official_popularity_grade'),
    supabase.from('feedback_entries').select('id, title, severity, status, estimated_fix_hours, created_at, updated_at, relay_model_id, user_id, relay_models(model_name, manufacturer, relay_family), profiles(full_name, email)'),
    supabase.from('relay_model_ratings').select('id, relay_model_id, quality_grade, popularity_grade, is_flagged, created_at'),
    supabase.from('profiles').select('id, full_name, email, active'),
    supabase.from('template_usages').select('relay_model_id, user_id, count'),
  ]);

  const allModels = modelsRes.data || [];
  let allFeedback = (feedbackRes.data || []) as any[];
  const allRatings = ratingsRes.data || [];
  const allProfiles = profilesRes.data || [];
  const allUsages = (usagesRes.data || []) as Array<{ relay_model_id: string; user_id: string; count: number }>;

  // Previous period feedback for delta calculation (prior 6m)
  const now = new Date();
  const curStart = subMonths(now, 6);
  const prevStart = subMonths(now, 12);
  const prevEnd = subMonths(now, 6);

  const prevFeedback = allFeedback.filter((f: any) => {
    const d = new Date(f.created_at);
    return d >= prevStart && d < prevEnd;
  });
  const curFeedback = allFeedback.filter((f: any) => {
    const d = new Date(f.created_at);
    return d >= curStart;
  });

  // Apply filters
  let filtered = [...allFeedback];
  if (filters.dateFrom) filtered = filtered.filter(f => f.created_at >= filters.dateFrom);
  if (filters.dateTo) filtered = filtered.filter(f => f.created_at <= filters.dateTo + 'T23:59:59');
  if (filters.manufacturer) filtered = filtered.filter(f => (f.relay_models as any)?.manufacturer === filters.manufacturer);
  if (filters.severity) filtered = filtered.filter(f => f.severity === filters.severity);
  if (filters.statusFilter === 'open') filtered = filtered.filter(f => ['open', 'in_progress'].includes(f.status));
  if (filters.statusFilter === 'closed') filtered = filtered.filter(f => ['resolved', 'closed'].includes(f.status));

  const filteredModels = filters.manufacturer
    ? allModels.filter(m => m.manufacturer === filters.manufacturer)
    : allModels;

  const openIssues = filtered.filter(f => ['open', 'in_progress'].includes(f.status));
  const resolvedIssues = filtered.filter(f => ['resolved', 'closed'].includes(f.status));
  const criticalIssues = filtered.filter(f => f.severity === 'critical');
  const inProgressIssues = filtered.filter(f => f.status === 'in_progress');
  const hours = filtered.map(f => f.estimated_fix_hours || 0);
  const avgFixHours = hours.length > 0 ? hours.reduce((a: number, b: number) => a + b, 0) / hours.length : 0;
  const unflaggedRatings = allRatings.filter(r => !r.is_flagged);
  const activeUsers = allProfiles.filter(p => p.active).length;
  const manufacturers = new Set(filteredModels.map(m => m.manufacturer)).size;

  const raterCounts = new Map<string, number>();
  unflaggedRatings.forEach(r => raterCounts.set(r.relay_model_id, (raterCounts.get(r.relay_model_id) || 0) + 1));
  const pendingApproval = filteredModels.filter(m =>
    (raterCounts.get(m.id) || 0) > 0 && (m.official_quality_grade === 'N/A' || m.official_popularity_grade === 'N/A')
  ).length;

  // Previous period deltas
  const prevOpen = prevFeedback.filter((f: any) => ['open', 'in_progress'].includes(f.status)).length;
  const prevResolved = prevFeedback.filter((f: any) => ['resolved', 'closed'].includes(f.status)).length;
  const prevCritical = prevFeedback.filter((f: any) => f.severity === 'critical').length;
  const prevHours = prevFeedback.map((f: any) => f.estimated_fix_hours || 0);
  const prevAvgHours = prevHours.length > 0 ? prevHours.reduce((a: number, b: number) => a + b, 0) / prevHours.length : 0;
  const prevRatings = allRatings.filter(r => {
    const d = new Date(r.created_at);
    return d >= prevStart && d < prevEnd;
  }).length;

  const kpi = {
    totalModels: kpiDelta(filteredModels.length, 0),
    totalFeedback: kpiDelta(filtered.length, prevFeedback.length),
    openIssues: kpiDelta(openIssues.length, prevOpen, true),
    resolvedIssues: kpiDelta(resolvedIssues.length, prevResolved),
    criticalIssues: kpiDelta(criticalIssues.length, prevCritical, true),
    avgFixHours: kpiDelta(avgFixHours, prevAvgHours, true),
    totalRatings: kpiDelta(unflaggedRatings.length, prevRatings),
    activeUsers: kpiDelta(activeUsers, 0),
    pendingApproval: kpiDelta(pendingApproval, 0, true),
    manufacturers,
    inProgressIssues: inProgressIssues.length,
    resolutionRate: filtered.length > 0 ? Math.round((resolvedIssues.length / filtered.length) * 100) : 0,
  };

  // Manufacturer breakdown with risk scores
  const mfgIssueMap = new Map<string, { open: number; critical: number }>();
  filtered.forEach((f: any) => {
    const m = f.relay_models?.manufacturer;
    if (!m) return;
    const e = mfgIssueMap.get(m) || { open: 0, critical: 0 };
    if (['open', 'in_progress'].includes(f.status)) e.open++;
    if (f.severity === 'critical') e.critical++;
    mfgIssueMap.set(m, e);
  });

  const mfgMap = new Map<string, ManufacturerCount>();
  filteredModels.forEach(m => {
    const e = mfgMap.get(m.manufacturer) || { manufacturer: m.manufacturer, total: 0, active: 0, deprecated: 0, review: 0, openIssues: 0, criticalIssues: 0, riskScore: 0 };
    e.total++;
    if (m.status === 'active') e.active++;
    else if (m.status === 'deprecated') e.deprecated++;
    else if (m.status === 'review') e.review++;
    mfgMap.set(m.manufacturer, e);
  });
  mfgIssueMap.forEach((issues, mfg) => {
    const e = mfgMap.get(mfg);
    if (e) {
      e.openIssues = issues.open;
      e.criticalIssues = issues.critical;
      e.riskScore = Math.min(100, issues.open * 5 + issues.critical * 15);
    }
  });
  const manufacturerCounts = Array.from(mfgMap.values()).sort((a, b) => b.total - a.total).slice(0, 15);

  // Severity distribution with pct
  const sevMap = new Map<string, number>();
  filtered.forEach(f => sevMap.set(f.severity, (sevMap.get(f.severity) || 0) + 1));
  const totalSev = filtered.length || 1;
  const severityCounts: SeverityCount[] = ['critical', 'high', 'medium', 'low'].map(s => {
    const count = sevMap.get(s) || 0;
    return { severity: s, count, pct: Math.round((count / totalSev) * 100) };
  });

  // Monthly trend (last 6 months) with ratings
  const monthlyTrend: MonthlyTrend[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    const start = format(startOfMonth(d), 'yyyy-MM-dd');
    const end = format(endOfMonth(d), 'yyyy-MM-dd');
    const mFeedback = allFeedback.filter((f: any) => f.created_at >= start && f.created_at <= end + 'T23:59:59');
    const mRatings = allRatings.filter((r: any) => r.created_at >= start && r.created_at <= end + 'T23:59:59');
    monthlyTrend.push({
      month: format(d, 'MMM yy'),
      total: mFeedback.length,
      open: mFeedback.filter((f: any) => ['open', 'in_progress'].includes(f.status)).length,
      resolved: mFeedback.filter((f: any) => ['resolved', 'closed'].includes(f.status)).length,
      ratings: mRatings.length,
    });
  }

  // Rating distribution with pct
  const gradeMap = new Map<string, number>();
  unflaggedRatings.forEach(r => {
    if (r.quality_grade) gradeMap.set(r.quality_grade, (gradeMap.get(r.quality_grade) || 0) + 1);
  });
  const totalRatingCount = unflaggedRatings.length || 1;
  const ratingDist: RatingDist[] = ['A+', 'A', 'B', 'C', 'D'].map(g => {
    const count = gradeMap.get(g) || 0;
    return { grade: g, count, pct: Math.round((count / totalRatingCount) * 100) };
  });

  // Most problematic models with risk scores
  const modelIssues = new Map<string, { model_name: string; manufacturer: string; relay_family: string; open: number; critical: number; hours: number }>();
  filtered.forEach((f: any) => {
    if (!f.relay_models) return;
    const key = f.relay_model_id;
    const e = modelIssues.get(key) || { model_name: f.relay_models.model_name, manufacturer: f.relay_models.manufacturer, relay_family: f.relay_models.relay_family || '', open: 0, critical: 0, hours: 0 };
    if (['open', 'in_progress'].includes(f.status)) e.open++;
    if (f.severity === 'critical') e.critical++;
    e.hours += f.estimated_fix_hours || 0;
    modelIssues.set(key, e);
  });

  const problematicModels: ProblematicModel[] = Array.from(modelIssues.values())
    .map(m => {
      const riskScore = m.open * 10 + m.critical * 25;
      const risk_label: ProblematicModel['risk_label'] = riskScore >= 75 ? 'Critical' : riskScore >= 40 ? 'High' : riskScore >= 20 ? 'Medium' : 'Low';
      return { model_name: m.model_name, manufacturer: m.manufacturer, relay_family: m.relay_family, open_issues: m.open, critical_issues: m.critical, total_hours: m.hours, risk_score: riskScore, risk_label };
    })
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 10);

  // Top rated models
  const topRatedModels: TopRatedModel[] = filteredModels
    .filter(m => (raterCounts.get(m.id) || 0) > 0)
    .sort((a, b) => (raterCounts.get(b.id) || 0) - (raterCounts.get(a.id) || 0))
    .slice(0, 10)
    .map(m => ({
      model_name: m.model_name,
      manufacturer: m.manufacturer,
      rating_count: raterCounts.get(m.id) || 0,
      quality_grade: m.official_quality_grade || 'N/A',
      popularity_grade: m.official_popularity_grade || 'N/A',
    }));

  // Most used templates — sum of sighting counts per model
  const usageCountMap = new Map<string, number>();
  allUsages.forEach(u => usageCountMap.set(u.relay_model_id, (usageCountMap.get(u.relay_model_id) || 0) + u.count));
  const mostUsedTemplates: MostUsedTemplate[] = filteredModels
    .filter(m => (usageCountMap.get(m.id) || 0) > 0)
    .sort((a, b) => (usageCountMap.get(b.id) || 0) - (usageCountMap.get(a.id) || 0))
    .slice(0, 20)
    .map(m => ({
      model_name: m.model_name,
      manufacturer: m.manufacturer,
      relay_family: m.relay_family || '',
      usage_count: usageCountMap.get(m.id) || 0,
      quality_grade: m.official_quality_grade || 'N/A',
      popularity_grade: m.official_popularity_grade || 'N/A',
    }));

  // Family risk matrix
  const familyMap = new Map<string, { critical: number; high: number; medium: number; low: number; total: number }>();
  filtered.forEach((f: any) => {
    const fam = f.relay_models?.relay_family || 'Unknown';
    const e = familyMap.get(fam) || { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
    e.total++;
    if (f.severity === 'critical') e.critical++;
    else if (f.severity === 'high') e.high++;
    else if (f.severity === 'medium') e.medium++;
    else e.low++;
    familyMap.set(fam, e);
  });
  const familyRiskMatrix: FamilyRiskRow[] = Array.from(familyMap.entries())
    .map(([family, counts]) => ({
      family,
      ...counts,
      riskScore: counts.critical * 25 + counts.high * 10 + counts.medium * 3 + counts.low,
    }))
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8);

  // Workload forecast (last 4 months actual + 2 months projected)
  const workloadForecast: WorkloadForecast[] = [];
  let baselineHours = 0;
  for (let i = 3; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    const start = format(startOfMonth(d), 'yyyy-MM-dd');
    const end = format(endOfMonth(d), 'yyyy-MM-dd');
    const mFeedback = allFeedback.filter((f: any) => f.created_at >= start && f.created_at <= end + 'T23:59:59');
    const mHours = mFeedback.reduce((s: number, f: any) => s + (f.estimated_fix_hours || 0), 0);
    baselineHours = mHours;
    workloadForecast.push({ month: format(d, 'MMM yy'), actual: mHours, projected: 0 });
  }
  // Simple linear projection for next 2 months
  const recentTrend = workloadForecast.length >= 2
    ? workloadForecast[workloadForecast.length - 1].actual - workloadForecast[workloadForecast.length - 2].actual
    : 0;
  for (let i = 1; i <= 2; i++) {
    const d = subMonths(new Date(), -i);
    const projected = Math.max(0, baselineHours + recentTrend * i);
    workloadForecast.push({ month: format(d, 'MMM yy'), actual: 0, projected: Math.round(projected) });
  }

  const healthScore = computeHealthScore(
    openIssues.length, criticalIssues.length, filtered.length,
    pendingApproval, filteredModels.length, unflaggedRatings.length
  );

  const actionItems = generateActionItems(kpi, problematicModels, familyRiskMatrix, manufacturerCounts);
  const executiveSummary = generateExecutiveSummary(kpi, healthScore, monthlyTrend);
  const narrativeInsights = generateNarrative(kpi, monthlyTrend, familyRiskMatrix, manufacturerCounts, healthScore);

  const appendixFeedback = filtered.slice(0, 80).map((f: any) => ({
    title: f.title,
    model: f.relay_models?.model_name || '',
    family: f.relay_models?.relay_family || '',
    severity: f.severity,
    status: f.status,
    submitter: f.profiles?.full_name || f.profiles?.email || '',
    hours: f.estimated_fix_hours || 0,
    date: format(new Date(f.created_at), 'yyyy-MM-dd'),
  }));

  return {
    generatedAt: format(new Date(), 'MMMM d, yyyy HH:mm'),
    generatedBy,
    reportVersion: `v${format(new Date(), 'yyyy.MM')}`,
    filters,
    kpi,
    manufacturerCounts,
    severityCounts,
    monthlyTrend,
    ratingDist,
    problematicModels,
    topRatedModels,
    mostUsedTemplates,
    familyRiskMatrix,
    workloadForecast,
    healthScore,
    actionItems,
    executiveSummary,
    narrativeInsights,
    appendixFeedback,
  };
}
