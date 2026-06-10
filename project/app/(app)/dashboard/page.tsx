'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { TopNav } from '@/components/top-nav';
import { GradeBadge } from '@/components/severity-badge';
import { computeCommunityGrade, GRADE_NUMERIC } from '@/lib/database.types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Area, AreaChart, Legend,
} from 'recharts';
import {
  Cpu, MessageSquare, AlertTriangle, CheckCircle2, Clock, TrendingUp,
  Star, Users, ShieldCheck, AlertCircle, BarChart3, MapPin, FileInput,
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

interface Stats {
  totalModels: number;
  totalFeedback: number;
  openIssues: number;
  closedIssues: number;
  avgFixHours: number;
  criticalIssues: number;
  totalRatings: number;
  modelsNeedingApproval: number;
  trTotal: number;
  trUnderReview: number;
  trApproved: number;
  trReleased: number;
}

interface MonthlyTrend { month: string; open: number; resolved: number; }
interface TopModel { id: string; model_name: string; manufacturer: string; count: number; }
interface MostUsedModel { id: string; model_name: string; manufacturer: string; usage_count: number; }
interface ActiveUser { full_name: string; email: string; count: number; }
interface GradedModel { id: string; model_name: string; manufacturer: string; grade: string; rater_count: number; }
interface GradeDist { grade: string; quality: number; popularity: number; }
interface ConflictingModel { id: string; model_name: string; spread: number; rater_count: number; }
interface TopRater { full_name: string; email: string; count: number; }

const SEVERITY_COLORS = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };
const GRADE_ORDER = ['A+', 'A', 'B', 'C', 'D', 'N/A'];

export default function DashboardPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [stats, setStats] = useState<Stats>({ totalModels: 0, totalFeedback: 0, openIssues: 0, closedIssues: 0, avgFixHours: 0, criticalIssues: 0, totalRatings: 0, modelsNeedingApproval: 0, trTotal: 0, trUnderReview: 0, trApproved: 0, trReleased: 0 });
  const [severityDist, setSeverityDist] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [topModels, setTopModels] = useState<TopModel[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [topQualityModels, setTopQualityModels] = useState<GradedModel[]>([]);
  const [lowestQualityModels, setLowestQualityModels] = useState<GradedModel[]>([]);
  const [mostReviewed, setMostReviewed] = useState<GradedModel[]>([]);
  const [conflicting, setConflicting] = useState<ConflictingModel[]>([]);
  const [gradeDist, setGradeDist] = useState<GradeDist[]>([]);
  const [topRaters, setTopRaters] = useState<TopRater[]>([]);
  const [mostUsed, setMostUsed] = useState<MostUsedModel[]>([]);
  const [totalActiveUsers, setTotalActiveUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [modelsRes, feedbackRes, profilesRes, ratingsRes, usagesRes, trRes] = await Promise.all([
        supabase.from('relay_models').select('id, model_name, manufacturer, official_quality_grade, official_popularity_grade', { count: 'exact' }),
        supabase.from('feedback_entries').select('*'),
        supabase.from('profiles').select('id, full_name, email'),
        supabase.from('relay_model_ratings').select('relay_model_id, user_id, quality_grade, popularity_grade, is_flagged, created_at').eq('is_flagged', false),
        supabase.from('template_usages').select('relay_model_id, user_id, count'),
        supabase.from('template_requests').select('status'),
      ]);

      const models: Array<{ id: string; model_name: string; manufacturer: string; official_quality_grade: string; official_popularity_grade: string }> = modelsRes.data || [];
      const feedback: Array<{ id: string; relay_model_id: string; user_id: string; status: string; severity: string; estimated_fix_hours: number; created_at: string }> = feedbackRes.data || [];
      const profiles: Array<{ id: string; full_name: string; email: string }> = profilesRes.data || [];
      const ratings: Array<{ relay_model_id: string; user_id: string; quality_grade: string | null; popularity_grade: string | null; is_flagged: boolean; created_at: string }> = ratingsRes.data || [];

      const profileMap = new Map(profiles.map(p => [p.id, p]));

      // Feedback stats
      const openIssues = feedback.filter(f => ['open', 'in_progress'].includes(f.status)).length;
      const closedIssues = feedback.filter(f => ['resolved', 'closed'].includes(f.status)).length;
      const criticalIssues = feedback.filter(f => f.severity === 'critical').length;
      const avgFixHours = feedback.length ? feedback.reduce((s, f) => s + (f.estimated_fix_hours || 0), 0) / feedback.length : 0;

      // Ratings by model
      const ratingsByModel = new Map<string, typeof ratings>();
      ratings.forEach(r => {
        const arr = ratingsByModel.get(r.relay_model_id) || [];
        arr.push(r);
        ratingsByModel.set(r.relay_model_id, arr);
      });

      const modelsNeedingApproval = models.filter(m => {
        const mr = ratingsByModel.get(m.id) || [];
        return mr.length > 0 && (m.official_quality_grade === 'N/A' || m.official_popularity_grade === 'N/A');
      }).length;

      setStats({ totalModels: modelsRes.count || 0, totalFeedback: feedback.length, openIssues, closedIssues, avgFixHours: Math.round(avgFixHours * 10) / 10, criticalIssues, totalRatings: ratings.length, modelsNeedingApproval,
        trTotal: (trRes.data || []).length,
        trUnderReview: (trRes.data || []).filter((r: any) => r.status === 'Under Review').length,
        trApproved: (trRes.data || []).filter((r: any) => r.status === 'Approved').length,
        trReleased: (trRes.data || []).filter((r: any) => r.status === 'Released').length,
      });

      // Severity distribution
      const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 };
      feedback.forEach(f => { if (f.severity in sevCounts) sevCounts[f.severity as keyof typeof sevCounts]++; });
      setSeverityDist([
        { name: 'Critical', value: sevCounts.critical, color: SEVERITY_COLORS.critical },
        { name: 'High', value: sevCounts.high, color: SEVERITY_COLORS.high },
        { name: 'Medium', value: sevCounts.medium, color: SEVERITY_COLORS.medium },
        { name: 'Low', value: sevCounts.low, color: SEVERITY_COLORS.low },
      ]);

      // Monthly trend
      const months: MonthlyTrend[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const start = startOfMonth(date);
        const end = endOfMonth(date);
        const mf = feedback.filter(f => { const d = new Date(f.created_at); return d >= start && d <= end; });
        months.push({ month: format(date, 'MMM'), open: mf.filter(f => ['open', 'in_progress'].includes(f.status)).length, resolved: mf.filter(f => ['resolved', 'closed'].includes(f.status)).length });
      }
      setMonthlyTrend(months);

      // Top problematic models
      const modelFbCounts = new Map<string, { id: string; model_name: string; manufacturer: string; count: number }>();
      feedback.forEach(f => {
        const m = models.find(mo => mo.id === f.relay_model_id);
        if (m) { const e = modelFbCounts.get(m.id); if (e) e.count++; else modelFbCounts.set(m.id, { id: m.id, model_name: m.model_name, manufacturer: m.manufacturer, count: 1 }); }
      });
      setTopModels(Array.from(modelFbCounts.values()).sort((a, b) => b.count - a.count).slice(0, 5));

      // Active users
      const userFbCounts = new Map<string, number>();
      feedback.forEach(f => userFbCounts.set(f.user_id, (userFbCounts.get(f.user_id) || 0) + 1));
      setActiveUsers(Array.from(userFbCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([uid, count]) => { const p = profileMap.get(uid); return { full_name: p?.full_name || 'Unknown', email: p?.email || '', count }; }));

      // Community grade computations per model
      const qualityOrder: Record<string, number> = { 'A+': 0, 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'N/A': 5 };
      const modelGrades = models.map(m => {
        const mr = ratingsByModel.get(m.id) || [];
        const { grade: cq, count } = computeCommunityGrade(mr, 'quality_grade');
        const { grade: cp } = computeCommunityGrade(mr, 'popularity_grade');
        const displayQ = m.official_quality_grade && m.official_quality_grade !== 'N/A' ? m.official_quality_grade : cq;
        return { id: m.id, model_name: m.model_name, manufacturer: m.manufacturer, community_quality: cq, community_popularity: cp, display_quality: displayQ, rater_count: count, ratings: mr };
      });

      // Highest quality (by display grade, then rater count)
      const graded = modelGrades.filter(m => m.display_quality !== 'N/A');
      setTopQualityModels(graded.sort((a, b) => (qualityOrder[a.display_quality] ?? 5) - (qualityOrder[b.display_quality] ?? 5)).slice(0, 5).map(m => ({ id: m.id, model_name: m.model_name, manufacturer: m.manufacturer, grade: m.display_quality, rater_count: m.rater_count })));

      // Lowest quality
      const lowQuality = modelGrades.filter(m => m.display_quality !== 'N/A' && m.rater_count >= 1);
      setLowestQualityModels(lowQuality.sort((a, b) => (qualityOrder[b.display_quality] ?? 5) - (qualityOrder[a.display_quality] ?? 5)).slice(0, 5).map(m => ({ id: m.id, model_name: m.model_name, manufacturer: m.manufacturer, grade: m.display_quality, rater_count: m.rater_count })));

      // Most reviewed
      setMostReviewed(modelGrades.filter(m => m.rater_count > 0).sort((a, b) => b.rater_count - a.rater_count).slice(0, 5).map(m => ({ id: m.id, model_name: m.model_name, manufacturer: m.manufacturer, grade: m.display_quality, rater_count: m.rater_count })));

      // Conflicting ratings: models where quality grade has high spread
      const conflictingModels: ConflictingModel[] = [];
      modelGrades.forEach(m => {
        if (m.ratings.length < 2) return;
        const scores = m.ratings.map(r => GRADE_NUMERIC[r.quality_grade || 'N/A'] || 0).filter(s => s > 0);
        if (scores.length < 2) return;
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        const spread = max - min;
        if (spread >= 2) conflictingModels.push({ id: m.id, model_name: m.model_name, spread, rater_count: scores.length });
      });
      setConflicting(conflictingModels.sort((a, b) => b.spread - a.spread).slice(0, 5));

      // Grade distribution
      const gradeDistMap = new Map<string, { quality: number; popularity: number }>();
      GRADE_ORDER.forEach(g => gradeDistMap.set(g, { quality: 0, popularity: 0 }));
      modelGrades.forEach(m => {
        const mr = ratingsByModel.get(m.id) || [];
        mr.forEach(r => {
          if (r.quality_grade) { const e = gradeDistMap.get(r.quality_grade); if (e) e.quality++; }
          if (r.popularity_grade) { const e = gradeDistMap.get(r.popularity_grade); if (e) e.popularity++; }
        });
      });
      setGradeDist(GRADE_ORDER.map(g => ({ grade: g, ...gradeDistMap.get(g)! })));

      // Top raters (users with most ratings)
      const userRateCounts = new Map<string, number>();
      ratings.forEach(r => userRateCounts.set(r.user_id, (userRateCounts.get(r.user_id) || 0) + 1));
      setTopRaters(Array.from(userRateCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([uid, count]) => { const p = profileMap.get(uid); return { full_name: p?.full_name || 'Unknown', email: p?.email || '', count }; }));

      // Most used templates — sum of counts per model
      const usages: Array<{ relay_model_id: string; user_id: string; count: number }> = usagesRes.data || [];
      const modelUsageCount = new Map<string, number>();
      usages.forEach(u => modelUsageCount.set(u.relay_model_id, (modelUsageCount.get(u.relay_model_id) || 0) + u.count));
      const mostUsedList = Array.from(modelUsageCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([mid, usage_count]) => {
          const m = models.find(mo => mo.id === mid);
          return { id: mid, model_name: m?.model_name || 'Unknown', manufacturer: m?.manufacturer || '', usage_count };
        });
      setMostUsed(mostUsedList);

      // Total sightings count
      const totalSightings = usages.reduce((s, u) => s + u.count, 0);
      setTotalActiveUsers(totalSightings);

    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle, href, dark }: { title: string; value: string | number; icon: React.ElementType; color: string; subtitle?: string; href?: string; dark?: boolean }) => {
    const content = dark ? (
      <div className="relative overflow-hidden bg-gradient-to-br from-sky-700 to-blue-900 dark:from-sky-800 dark:to-blue-950 border border-sky-600/40 dark:border-sky-700/40 rounded-xl p-5 cursor-pointer shadow-md hover:shadow-sky-700/30 hover:shadow-lg transition-all duration-200 group">
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-br from-sky-600/20 to-blue-800/20" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-sky-100">{title}</p>
            <p className="text-xl font-bold mt-1 text-white">
              {loading ? <span className="inline-block w-20 h-6 bg-sky-600/40 rounded animate-pulse" /> : value}
            </p>
            {subtitle && <p className="text-xs text-sky-300 mt-0.5">{subtitle}</p>}
          </div>
          <div className="p-2.5 rounded-xl bg-white/15 text-white group-hover:bg-white/25 transition-colors duration-200">
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </div>
    ) : (
      <div className={`bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow ${href ? 'cursor-pointer hover:border-primary/50' : ''}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1 text-foreground">
              {loading ? <span className="inline-block w-16 h-7 bg-muted rounded animate-pulse" /> : value}
            </p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`p-2.5 rounded-xl ${color}`}><Icon className="w-5 h-5" /></div>
        </div>
      </div>
    );
    return href ? <Link href={href}>{content}</Link> : content;
  };

  return (
    <div>
      <TopNav title="Dashboard" description="Overview of relay model feedback and engineering activity" />
      <div className="p-6 space-y-6">

        {/* Stats grid */}
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${isAdmin ? 'xl:grid-cols-10' : 'xl:grid-cols-8'}`}>
          <StatCard title="Relay Models" value={stats.totalModels} icon={Cpu} color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" href="/relay-models" />
          <StatCard title="Total Feedback" value={stats.totalFeedback} icon={MessageSquare} color="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" />
          <StatCard title="Open Issues" value={stats.openIssues} icon={AlertTriangle} color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
          <StatCard title="Resolved" value={stats.closedIssues} icon={CheckCircle2} color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
          <StatCard title="Critical" value={stats.criticalIssues} icon={AlertTriangle} color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" />
          <StatCard title="Avg Fix Hours" value={`${stats.avgFixHours}h`} icon={Clock} color="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" subtitle="per issue" />
          <StatCard title="Total Ratings" value={stats.totalRatings} icon={Users} color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" subtitle="user submitted" />
          <StatCard title="Total Market Sightings" value={totalActiveUsers} icon={MapPin} color="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" subtitle="across all relay models" href="/relay-models" />
          {isAdmin && (
            <StatCard title="Needs Approval" value={stats.modelsNeedingApproval} icon={ShieldCheck} color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" subtitle="models to review" href="/admin" />
          )}
          {isAdmin && (
            <StatCard title="Generate Reports" value="12 templates" icon={BarChart3} color="" subtitle="Export analytics & reports" href="/admin/reports" dark />
          )}
        </div>

        {/* Template Requests card */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2"><FileInput className="w-4 h-4 text-blue-500" /> Template Requests</h3>
              <p className="text-xs text-muted-foreground">New RTMS template development requests</p>
            </div>
            <Link href="/template-requests" className="text-xs text-muted-foreground hover:text-primary transition-colors">View all</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Requests', value: stats.trTotal, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
              { label: 'Under Review', value: stats.trUnderReview, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
              { label: 'Approved', value: stats.trApproved, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
              { label: 'Released', value: stats.trReleased, color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
            ].map(s => (
              <Link key={s.label} href="/template-requests" className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/30 transition-all">
                <div className={`p-2 rounded-lg flex-shrink-0 ${s.color}`}><FileInput className="w-3.5 h-3.5" /></div>
                <div>
                  <p className="text-xl font-bold text-foreground">{loading ? '—' : s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="font-semibold text-foreground text-sm">Issue Trend</h3><p className="text-xs text-muted-foreground">Last 6 months</p></div>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </div>
            {loading ? <div className="h-52 bg-muted rounded-lg animate-pulse" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={monthlyTrend}>
                  <defs>
                    <linearGradient id="colorOpen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="open" stroke="#3b82f6" fill="url(#colorOpen)" name="Open" strokeWidth={2} />
                  <Area type="monotone" dataKey="resolved" stroke="#22c55e" fill="url(#colorResolved)" name="Resolved" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="mb-4"><h3 className="font-semibold text-foreground text-sm">Severity Distribution</h3><p className="text-xs text-muted-foreground">All time</p></div>
            {loading ? <div className="h-52 bg-muted rounded-lg animate-pulse" /> : (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={severityDist} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value">
                      {severityDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {severityDist.map(item => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-semibold text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Grade Distribution */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div><h3 className="font-semibold text-foreground text-sm">Community Grade Distribution</h3><p className="text-xs text-muted-foreground">Submitted quality and popularity ratings</p></div>
            <Star className="w-4 h-4 text-muted-foreground" />
          </div>
          {loading ? <div className="h-40 bg-muted rounded-lg animate-pulse" /> : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={gradeDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="grade" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="quality" name="Quality" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="popularity" name="Popularity" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 4-column grade leaderboards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Highest quality */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground text-sm mb-4 flex items-center gap-2">
              <Star className="w-4 h-4 text-blue-500" /> Highest Quality
            </h3>
            {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}</div> :
              topQualityModels.length === 0 ? <p className="text-xs text-muted-foreground text-center py-6">No grades yet</p> : (
                <div className="space-y-2">
                  {topQualityModels.map((m, i) => (
                    <Link key={m.id} href={`/relay-models/${m.id}`} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-accent transition-colors group">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground w-4 flex-shrink-0">{i + 1}</span>
                        <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{m.model_name}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <GradeBadge grade={m.grade} />
                        {m.rater_count > 0 && <span className="text-xs text-muted-foreground">({m.rater_count})</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
          </div>

          {/* Lowest quality */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground text-sm mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" /> Lowest Quality
            </h3>
            {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}</div> :
              lowestQualityModels.length === 0 ? <p className="text-xs text-muted-foreground text-center py-6">No grades yet</p> : (
                <div className="space-y-2">
                  {lowestQualityModels.map((m, i) => (
                    <Link key={m.id} href={`/relay-models/${m.id}`} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-accent transition-colors group">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground w-4 flex-shrink-0">{i + 1}</span>
                        <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{m.model_name}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <GradeBadge grade={m.grade} />
                        {m.rater_count > 0 && <span className="text-xs text-muted-foreground">({m.rater_count})</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
          </div>

          {/* Most reviewed */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground text-sm mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" /> Most Reviewed
            </h3>
            {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}</div> :
              mostReviewed.length === 0 ? <p className="text-xs text-muted-foreground text-center py-6">No ratings yet</p> : (
                <div className="space-y-2">
                  {mostReviewed.map((m, i) => (
                    <Link key={m.id} href={`/relay-models/${m.id}`} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-accent transition-colors group">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground w-4 flex-shrink-0">{i + 1}</span>
                        <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{m.model_name}</p>
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground flex-shrink-0 flex items-center gap-1"><Users className="w-3 h-3" />{m.rater_count}</span>
                    </Link>
                  ))}
                </div>
              )}
          </div>

          {/* Conflicting ratings */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground text-sm mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Conflicting Ratings
            </h3>
            {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}</div> :
              conflicting.length === 0 ? <p className="text-xs text-muted-foreground text-center py-6">No conflicts</p> : (
                <div className="space-y-2">
                  {conflicting.map((m, i) => (
                    <Link key={m.id} href={`/relay-models/${m.id}`} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-accent transition-colors group">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground w-4 flex-shrink-0">{i + 1}</span>
                        <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{m.model_name}</p>
                      </div>
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex-shrink-0">{m.spread} grade spread</span>
                    </Link>
                  ))}
                </div>
              )}
          </div>
        </div>

        {/* Most Used Templates */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-teal-500" /> Most Sighted Templates</h3>
              <p className="text-xs text-muted-foreground">Top 10 relay models by total market sightings</p>
            </div>
            <Link href="/relay-models" className="text-xs text-muted-foreground hover:text-primary transition-colors">View all</Link>
          </div>
          {loading ? <div className="h-64 bg-muted rounded-lg animate-pulse" /> :
            mostUsed.length === 0 ? <div className="text-center py-10 text-muted-foreground text-sm">No templates marked as in use yet.<br /><span className="text-xs">Engineers can click "I Use This Template" on any relay model.</span></div> : (
              <div className="space-y-2.5">
                {mostUsed.map((m, i) => (
                  <Link key={m.id} href={`/relay-models/${m.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors group">
                    <span className="text-xs text-muted-foreground w-5 flex-shrink-0 font-medium">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{m.model_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.manufacturer}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="h-2 bg-muted rounded-full overflow-hidden" style={{ width: `${Math.max(24, (m.usage_count / (mostUsed[0]?.usage_count || 1)) * 80)}px` }}>
                        <div className="h-full bg-teal-500 rounded-full" style={{ width: '100%' }} />
                      </div>
                      <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 min-w-[24px] text-right">{m.usage_count}</span>                    </div>
                  </Link>
                ))}
              </div>
            )}
        </div>

        {/* Bottom row: Top complaints + active engineers + top raters */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground text-sm mb-4">Most Complained Models</h3>
            {loading ? <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}</div> :
              topModels.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">No feedback yet</div> : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={topModels} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis type="category" dataKey="model_name" width={80} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Issues" />
                  </BarChart>
                </ResponsiveContainer>
              )}
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground text-sm mb-4">Most Active Engineers</h3>
            {loading ? <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}</div> :
              activeUsers.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">No activity yet</div> : (
                <div className="space-y-3">
                  {activeUsers.map((u, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <span className="text-primary-foreground text-xs font-semibold">{u.full_name.charAt(0) || 'U'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{u.full_name || u.email}</p>
                        <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${(u.count / (activeUsers[0]?.count || 1)) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-foreground ml-2">{u.count}</span>
                    </div>
                  ))}
                </div>
              )}
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground text-sm mb-4 flex items-center gap-2"><Star className="w-4 h-4 text-amber-500" /> Top Raters</h3>
            {loading ? <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}</div> :
              topRaters.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">No ratings yet</div> : (
                <div className="space-y-3">
                  {topRaters.map((u, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-amber-700 dark:text-amber-400 text-xs font-semibold">{u.full_name.charAt(0) || 'U'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{u.full_name || u.email}</p>
                        <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(u.count / (topRaters[0]?.count || 1)) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-foreground ml-2">{u.count}</span>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
