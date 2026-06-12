'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { TopNav } from '@/components/top-nav';
import {
  History, ChevronLeft, Search, Filter, CheckCircle2, XCircle,
  Clock, AlertTriangle, RefreshCw, Mail,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { EVENT_TYPES } from '@/lib/notification-constants';

interface NotificationLog {
  id: string;
  event_type: string;
  event_id: string | null;
  subject: string;
  recipients: string[];
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;

const statusBadge = (status: string) => {
  switch (status) {
    case 'sent':    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'failed':  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'skipped': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    default:        return 'bg-muted text-muted-foreground';
  }
};

const statusIcon = (status: string) => {
  switch (status) {
    case 'sent':    return <CheckCircle2 className="w-3.5 h-3.5" />;
    case 'failed':  return <XCircle className="w-3.5 h-3.5" />;
    case 'pending': return <Clock className="w-3.5 h-3.5" />;
    default:        return <AlertTriangle className="w-3.5 h-3.5" />;
  }
};

export default function NotificationHistoryPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (profile && profile.role !== 'admin') { router.replace('/dashboard'); return; }
    load();
  }, [profile]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notification_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    setLogs((data || []) as NotificationLog[]);
    setLoading(false);
  };

  const filtered = logs.filter(l => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (eventFilter !== 'all' && l.event_type !== eventFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!l.subject.toLowerCase().includes(q) && !l.event_type.toLowerCase().includes(q) && !l.recipients.some(r => r.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const eventLabel = (id: string) => EVENT_TYPES.find(e => e.id === id)?.label || id;

  // Stats
  const sent    = logs.filter(l => l.status === 'sent').length;
  const failed  = logs.filter(l => l.status === 'failed').length;
  const pending = logs.filter(l => l.status === 'pending').length;

  return (
    <div>
      <TopNav
        title="Notification History"
        description="Log of all dispatched notification emails"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <Link href="/admin/notifications" className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </Link>
          </div>
        }
      />

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Logged', value: logs.length, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
            { label: 'Sent', value: sent, color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
            { label: 'Failed', value: failed, color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
            { label: 'Pending', value: pending, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg flex-shrink-0 ${s.color}`}><Mail className="w-4 h-4" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{loading ? '—' : s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Search subject, event, recipients…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="all">All Statuses</option>
              {['pending', 'sent', 'failed', 'skipped'].map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <select value={eventFilter} onChange={e => { setEventFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="all">All Events</option>
              {EVENT_TYPES.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Event</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Subject</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Recipients</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}
                    </tr>
                  ))
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-14 text-center text-sm text-muted-foreground">
                    {logs.length === 0 ? 'No notifications have been sent yet.' : 'No results match your filters.'}
                  </td></tr>
                ) : paginated.map(log => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full whitespace-nowrap">{eventLabel(log.event_type)}</span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-sm text-foreground truncate">{log.subject || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {log.recipients.slice(0, 3).map((r, i) => (
                          <span key={i} className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{r}</span>
                        ))}
                        {log.recipients.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{log.recipients.length - 3} more</span>
                        )}
                        {log.recipients.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(log.status)}`}>
                        {statusIcon(log.status)} {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                      </span>
                      {log.error_message && <p className="text-xs text-red-500 mt-0.5 max-w-xs truncate">{log.error_message}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), 'dd MMM yyyy HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent disabled:opacity-40">Prev</button>
                <span className="px-3 text-sm text-muted-foreground">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
