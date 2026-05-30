'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { TopNav } from '@/components/top-nav';
import type { DriverBug, BugStatus, BugPriority, BugSeverity } from '@/lib/database.types';
import {
  BUG_STATUSES, BUG_PRIORITIES, BUG_SEVERITIES,
  statusColor, priorityColor, severityColor, formatBugId,
} from '@/lib/bug-utils';
import {
  Plus, Search, Bug, AlertTriangle, CheckCircle2, Clock,
  ChevronLeft, ChevronRight, BarChart3, User, Filter,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface BugRow extends DriverBug {
  reporter_name: string;
  assigned_name: string | null;
}

const PAGE_SIZE = 25;

export default function BugsPage() {
  const { user, profile } = useAuth();
  const [bugs, setBugs] = useState<BugRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BugStatus | 'All'>('All');
  const [priorityFilter, setPriorityFilter] = useState<BugPriority | 'All'>('All');
  const [severityFilter, setSeverityFilter] = useState<BugSeverity | 'All'>('All');
  const [assigneeFilter, setAssigneeFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'priority' | 'severity' | 'bug_number'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => { loadBugs(); }, []);

  const loadBugs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('driver_bugs')
      .select('*, reporter:profiles!reporter_id(full_name, email), assignee:profiles!assigned_to_id(full_name, email)')
      .order('created_at', { ascending: false });

    const rows: BugRow[] = (data || []).map((b: any) => ({
      ...b,
      reporter_name: b.reporter?.full_name || b.reporter?.email || 'Unknown',
      assigned_name: b.assignee ? (b.assignee.full_name || b.assignee.email) : null,
    }));

    setBugs(rows);
    setLoading(false);
  };

  const allAssignees = useMemo(() => {
    const names = new Set<string>();
    bugs.forEach(b => { if (b.assigned_name) names.add(b.assigned_name); });
    return Array.from(names).sort();
  }, [bugs]);

  const filtered = useMemo(() => {
    let result = bugs;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(b =>
        b.title.toLowerCase().includes(q) ||
        formatBugId(b.bug_number).toLowerCase().includes(q) ||
        b.software_version.toLowerCase().includes(q) ||
        b.reporter_name.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'All') result = result.filter(b => b.status === statusFilter);
    if (priorityFilter !== 'All') result = result.filter(b => b.priority === priorityFilter);
    if (severityFilter !== 'All') result = result.filter(b => b.severity === severityFilter);
    if (assigneeFilter !== 'All') result = result.filter(b => b.assigned_name === assigneeFilter);

    const priorityOrder: Record<BugPriority, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
    const severityOrder: Record<BugSeverity, number> = { Blocker: 4, Critical: 3, Major: 2, Minor: 1 };
    result = [...result].sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === 'priority') { va = priorityOrder[a.priority as BugPriority]; vb = priorityOrder[b.priority as BugPriority]; }
      else if (sortBy === 'severity') { va = severityOrder[a.severity as BugSeverity]; vb = severityOrder[b.severity as BugSeverity]; }
      else if (sortBy === 'bug_number') { va = a.bug_number; vb = b.bug_number; }
      else { va = a[sortBy]; vb = b[sortBy]; }
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [bugs, search, statusFilter, priorityFilter, severityFilter, assigneeFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: typeof sortBy }) => {
    if (sortBy !== col) return <span className="text-muted-foreground/40 ml-1">↕</span>;
    return <span className="text-primary ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // Stats
  const openCount = bugs.filter(b => !['Resolved', 'Closed', 'Rejected', 'Duplicate'].includes(b.status)).length;
  const criticalCount = bugs.filter(b => (b.severity === 'Critical' || b.severity === 'Blocker') && !['Resolved', 'Closed', 'Rejected'].includes(b.status)).length;
  const resolvedCount = bugs.filter(b => b.status === 'Resolved' || b.status === 'Closed').length;
  const urgentCount = bugs.filter(b => b.priority === 'Urgent' && !['Resolved', 'Closed', 'Rejected'].includes(b.status)).length;

  return (
    <div>
      <TopNav
        title="Driver Bug Tracker"
        description={`${filtered.length} bug${filtered.length !== 1 ? 's' : ''}${search || statusFilter !== 'All' || priorityFilter !== 'All' || severityFilter !== 'All' ? ' (filtered)' : ''}`}
        actions={
          user && (
            <Link
              href="/bugs/new"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Report Bug
            </Link>
          )
        }
      />

      <div className="p-6 space-y-5">

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Open Bugs', value: openCount, icon: Bug, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
            { label: 'Critical / Blocker', value: criticalCount, icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
            { label: 'Urgent Priority', value: urgentCount, icon: Clock, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
            { label: 'Resolved / Closed', value: resolvedCount, icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
          ].map(s => (
            <div key={s.label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-border ${s.bg}`}>
              <s.icon className={`w-5 h-5 flex-shrink-0 ${s.color}`} />
              <div>
                <p className={`text-xl font-bold leading-none ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="w-4 h-4" /> Filters
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search ID, title, version, reporter…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }} className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="All">All Statuses</option>
              {BUG_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value as any); setPage(1); }} className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="All">All Priorities</option>
              {BUG_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={severityFilter} onChange={e => { setSeverityFilter(e.target.value as any); setPage(1); }} className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="All">All Severities</option>
              {BUG_SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={assigneeFilter} onChange={e => { setAssigneeFilter(e.target.value); setPage(1); }} className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="All">All Assignees</option>
              <option value="Unassigned">Unassigned</option>
              {allAssignees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    <button onClick={() => handleSort('bug_number')} className="hover:text-foreground transition-colors">Bug ID <SortIcon col="bug_number" /></button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    <button onClick={() => handleSort('priority')} className="hover:text-foreground transition-colors">Priority <SortIcon col="priority" /></button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    <button onClick={() => handleSort('severity')} className="hover:text-foreground transition-colors">Severity <SortIcon col="severity" /></button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Version</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Reported By</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Assigned To</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    <button onClick={() => handleSort('created_at')} className="hover:text-foreground transition-colors">Created <SortIcon col="created_at" /></button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    <button onClick={() => handleSort('updated_at')} className="hover:text-foreground transition-colors">Updated <SortIcon col="updated_at" /></button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {[...Array(10)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}
                    </tr>
                  ))
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center">
                      <Bug className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">No bugs found</p>
                      {user && <Link href="/bugs/new" className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"><Plus className="w-3.5 h-3.5" />Report the first bug</Link>}
                    </td>
                  </tr>
                ) : (
                  paginated.map(bug => (
                    <tr key={bug.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors group">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link href={`/bugs/${bug.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{formatBugId(bug.bug_number)}</Link>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <Link href={`/bugs/${bug.id}`} className="font-medium text-foreground hover:text-primary transition-colors line-clamp-2">{bug.title}</Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(bug.status as any)}`}>{bug.status}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priorityColor(bug.priority as any)}`}>{bug.priority}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${severityColor(bug.severity as any)}`}>{bug.severity}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {bug.software_version ? <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{bug.software_version}</code> : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-medium">{bug.reporter_name.charAt(0).toUpperCase()}</span>
                          </div>
                          <span className="text-xs text-muted-foreground truncate max-w-[100px]">{bug.reporter_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {bug.assigned_name ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-medium text-blue-700 dark:text-blue-400">{bug.assigned_name.charAt(0).toUpperCase()}</span>
                            </div>
                            <span className="text-xs text-muted-foreground truncate max-w-[100px]">{bug.assigned_name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/50 flex items-center gap-1"><User className="w-3 h-3" /> Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{formatDistanceToNow(new Date(bug.created_at), { addSuffix: true })}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{formatDistanceToNow(new Date(bug.updated_at), { addSuffix: true })}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                <span className="px-3 text-sm text-muted-foreground">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>

        {/* Charts section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BugsByStatus bugs={bugs} />
          <BugsBySeverity bugs={bugs} />
          <BugsByPriority bugs={bugs} />
        </div>
      </div>
    </div>
  );
}

function BugsByStatus({ bugs }: { bugs: BugRow[] }) {
  const counts = BUG_STATUSES.map(s => ({ label: s, count: bugs.filter(b => b.status === s).length })).filter(x => x.count > 0);
  const max = Math.max(...counts.map(x => x.count), 1);
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-500" /> Bugs by Status</h3>
      <div className="space-y-2">
        {counts.map(({ label, count }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-24 truncate">{label}</span>
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <span className="text-xs font-semibold text-foreground w-6 text-right">{count}</span>
          </div>
        ))}
        {counts.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No bugs yet</p>}
      </div>
    </div>
  );
}

function BugsBySeverity({ bugs }: { bugs: BugRow[] }) {
  const colors: Record<string, string> = { Blocker: 'bg-red-500', Critical: 'bg-orange-500', Major: 'bg-amber-500', Minor: 'bg-slate-400' };
  const counts = BUG_SEVERITIES.map(s => ({ label: s, count: bugs.filter(b => b.severity === s).length })).filter(x => x.count > 0);
  const max = Math.max(...counts.map(x => x.count), 1);
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-500" /> Bugs by Severity</h3>
      <div className="space-y-2">
        {counts.map(({ label, count }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16 truncate">{label}</span>
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
              <div className={`h-full ${colors[label] || 'bg-slate-400'} rounded-full transition-all`} style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <span className="text-xs font-semibold text-foreground w-6 text-right">{count}</span>
          </div>
        ))}
        {counts.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No bugs yet</p>}
      </div>
    </div>
  );
}

function BugsByPriority({ bugs }: { bugs: BugRow[] }) {
  const colors: Record<string, string> = { Urgent: 'bg-red-500', High: 'bg-orange-500', Medium: 'bg-blue-500', Low: 'bg-slate-400' };
  const counts = BUG_PRIORITIES.map(p => ({ label: p, count: bugs.filter(b => b.priority === p).length })).filter(x => x.count > 0);
  const max = Math.max(...counts.map(x => x.count), 1);
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /> Bugs by Priority</h3>
      <div className="space-y-2">
        {counts.map(({ label, count }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16 truncate">{label}</span>
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
              <div className={`h-full ${colors[label] || 'bg-slate-400'} rounded-full transition-all`} style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <span className="text-xs font-semibold text-foreground w-6 text-right">{count}</span>
          </div>
        ))}
        {counts.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No bugs yet</p>}
      </div>
    </div>
  );
}
