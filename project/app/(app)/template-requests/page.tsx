'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { TopNav } from '@/components/top-nav';
import {
  Plus, Search, ChevronLeft, ChevronRight, ThumbsUp, Filter, ArrowUpDown, FileInput,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  TR_STATUSES, TR_PRIORITIES, TR_MANUFACTURERS, TR_ASSIGNEES,
  TR_STATUS_COLORS, TR_PRIORITY_COLORS,
} from '@/lib/database.types';
import type { TemplateRequest, TRStatus, TRPriority } from '@/lib/database.types';

interface TRRow extends TemplateRequest {
  vote_count: number;
  my_vote: boolean;
  comment_count: number;
  submitter_name: string;
}

const PAGE_SIZE = 25;
type SortCol = 'request_number' | 'title' | 'priority' | 'status' | 'vote_count' | 'created_at' | 'updated_at';

export default function TemplateRequestsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<TRRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [mfrFilter, setMfrFilter] = useState('All');
  const [assigneeFilter, setAssigneeFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortCol>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [reqRes, votesRes, commentsRes, profilesRes] = await Promise.all([
      supabase.from('template_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('template_request_votes').select('request_id, user_id'),
      supabase.from('template_request_comments').select('request_id').eq('is_internal', false),
      supabase.from('profiles').select('id, full_name, email'),
    ]);
    const pm = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
    const vm = new Map<string, string[]>();
    (votesRes.data || []).forEach((v: any) => { const a = vm.get(v.request_id) || []; a.push(v.user_id); vm.set(v.request_id, a); });
    const cm = new Map<string, number>();
    (commentsRes.data || []).forEach((c: any) => cm.set(c.request_id, (cm.get(c.request_id) || 0) + 1));
    setRows(((reqRes.data || []) as TemplateRequest[]).map(r => {
      const voters = vm.get(r.id) || [];
      const p: any = pm.get(r.submitted_by);
      return { ...r, vote_count: voters.length, my_vote: !!user && voters.includes(user.id), comment_count: cm.get(r.id) || 0, submitter_name: p?.full_name || p?.email || 'Unknown' };
    }));
    setLoading(false);
  };

  const handleVote = async (e: React.MouseEvent, req: TRRow) => {
    e.preventDefault();
    if (!user) return;
    if (req.my_vote) {
      await supabase.from('template_request_votes').delete().eq('request_id', req.id).eq('user_id', user.id);
    } else {
      await supabase.from('template_request_votes').insert({ request_id: req.id, user_id: user.id });
    }
    load();
  };

  const filtered = useMemo(() => {
    let r = rows;
    if (search) { const q = search.toLowerCase(); r = r.filter(x => x.title.toLowerCase().includes(q) || x.relay_model.toLowerCase().includes(q) || x.manufacturer.toLowerCase().includes(q)); }
    if (statusFilter !== 'All') r = r.filter(x => x.status === statusFilter);
    if (priorityFilter !== 'All') r = r.filter(x => x.priority === priorityFilter);
    if (mfrFilter !== 'All') r = r.filter(x => x.manufacturer === mfrFilter);
    if (assigneeFilter !== 'All') r = r.filter(x => x.assigned_to_name === assigneeFilter);
    return [...r].sort((a, b) => {
      const va = a[sortBy] as string | number, vb = b[sortBy] as string | number;
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, search, statusFilter, priorityFilter, mfrFilter, assigneeFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const isFiltered = search || statusFilter !== 'All' || priorityFilter !== 'All' || mfrFilter !== 'All' || assigneeFilter !== 'All';

  const sort = (col: SortCol) => { if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(col); setSortDir('desc'); } setPage(1); };
  const SortIcon = ({ col }: { col: SortCol }) => <ArrowUpDown className={`inline w-3 h-3 ml-1 ${sortBy === col ? 'text-primary' : 'text-muted-foreground/40'}`} />;

  const stat = (label: string, val: number, color: string) => (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg flex-shrink-0 ${color}`}><FileInput className="w-4 h-4" /></div>
      <div>
        <p className="text-2xl font-bold text-foreground">{loading ? '—' : val}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );

  return (
    <div>
      <TopNav
        title="Template Requests"
        description={`${filtered.length} request${filtered.length !== 1 ? 's' : ''}${isFiltered ? ' (filtered)' : ''}`}
        actions={
          <Link href="/template-requests/new" className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Request
          </Link>
        }
      />
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stat('Total Requests', rows.length, 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400')}
          {stat('Under Review', rows.filter(r => r.status === 'Under Review').length, 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400')}
          {stat('Approved', rows.filter(r => r.status === 'Approved').length, 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400')}
          {stat('Released', rows.filter(r => r.status === 'Released').length, 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400')}
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Search title, model, manufacturer…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            {([
              [statusFilter, setStatusFilter, ['All', ...TR_STATUSES], 'Status'],
              [priorityFilter, setPriorityFilter, ['All', ...TR_PRIORITIES], 'Priority'],
              [mfrFilter, setMfrFilter, ['All', ...TR_MANUFACTURERS], 'Manufacturer'],
              [assigneeFilter, setAssigneeFilter, ['All', ...TR_ASSIGNEES], 'Assignee'],
            ] as [string, (v: string) => void, string[], string][]).map(([val, setter, opts, label]) => (
              <select key={label} value={val} onChange={e => { setter(e.target.value); setPage(1); }}
                className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {opts.map(o => <option key={o} value={o}>{o === 'All' ? `All ${label}s` : o}</option>)}
              </select>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {([
                    ['ID', 'request_number', 'w-16'],
                    ['Title', 'title', ''],
                    ['Manufacturer', null, 'whitespace-nowrap'],
                    ['Relay Model', null, 'whitespace-nowrap'],
                    ['Type', null, ''],
                    ['Priority', 'priority', ''],
                    ['Status', 'status', ''],
                    ['Assigned To', null, 'whitespace-nowrap'],
                    ['Support', 'vote_count', ''],
                    ['Submitted By', null, 'whitespace-nowrap'],
                    ['Created', 'created_at', 'whitespace-nowrap'],
                    ['Updated', 'updated_at', 'whitespace-nowrap'],
                  ] as [string, SortCol | null, string][]).map(([h, col, cls]) => (
                    <th key={h} className={`text-left px-4 py-3 text-xs font-medium text-muted-foreground ${cls}`}>
                      {col ? <button onClick={() => sort(col)} className="hover:text-foreground">{h} <SortIcon col={col} /></button> : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {[...Array(12)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}
                    </tr>
                  ))
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={12} className="px-4 py-14 text-center text-muted-foreground text-sm">
                    {isFiltered ? 'No requests match your filters.' : 'No template requests yet. Be the first to submit one!'}
                  </td></tr>
                ) : paginated.map(req => (
                  <tr key={req.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">#{req.request_number}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <Link href={`/template-requests/${req.id}`} className="font-medium text-foreground hover:text-primary transition-colors line-clamp-2">{req.title}</Link>
                      {req.comment_count > 0 && <span className="text-xs text-muted-foreground ml-1">· {req.comment_count} comment{req.comment_count !== 1 ? 's' : ''}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{req.manufacturer}</td>
                    <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">{req.relay_model}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full whitespace-nowrap">{req.request_type}</span></td>
                    <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${TR_PRIORITY_COLORS[req.priority as TRPriority] || ''}`}>{req.priority}</span></td>
                    <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${TR_STATUS_COLORS[req.status as TRStatus] || ''}`}>{req.status}</span></td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {req.assigned_to_name
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">{req.assigned_to_name}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={e => handleVote(e, req)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${req.my_vote ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600' : 'bg-background text-muted-foreground border-border hover:text-blue-600 hover:border-blue-400'}`}
                        title={req.my_vote ? 'Remove your support' : 'Support this request'}>
                        <ThumbsUp className="w-3 h-3" />{req.vote_count}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{req.submitter_name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(req.updated_at), { addSuffix: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                <span className="px-3 text-sm text-muted-foreground">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
