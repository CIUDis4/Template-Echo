'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { TopNav } from '@/components/top-nav';
import { StatusBadge } from '@/components/severity-badge';
import { formatDistanceToNow } from 'date-fns';
import { Search, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

interface FeedbackRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  estimated_fix_hours: number;
  created_at: string;
  relay_model_name: string;
  relay_model_id: string;
  user_name: string;
}

const PAGE_SIZE = 25;

export default function FeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('All');
  const [status, setStatus] = useState('All');
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('feedback_entries')
      .select('*, relay_models(model_name), profiles(full_name, email)')
      .order('created_at', { ascending: false });

    const rows: FeedbackRow[] = (data || []).map((f: any) => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      status: f.status,
      estimated_fix_hours: f.estimated_fix_hours,
      created_at: f.created_at,
      relay_model_name: f.relay_models?.model_name || 'Unknown',
      relay_model_id: f.relay_model_id,
      user_name: f.profiles?.full_name || f.profiles?.email || 'Unknown',
    }));

    setFeedback(rows);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    let result = feedback;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(f =>
        f.title.toLowerCase().includes(q) ||
        f.relay_model_name.toLowerCase().includes(q) ||
        f.user_name.toLowerCase().includes(q)
      );
    }
    if (severity !== 'All') result = result.filter(f => f.severity === severity);
    if (status !== 'All') result = result.filter(f => f.status === status);
    return result;
  }, [feedback, search, severity, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <TopNav
        title="Feedback Entries"
        description={`${filtered.length} entries${search || severity !== 'All' || status !== 'All' ? ' (filtered)' : ''}`}
      />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search feedback..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={severity}
            onChange={e => { setSeverity(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {['All', 'critical', 'high', 'medium', 'low'].map(s => (
              <option key={s} value={s}>{s === 'All' ? 'All Severities' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {['All', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
              <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </select>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Relay Model</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Severity</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Submitter</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Est. Hours</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {[...Array(7)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      No feedback entries found
                    </td>
                  </tr>
                ) : paginated.map(f => (
                  <tr key={f.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/relay-models/${f.relay_model_id}`}
                        className="font-medium text-foreground hover:text-primary transition-colors line-clamp-1"
                      >
                        {f.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/relay-models/${f.relay_model_id}`}
                        className="text-muted-foreground hover:text-primary transition-colors text-xs"
                      >
                        {f.relay_model_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><StatusBadge value={f.severity} type="severity" /></td>
                    <td className="px-4 py-3"><StatusBadge value={f.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{f.user_name}</td>
                    <td className="px-4 py-3">
                      {f.estimated_fix_hours > 0 ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {f.estimated_fix_hours}h
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-40 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 text-sm text-muted-foreground">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-40 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
