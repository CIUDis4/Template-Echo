'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchExecReportData, type ExecReportFilters } from '@/lib/executive-report';
import { generateExecPDF } from '@/lib/generate-exec-pdf';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import {
  X, FileText, Download, Calendar, Building2,
  AlertTriangle, Filter, ChevronDown, Sparkles,
  BarChart3, Zap, Layers, TrendingUp, CheckSquare,
} from 'lucide-react';
import { format, subMonths } from 'date-fns';

interface Props {
  open: boolean;
  onClose: () => void;
}

type ReportMode = ExecReportFilters['reportMode'];

const REPORT_MODES: Array<{
  id: ReportMode;
  label: string;
  description: string;
  icon: React.ElementType;
  pages: string;
  accent: string;
}> = [
  {
    id: 'full',
    label: 'Full Engineering Report',
    description: 'Complete 6+ page report with all sections, charts, risk matrix, and appendix.',
    icon: Layers,
    pages: '6+ pages',
    accent: 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  },
  {
    id: 'executive',
    label: 'Executive Summary',
    description: 'Cover, KPI dashboard, narrative insights, and action items — boardroom ready.',
    icon: Sparkles,
    pages: '3 pages',
    accent: 'border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300',
  },
  {
    id: 'snapshot',
    label: 'Management Snapshot',
    description: 'One-page KPI snapshot with health score and top action items.',
    icon: Zap,
    pages: '2 pages',
    accent: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  {
    id: 'kpi',
    label: 'Monthly KPI Report',
    description: 'KPIs, trend charts, and community engagement analytics.',
    icon: BarChart3,
    pages: '4 pages',
    accent: 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-300',
  },
  {
    id: 'workload',
    label: 'Engineering Workload',
    description: 'Risk matrix, workload forecast, model analysis, and issue register.',
    icon: TrendingUp,
    pages: '4 pages',
    accent: 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300',
  },
];

const STATUS_OPTIONS: Array<{ value: ExecReportFilters['statusFilter']; label: string }> = [
  { value: 'all', label: 'All Issues' },
  { value: 'open', label: 'Open / In Progress' },
  { value: 'closed', label: 'Resolved / Closed' },
];

const PROGRESS_STEPS = [
  'Connecting to live database…',
  'Fetching relay models and feedback data…',
  'Aggregating KPIs and computing trend deltas…',
  'Building risk matrix and family analysis…',
  'Generating executive narrative and insights…',
  'Rendering charts and dashboard sections…',
  'Composing PDF pages and typography…',
  'Finalising executive report layout…',
  'Applying branding and page headers…',
  'Download ready.',
];

export function ExecutiveReportModal({ open, onClose }: Props) {
  const { profile } = useAuth();
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [relayFamilies, setRelayFamilies] = useState<string[]>([]);
  const [step, setStep] = useState<'mode' | 'config' | 'generating' | 'done'>('mode');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [selectedMode, setSelectedMode] = useState<ReportMode>('full');

  const [filters, setFilters] = useState<ExecReportFilters>({
    dateFrom: format(subMonths(new Date(), 6), 'yyyy-MM-dd'),
    dateTo: format(new Date(), 'yyyy-MM-dd'),
    manufacturer: '',
    severity: '',
    relayFamily: '',
    statusFilter: 'all',
    ratingsFilter: 'all',
    reportMode: 'full',
  });

  useEffect(() => {
    if (!open) return;
    supabase.from('relay_models').select('manufacturer, relay_family').then(({ data }) => {
      if (!data) return;
      setManufacturers(Array.from(new Set(data.map(d => d.manufacturer).filter(Boolean))).sort());
      setRelayFamilies(Array.from(new Set(data.map(d => d.relay_family).filter(Boolean))).sort());
    });
  }, [open]);

  const handleGenerate = async () => {
    const finalFilters = { ...filters, reportMode: selectedMode };
    setStep('generating');
    setProgress(5);

    let stepIdx = 0;
    const tick = () => {
      if (stepIdx < PROGRESS_STEPS.length - 1) {
        stepIdx++;
        setProgressLabel(PROGRESS_STEPS[stepIdx]);
        setProgress(Math.min(85, 5 + stepIdx * 9));
      }
    };
    setProgressLabel(PROGRESS_STEPS[0]);

    const interval = setInterval(tick, 600);

    try {
      const data = await fetchExecReportData(finalFilters, profile?.full_name || profile?.email || 'Admin');

      clearInterval(interval);
      setProgress(90);
      setProgressLabel('Rendering PDF and applying final polish…');
      await new Promise(r => setTimeout(r, 200));

      await generateExecPDF(data);

      setProgress(100);
      setProgressLabel('Report downloaded successfully.');
      setStep('done');
      toast.success('Executive PDF report downloaded');
    } catch (err: any) {
      clearInterval(interval);
      toast.error(err?.message || 'Failed to generate report');
      setStep('config');
    }
  };

  const reset = () => {
    setStep('mode');
    setProgress(0);
    setProgressLabel('');
  };

  const handleClose = () => {
    if (step === 'generating') return;
    onClose();
    setTimeout(reset, 300);
  };

  if (!open) return null;

  const modeInfo = REPORT_MODES.find(m => m.id === selectedMode)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={step !== 'generating' ? handleClose : undefined} />

      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Modal header */}
        <div className="bg-gradient-to-r from-slate-900 via-[#0d1e40] to-slate-900 px-6 py-5 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 rounded-xl">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-white font-bold text-base leading-tight">Executive Report Generator</h2>
                <p className="text-blue-300/80 text-xs mt-0.5">Boardroom-quality PDF · Live data · Charts & KPIs</p>
              </div>
            </div>
            {step !== 'generating' && (
              <button onClick={handleClose} className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/10">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            {(['mode', 'config', 'generating', 'done'] as const).map((s, i) => {
              const labels = ['Report Type', 'Filters', 'Generating', 'Complete'];
              const active = s === step;
              const done = ['mode', 'config', 'generating', 'done'].indexOf(step) > i;
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${active ? 'text-white' : done ? 'text-teal-400' : 'text-slate-600'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border ${active ? 'bg-blue-500 border-blue-400 text-white' : done ? 'bg-teal-500 border-teal-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-600'}`}>
                      {done ? <CheckSquare className="w-3 h-3" /> : i + 1}
                    </div>
                    <span className="hidden sm:inline">{labels[i]}</span>
                  </div>
                  {i < 3 && <div className={`w-6 h-px ${done ? 'bg-teal-500' : 'bg-slate-700'}`} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal body */}
        <div className="overflow-y-auto flex-1 p-6">

          {/* STEP: MODE SELECTION */}
          {step === 'mode' && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-foreground">Select Report Type</p>
              <div className="grid grid-cols-1 gap-2.5">
                {REPORT_MODES.map(mode => {
                  const Icon = mode.icon;
                  const selected = selectedMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => setSelectedMode(mode.id)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-150 ${
                        selected
                          ? `${mode.accent} border-current`
                          : 'border-border hover:border-border/80 hover:bg-accent/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${selected ? 'bg-current/10' : 'bg-muted'}`}>
                          <Icon className={`w-4 h-4 ${selected ? 'text-current' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{mode.label}</span>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{mode.pages}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{mode.description}</p>
                        </div>
                        {selected && (
                          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                            <CheckSquare className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button onClick={handleClose} className="flex-1 px-4 py-2.5 text-sm border border-border rounded-xl hover:bg-accent transition-colors text-muted-foreground">
                  Cancel
                </button>
                <button
                  onClick={() => setStep('config')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20"
                >
                  Configure Filters
                  <ChevronDown className="w-4 h-4 -rotate-90" />
                </button>
              </div>
            </div>
          )}

          {/* STEP: FILTERS */}
          {step === 'config' && (
            <div className="space-y-4">
              {/* Selected mode chip */}
              <div className={`flex items-center gap-2 p-3 rounded-xl border-2 ${modeInfo.accent}`}>
                <modeInfo.icon className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold">{modeInfo.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{modeInfo.pages}</span>
                </div>
                <button onClick={() => setStep('mode')} className="text-xs text-muted-foreground hover:text-foreground transition-colors underline">Change</button>
              </div>

              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Filter className="w-4 h-4 text-blue-500" />
                Report Filters
                <span className="text-xs font-normal text-muted-foreground">(all optional)</span>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1.5">
                    <Calendar className="w-3 h-3" /> Date From
                  </label>
                  <input type="date" value={filters.dateFrom}
                    onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1.5">
                    <Calendar className="w-3 h-3" /> Date To
                  </label>
                  <input type="date" value={filters.dateTo}
                    onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                </div>
              </div>

              {/* Manufacturer + Relay Family */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1.5">
                    <Building2 className="w-3 h-3" /> Manufacturer
                  </label>
                  <div className="relative">
                    <select value={filters.manufacturer} onChange={e => setFilters(p => ({ ...p, manufacturer: e.target.value }))}
                      className="w-full px-3 py-2 pr-8 text-sm border border-border rounded-lg bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                      <option value="">All Manufacturers</option>
                      {manufacturers.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Relay Family</label>
                  <div className="relative">
                    <select value={filters.relayFamily} onChange={e => setFilters(p => ({ ...p, relayFamily: e.target.value }))}
                      className="w-full px-3 py-2 pr-8 text-sm border border-border rounded-lg bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                      <option value="">All Families</option>
                      {relayFamilies.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Severity + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1.5">
                    <AlertTriangle className="w-3 h-3" /> Severity Filter
                  </label>
                  <div className="relative">
                    <select value={filters.severity} onChange={e => setFilters(p => ({ ...p, severity: e.target.value }))}
                      className="w-full px-3 py-2 pr-8 text-sm border border-border rounded-lg bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                      <option value="">All Severities</option>
                      {['critical', 'high', 'medium', 'low'].map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Issue Status</label>
                  <div className="relative">
                    <select value={filters.statusFilter} onChange={e => setFilters(p => ({ ...p, statusFilter: e.target.value as ExecReportFilters['statusFilter'] }))}
                      className="w-full px-3 py-2 pr-8 text-sm border border-border rounded-lg bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                      {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* What's included */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-xl">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Included in this report
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    'Cover page with health gauge',
                    'Auto-generated executive narrative',
                    'KPI dashboard with trend arrows',
                    'Feedback & engagement trend charts',
                    'Severity donut & grade distribution',
                    'Manufacturer risk overview',
                    'Family risk matrix',
                    'Top risk templates ranked',
                    'Engineering workload forecast',
                    'Detailed issue appendix',
                  ].map(item => (
                    <div key={item} className="flex items-start gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                      <span className="text-teal-500 mt-0.5 flex-shrink-0">✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button onClick={() => setStep('mode')} className="flex-1 px-4 py-2.5 text-sm border border-border rounded-xl hover:bg-accent transition-colors text-muted-foreground">
                  Back
                </button>
                <button
                  onClick={handleGenerate}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-px"
                >
                  <Download className="w-4 h-4" />
                  Generate PDF Report
                </button>
              </div>
            </div>
          )}

          {/* STEP: GENERATING */}
          {step === 'generating' && (
            <div className="py-4 text-center space-y-5">
              {/* Animated rings */}
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-blue-900/40" />
                <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" style={{ animationDuration: '1s' }} />
                <div className="absolute inset-2 rounded-full border-2 border-teal-300/40 border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-blue-500" />
                </div>
              </div>

              <div>
                <p className="font-bold text-foreground text-base">Generating Executive Report</p>
                <p className="text-sm text-muted-foreground mt-1 min-h-[20px] transition-all">{progressLabel}</p>
              </div>

              {/* Segmented progress */}
              <div className="space-y-1.5">
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 via-blue-500 to-teal-400 rounded-full transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Processing live data…</span>
                  <span>{progress}%</span>
                </div>
              </div>

              {/* Section indicators */}
              <div className="grid grid-cols-4 gap-2">
                {['Data', 'Analysis', 'Charts', 'PDF'].map((s, i) => {
                  const done = progress > (i + 1) * 22;
                  const active = progress > i * 22 && !done;
                  return (
                    <div key={s} className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      done ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-400'
                      : active ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 animate-pulse'
                      : 'bg-muted border-border text-muted-foreground'
                    }`}>
                      {done ? '✓ ' : active ? '◌ ' : ''}{s}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP: DONE */}
          {step === 'done' && (
            <div className="py-4 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 bg-green-100 dark:bg-green-900/30 rounded-full animate-ping opacity-30" />
                <div className="relative w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <Download className="w-7 h-7 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div>
                <p className="font-bold text-foreground text-base">Report Downloaded</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your executive PDF report has been saved to your downloads folder.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  File: <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">TemplateEcho_Executive_Report_{format(new Date(), 'MMMM_yyyy')}.pdf</code>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={reset} className="flex-1 px-4 py-2.5 text-sm border border-border rounded-xl hover:bg-accent transition-colors">
                  Generate Another
                </button>
                <button onClick={handleClose} className="flex-1 px-4 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors">
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
