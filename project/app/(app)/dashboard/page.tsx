'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { TopNav } from '@/components/top-nav';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart, Legend,
} from 'recharts';
import { Cpu, MessageSquare, AlertTriangle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

interface Stats {
  totalModels: number;
  totalFeedback: number;
  openIssues: number;
  closedIssues: number;
  avgFixHours: number;
  criticalIssues: number;
}

interface SeverityDist {
  name: string;
  value: number;
  color: string;
}

interface MonthlyTrend {
  month: string;
  open: number;
  resolved: number;
}

interface TopModel {
  model_name: string;
  manufacturer: string;
  count: number;
}

interface ActiveUser {
  full_name: string;
  email: string;
  count: number;
}

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalModels: 0, totalFeedback: 0, openIssues: 0,
    closedIssues: 0, avgFixHours: 0, criticalIssues: 0,
  });
  const [severityDist, setSeverityDist] = useState<SeverityDist[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [topModels, setTopModels] = useState<TopModel[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [modelsRes, feedbackRes, profilesRes] = await Promise.all([
        supabase.from('relay_models').select('id, model_name, manufacturer', { count: 'exact' }),
        supabase.from('feedback_entries').select('*'),
        supabase.from('profiles').select('id, full_name, email'),
      ]);

      const models: Array<{ id: string; model_name: string; manufacturer: string }> = modelsRes.data || [];
      const feedback: Array<{ id: string; relay_model_id: string; user_id: string; status: string; severity: string; estimated_fix_hours: number; created_at: string }> = feedbackRes.data || [];
      const profiles: Array<{ id: string; full_name: string; email: string }> = profilesRes.data || [];

      const profileMap = new Map(profiles.map((p: { id: string; full_name: string; email: string }) => [p.id, p]));

      const openIssues = feedback.filter(f => ['open', 'in_progress'].includes(f.status)).length;
      const closedIssues = feedback.filter(f => ['resolved', 'closed'].includes(f.status)).length;
      const criticalIssues = feedback.filter(f => f.severity === 'critical').length;
      const avgFixHours = feedback.length
        ? feedback.reduce((sum, f) => sum + (f.estimated_fix_hours || 0), 0) / feedback.length
        : 0;

      setStats({
        totalModels: modelsRes.count || 0,
        totalFeedback: feedback.length,
        openIssues,
        closedIssues,
        avgFixHours: Math.round(avgFixHours * 10) / 10,
        criticalIssues,
      });

      // Severity distribution
      const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 };
      feedback.forEach(f => {
        if (f.severity in sevCounts) sevCounts[f.severity as keyof typeof sevCounts]++;
      });
      setSeverityDist([
        { name: 'Critical', value: sevCounts.critical, color: SEVERITY_COLORS.critical },
        { name: 'High', value: sevCounts.high, color: SEVERITY_COLORS.high },
        { name: 'Medium', value: sevCounts.medium, color: SEVERITY_COLORS.medium },
        { name: 'Low', value: sevCounts.low, color: SEVERITY_COLORS.low },
      ]);

      // Monthly trend (last 6 months)
      const months: MonthlyTrend[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const start = startOfMonth(date);
        const end = endOfMonth(date);
        const monthFeedback = feedback.filter(f => {
          const d = new Date(f.created_at);
          return d >= start && d <= end;
        });
        months.push({
          month: format(date, 'MMM'),
          open: monthFeedback.filter(f => ['open', 'in_progress'].includes(f.status)).length,
          resolved: monthFeedback.filter(f => ['resolved', 'closed'].includes(f.status)).length,
        });
      }
      setMonthlyTrend(months);

      // Top problematic models
      const modelCounts = new Map<string, { model_name: string; manufacturer: string; count: number }>();
      feedback.forEach(f => {
        const model = models.find(m => m.id === f.relay_model_id);
        if (model) {
          const key = model.id;
          const existing = modelCounts.get(key);
          if (existing) {
            existing.count++;
          } else {
            modelCounts.set(key, { model_name: model.model_name, manufacturer: model.manufacturer, count: 1 });
          }
        }
      });
      const sortedModels = Array.from(modelCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setTopModels(sortedModels);

      // Most active users
      const userCounts = new Map<string, number>();
      feedback.forEach(f => {
        userCounts.set(f.user_id, (userCounts.get(f.user_id) || 0) + 1);
      });
      const sortedUsers = Array.from(userCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([uid, count]) => {
          const p = profileMap.get(uid);
          return { full_name: p?.full_name || 'Unknown', email: p?.email || '', count };
        });
      setActiveUsers(sortedUsers);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({
    title, value, icon: Icon, color, subtitle
  }: {
    title: string; value: string | number; icon: React.ElementType;
    color: string; subtitle?: string;
  }) => (
    <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold mt-1 text-foreground">
            {loading ? <span className="inline-block w-16 h-7 bg-muted rounded animate-pulse" /> : value}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <TopNav title="Dashboard" description="Overview of relay model feedback and engineering activity" />

      <div className="p-6 space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard title="Relay Models" value={stats.totalModels} icon={Cpu} color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
          <StatCard title="Total Feedback" value={stats.totalFeedback} icon={MessageSquare} color="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" />
          <StatCard title="Open Issues" value={stats.openIssues} icon={AlertTriangle} color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
          <StatCard title="Resolved" value={stats.closedIssues} icon={CheckCircle2} color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
          <StatCard title="Critical Issues" value={stats.criticalIssues} icon={AlertTriangle} color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" />
          <StatCard title="Avg Fix Hours" value={`${stats.avgFixHours}h`} icon={Clock} color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" subtitle="per issue" />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Monthly trend */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground text-sm">Issue Trend</h3>
                <p className="text-xs text-muted-foreground">Last 6 months</p>
              </div>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </div>
            {loading ? (
              <div className="h-52 bg-muted rounded-lg animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={monthlyTrend}>
                  <defs>
                    <linearGradient id="colorOpen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="open" stroke="#3b82f6" fill="url(#colorOpen)" name="Open" strokeWidth={2} />
                  <Area type="monotone" dataKey="resolved" stroke="#22c55e" fill="url(#colorResolved)" name="Resolved" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Severity distribution */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="mb-4">
              <h3 className="font-semibold text-foreground text-sm">Severity Distribution</h3>
              <p className="text-xs text-muted-foreground">All time</p>
            </div>
            {loading ? (
              <div className="h-52 bg-muted rounded-lg animate-pulse" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={severityDist}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      dataKey="value"
                    >
                      {severityDist.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {severityDist.map((item) => (
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

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top problematic models */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground text-sm mb-4">Top Problematic Models</h3>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-8 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : topModels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No feedback data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={topModels} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis
                    type="category"
                    dataKey="model_name"
                    width={80}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Issues" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Most active users */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground text-sm mb-4">Most Active Engineers</h3>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : activeUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No user activity yet
              </div>
            ) : (
              <div className="space-y-3">
                {activeUsers.map((user, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-foreground text-xs font-semibold">
                        {user.full_name.charAt(0) || 'U'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{user.full_name || user.email}</p>
                      <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(user.count / (activeUsers[0]?.count || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-foreground ml-2">{user.count}</span>
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
