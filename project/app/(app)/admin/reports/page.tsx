'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { TopNav } from '@/components/top-nav';
import { ExecutiveReportModal } from '@/components/executive-report-modal';
import { toast } from 'sonner';
import {
  BarChart3, FileText, Users, Cpu, MessageSquare, Star,
  Download, Loader2, CheckCircle2, Clock, AlertTriangle,
  ChevronRight, Calendar, RefreshCw, Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';

interface ReportTemplate {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  category: 'feedback' | 'models' | 'ratings' | 'users';
  columns: string[];
  fetchData: () => Promise<Record<string, unknown>[]>;
}

interface Summary {
  totalModels: number;
  totalFeedback: number;
  openIssues: number;
  resolvedIssues: number;
  criticalIssues: number;
  totalRatings: number;
  activeUsers: number;
  manufacturers: number;
}

function downloadCSV(filename: string, rows: Record<string, unknown>[], columns: string[]) {
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.join(',');
  const body = rows.map(r => columns.map(c => escape(r[c])).join(',')).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<Record<string, string>>({});
  const [execModalOpen, setExecModalOpen] = useState(false);

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      router.replace('/dashboard');
      return;
    }
    loadSummary();
  }, [profile]);

  const loadSummary = async () => {
    setLoadingSummary(true);
    const [modelsRes, feedbackRes, ratingsRes, profilesRes] = await Promise.all([
      supabase.from('relay_models').select('id, manufacturer', { count: 'exact' }),
      supabase.from('feedback_entries').select('status, severity'),
      supabase.from('relay_model_ratings').select('id', { count: 'exact' }).eq('is_flagged', false),
      supabase.from('profiles').select('id', { count: 'exact' }).eq('active', true),
    ]);

    const feedback = feedbackRes.data || [];
    const manufacturers = new Set((modelsRes.data || []).map(m => m.manufacturer)).size;

    setSummary({
      totalModels: modelsRes.count || 0,
      totalFeedback: feedback.length,
      openIssues: feedback.filter(f => ['open', 'in_progress'].includes(f.status)).length,
      resolvedIssues: feedback.filter(f => ['resolved', 'closed'].includes(f.status)).length,
      criticalIssues: feedback.filter(f => f.severity === 'critical').length,
      totalRatings: ratingsRes.count || 0,
      activeUsers: profilesRes.count || 0,
      manufacturers,
    });
    setLoadingSummary(false);
  };

  const REPORTS: ReportTemplate[] = [
    {
      id: 'all-feedback',
      title: 'All Feedback Entries',
      description: 'Complete list of all submitted feedback with status, severity, submitter, and estimated fix hours.',
      icon: MessageSquare,
      iconColor: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      category: 'feedback',
      columns: ['id', 'title', 'relay_model', 'severity', 'status', 'submitter', 'estimated_fix_hours', 'created_at'],
      fetchData: async () => {
        const { data } = await supabase
          .from('feedback_entries')
          .select('id, title, severity, status, estimated_fix_hours, created_at, relay_models(model_name), profiles(full_name, email)')
          .order('created_at', { ascending: false });
        return (data || []).map((f: any) => ({
          id: f.id,
          title: f.title,
          relay_model: f.relay_models?.model_name || '',
          severity: f.severity,
          status: f.status,
          submitter: f.profiles?.full_name || f.profiles?.email || '',
          estimated_fix_hours: f.estimated_fix_hours,
          created_at: format(new Date(f.created_at), 'yyyy-MM-dd HH:mm'),
        }));
      },
    },
    {
      id: 'open-issues',
      title: 'Open Issues Report',
      description: 'All feedback entries currently open or in progress — prioritised by severity.',
      icon: AlertTriangle,
      iconColor: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
      category: 'feedback',
      columns: ['id', 'title', 'relay_model', 'severity', 'status', 'submitter', 'estimated_fix_hours', 'created_at'],
      fetchData: async () => {
        const { data } = await supabase
          .from('feedback_entries')
          .select('id, title, severity, status, estimated_fix_hours, created_at, relay_models(model_name), profiles(full_name, email)')
          .in('status', ['open', 'in_progress'])
          .order('severity', { ascending: false });
        const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return (data || [])
          .sort((a: any, b: any) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
          .map((f: any) => ({
            id: f.id,
            title: f.title,
            relay_model: f.relay_models?.model_name || '',
            severity: f.severity,
            status: f.status,
            submitter: f.profiles?.full_name || f.profiles?.email || '',
            estimated_fix_hours: f.estimated_fix_hours,
            created_at: format(new Date(f.created_at), 'yyyy-MM-dd HH:mm'),
          }));
      },
    },
    {
      id: 'relay-models',
      title: 'Relay Models Catalogue',
      description: 'Full relay model inventory with manufacturer, template version, status, and community grades.',
      icon: Cpu,
      iconColor: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
      category: 'models',
      columns: ['model_name', 'manufacturer', 'relay_family', 'template_version', 'firmware_version', 'status', 'has_pdf', 'created_at'],
      fetchData: async () => {
        const { data } = await supabase
          .from('relay_models')
          .select('model_name, manufacturer, relay_family, template_version, firmware_version, status, has_pdf, created_at')
          .order('model_name', { ascending: true });
        return (data || []).map((m: any) => ({
          ...m,
          has_pdf: m.has_pdf ? 'Yes' : 'No',
          created_at: format(new Date(m.created_at), 'yyyy-MM-dd'),
        }));
      },
    },
    {
      id: 'models-by-manufacturer',
      title: 'Models by Manufacturer',
      description: 'Aggregated count of relay models grouped by manufacturer with active/deprecated breakdown.',
      icon: BarChart3,
      iconColor: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
      category: 'models',
      columns: ['manufacturer', 'total', 'active', 'deprecated', 'review'],
      fetchData: async () => {
        const { data } = await supabase.from('relay_models').select('manufacturer, status');
        const map = new Map<string, { total: number; active: number; deprecated: number; review: number }>();
        (data || []).forEach((m: any) => {
          const e = map.get(m.manufacturer) || { total: 0, active: 0, deprecated: 0, review: 0 };
          e.total++;
          if (m.status === 'active') e.active++;
          else if (m.status === 'deprecated') e.deprecated++;
          else if (m.status === 'review') e.review++;
          map.set(m.manufacturer, e);
        });
        return Array.from(map.entries())
          .sort((a, b) => b[1].total - a[1].total)
          .map(([manufacturer, counts]) => ({ manufacturer, ...counts }));
      },
    },
    {
      id: 'community-ratings',
      title: 'Community Ratings Export',
      description: 'All user-submitted quality and popularity ratings with reviewer details and comments.',
      icon: Star,
      iconColor: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
      category: 'ratings',
      columns: ['relay_model', 'reviewer', 'quality_grade', 'popularity_grade', 'comment', 'created_at'],
      fetchData: async () => {
        const { data } = await supabase
          .from('relay_model_ratings')
          .select('quality_grade, popularity_grade, comment, created_at, relay_models(model_name), profiles(full_name, email)')
          .eq('is_flagged', false)
          .order('created_at', { ascending: false });
        return (data || []).map((r: any) => ({
          relay_model: r.relay_models?.model_name || '',
          reviewer: r.profiles?.full_name || r.profiles?.email || '',
          quality_grade: r.quality_grade || 'N/A',
          popularity_grade: r.popularity_grade || 'N/A',
          comment: r.comment || '',
          created_at: format(new Date(r.created_at), 'yyyy-MM-dd HH:mm'),
        }));
      },
    },
    {
      id: 'models-pending-approval',
      title: 'Models Pending Grade Approval',
      description: 'Relay models with community ratings that have not yet received an official admin grade.',
      icon: CheckCircle2,
      iconColor: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
      category: 'ratings',
      columns: ['model_name', 'manufacturer', 'official_quality_grade', 'official_popularity_grade', 'rater_count'],
      fetchData: async () => {
        const [modelsRes, ratingsRes] = await Promise.all([
          supabase.from('relay_models').select('id, model_name, manufacturer, official_quality_grade, official_popularity_grade'),
          supabase.from('relay_model_ratings').select('relay_model_id').eq('is_flagged', false),
        ]);
        const raterCounts = new Map<string, number>();
        (ratingsRes.data || []).forEach((r: any) => raterCounts.set(r.relay_model_id, (raterCounts.get(r.relay_model_id) || 0) + 1));
        return (modelsRes.data || [])
          .filter(m => (raterCounts.get(m.id) || 0) > 0 && (m.official_quality_grade === 'N/A' || m.official_popularity_grade === 'N/A'))
          .sort((a, b) => (raterCounts.get(b.id) || 0) - (raterCounts.get(a.id) || 0))
          .map(m => ({
            model_name: m.model_name,
            manufacturer: m.manufacturer,
            official_quality_grade: m.official_quality_grade,
            official_popularity_grade: m.official_popularity_grade,
            rater_count: raterCounts.get(m.id) || 0,
          }));
      },
    },
    {
      id: 'user-activity',
      title: 'User Activity Report',
      description: 'All registered users with their feedback count, rating count, role, and account status.',
      icon: Users,
      iconColor: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
      category: 'users',
      columns: ['full_name', 'email', 'role', 'active', 'feedback_count', 'rating_count', 'joined_at'],
      fetchData: async () => {
        const [profilesRes, feedbackRes, ratingsRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name, email, role, active, created_at'),
          supabase.from('feedback_entries').select('user_id'),
          supabase.from('relay_model_ratings').select('user_id').eq('is_flagged', false),
        ]);
        const fbCounts = new Map<string, number>();
        (feedbackRes.data || []).forEach((f: any) => fbCounts.set(f.user_id, (fbCounts.get(f.user_id) || 0) + 1));
        const rateCounts = new Map<string, number>();
        (ratingsRes.data || []).forEach((r: any) => rateCounts.set(r.user_id, (rateCounts.get(r.user_id) || 0) + 1));
        return (profilesRes.data || [])
          .sort((a: any, b: any) => (fbCounts.get(b.id) || 0) - (fbCounts.get(a.id) || 0))
          .map((p: any) => ({
            full_name: p.full_name,
            email: p.email,
            role: p.role,
            active: p.active ? 'Yes' : 'No',
            feedback_count: fbCounts.get(p.id) || 0,
            rating_count: rateCounts.get(p.id) || 0,
            joined_at: format(new Date(p.created_at), 'yyyy-MM-dd'),
          }));
      },
    },
    {
      id: 'resolved-feedback',
      title: 'Resolved Issues Summary',
      description: 'All resolved and closed feedback entries with resolution time estimates.',
      icon: Clock,
      iconColor: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
      category: 'feedback',
      columns: ['id', 'title', 'relay_model', 'severity', 'status', 'submitter', 'estimated_fix_hours', 'created_at', 'updated_at'],
      fetchData: async () => {
        const { data } = await supabase
          .from('feedback_entries')
          .select('id, title, severity, status, estimated_fix_hours, created_at, updated_at, relay_models(model_name), profiles(full_name, email)')
          .in('status', ['resolved', 'closed'])
          .order('updated_at', { ascending: false });
        return (data || []).map((f: any) => ({
          id: f.id,
          title: f.title,
          relay_model: f.relay_models?.model_name || '',
          severity: f.severity,
          status: f.status,
          submitter: f.profiles?.full_name || f.profiles?.email || '',
          estimated_fix_hours: f.estimated_fix_hours,
          created_at: format(new Date(f.created_at), 'yyyy-MM-dd HH:mm'),
          updated_at: format(new Date(f.updated_at), 'yyyy-MM-dd HH:mm'),
        }));
      },
    },
  ];

  const CATEGORIES = [
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'models', label: 'Relay Models', icon: Cpu },
    { id: 'ratings', label: 'Ratings', icon: Star },
    { id: 'users', label: 'Users', icon: Users },
  ];

  const handleGenerate = async (report: ReportTemplate) => {
    setGenerating(report.id);
    try {
      const rows = await report.fetchData();
      if (rows.length === 0) {
        toast.info('No data found for this report');
        return;
      }
      const filename = `${report.id}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
      downloadCSV(filename, rows, report.columns);
      setLastGenerated(prev => ({ ...prev, [report.id]: format(new Date(), 'MMM d, yyyy HH:mm') }));
      toast.success(`${report.title} exported — ${rows.length} rows`);
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    } finally {
      setGenerating(null);
    }
  };

  const SummaryTile = ({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) => (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg flex-shrink-0 ${color}`}><Icon className="w-4 h-4" /></div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground">
          {loadingSummary ? <span className="inline-block w-10 h-5 bg-muted rounded animate-pulse" /> : value}
        </p>
      </div>
    </div>
  );

  return (
    <div>
      <ExecutiveReportModal open={execModalOpen} onClose={() => setExecModalOpen(false)} />

      <TopNav
        title="Generate Reports"
        description="Export analytics and management reports as CSV"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadSummary}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors text-muted-foreground"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSummary ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setExecModalOpen(true)}
              className="group flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white shadow-md shadow-blue-500/20 hover:shadow-blue-500/40 transition-all duration-200 hover:-translate-y-px"
            >
              <Sparkles className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
              Executive Report
            </button>
          </div>
        }
      />

      <div className="p-6 space-y-6">

        {/* Summary tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <SummaryTile label="Total Models" value={summary?.totalModels ?? 0} icon={Cpu} color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
          <SummaryTile label="Feedback" value={summary?.totalFeedback ?? 0} icon={MessageSquare} color="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" />
          <SummaryTile label="Open Issues" value={summary?.openIssues ?? 0} icon={AlertTriangle} color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
          <SummaryTile label="Resolved" value={summary?.resolvedIssues ?? 0} icon={CheckCircle2} color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
          <SummaryTile label="Critical" value={summary?.criticalIssues ?? 0} icon={AlertTriangle} color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" />
          <SummaryTile label="Ratings" value={summary?.totalRatings ?? 0} icon={Star} color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
          <SummaryTile label="Active Users" value={summary?.activeUsers ?? 0} icon={Users} color="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" />
          <SummaryTile label="Manufacturers" value={summary?.manufacturers ?? 0} icon={BarChart3} color="bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400" />
        </div>

        {/* Report cards by category */}
        {CATEGORIES.map(cat => {
          const catReports = REPORTS.filter(r => r.category === cat.id);
          return (
            <div key={cat.id}>
              <div className="flex items-center gap-2 mb-3">
                <cat.icon className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">{cat.label} Reports</h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{catReports.length}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {catReports.map(report => {
                  const isGenerating = generating === report.id;
                  return (
                    <div
                      key={report.id}
                      className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-primary/40 hover:shadow-md transition-all duration-200 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${report.iconColor}`}>
                          <report.icon className="w-4 h-4" />
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-0.5 flex-shrink-0" />
                      </div>

                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-foreground leading-tight">{report.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{report.description}</p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {report.columns.slice(0, 4).map(col => (
                            <span key={col} className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                              {col}
                            </span>
                          ))}
                          {report.columns.length > 4 && (
                            <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                              +{report.columns.length - 4} more
                            </span>
                          )}
                        </div>

                        {lastGenerated[report.id] && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            Last: {lastGenerated[report.id]}
                          </div>
                        )}

                        <button
                          onClick={() => handleGenerate(report)}
                          disabled={!!generating}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        >
                          {isGenerating ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                          ) : (
                            <><Download className="w-3 h-3" /> Export CSV</>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <p className="text-xs text-muted-foreground text-center pt-2">
          All exports are generated in real time from live database data and downloaded as CSV files.
        </p>
      </div>
    </div>
  );
}
