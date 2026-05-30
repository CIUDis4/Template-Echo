'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { RelayModel } from '@/lib/database.types';
import { computeCommunityGrade } from '@/lib/database.types';
import { TopNav } from '@/components/top-nav';
import { StatusBadge, GradeBadge, GRADE_VALUES } from '@/components/severity-badge';
import { useAuth } from '@/lib/auth-context';
import {
  Plus, Search, FileText, ExternalLink, ChevronLeft, ChevronRight,
  Star, TrendingUp, Users, X, MapPin, Loader2, Check,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface RaterInfo {
  user_id: string;
  quality_grade: string | null;
  popularity_grade: string | null;
  comment: string;
  created_at: string;
  full_name: string;
  email: string;
}

interface SightingInfo {
  user_id: string;
  full_name: string;
  email: string;
  count: number;
  created_at: string;
}

interface RatingAggregate {
  relay_model_id: string;
  quality_grade: string | null;
  popularity_grade: string | null;
  user_id: string;
  comment: string;
  created_at: string;
  profiles?: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
}

interface UsageRow {
  relay_model_id: string;
  user_id: string;
  count: number;
  created_at: string;
  profiles?: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
}

interface RelayModelWithMeta extends RelayModel {
  feedback_count: number;
  community_quality: string;
  community_popularity: string;
  rating_count: number;
  raters: RaterInfo[];
  total_sightings: number;
  sightings: SightingInfo[];
}

const MANUFACTURERS = ['All', 'ABB', 'ABB Westinghouse', 'Alstom', 'Basler', 'Beckwith', 'ERL', 'GE', 'Megger', 'Micom', 'Nari', 'PowerShield', 'Reyrole', 'SAS', 'Schneider', 'SEG', 'SEL', 'Sifang', 'SIEMENS', 'Woodward', 'ZIV', 'Alfanar_SEL'];
const STATUSES = ['All', 'active', 'deprecated', 'review'];
const GRADES = ['All', ...GRADE_VALUES];
const COUNT_FILTERS = ['All', '0', '1-5', '6-10', '11-25', '25+'] as const;
type CountFilter = typeof COUNT_FILTERS[number];
const PAGE_SIZE = 20;

function matchesCountFilter(total: number, filter: CountFilter): boolean {
  if (filter === 'All') return true;
  if (filter === '0') return total === 0;
  if (filter === '1-5') return total >= 1 && total <= 5;
  if (filter === '6-10') return total >= 6 && total <= 10;
  if (filter === '11-25') return total >= 11 && total <= 25;
  if (filter === '25+') return total > 25;
  return true;
}

function RatersPopover({ raters, onClose }: { raters: RaterInfo[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute z-50 top-full mt-1.5 left-1/2 -translate-x-1/2 w-72 bg-card border border-border rounded-xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/40">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {raters.length} Rater{raters.length !== 1 ? 's' : ''}</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="divide-y divide-border/50 max-h-64 overflow-y-auto">
        {raters.map((r, i) => (
          <div key={i} className="px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{r.full_name || r.email}</p>
                <p className="text-xs text-muted-foreground truncate">{r.full_name ? r.email : ''}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {r.quality_grade && <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5 text-muted-foreground" /><GradeBadge grade={r.quality_grade} /></span>}
                {r.popularity_grade && <span className="flex items-center gap-0.5"><TrendingUp className="w-2.5 h-2.5 text-muted-foreground" /><GradeBadge grade={r.popularity_grade} /></span>}
              </div>
            </div>
            {r.comment && <p className="text-xs text-muted-foreground italic mt-1 line-clamp-2">"{r.comment}"</p>}
            <p className="text-xs text-muted-foreground/60 mt-1">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SightingsModal({ model, sightings, onClose }: { model: RelayModelWithMeta; sightings: SightingInfo[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div>
            <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-500" /> Market Sightings
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {model.model_name} · {model.total_sightings} total sighting{model.total_sightings !== 1 ? 's' : ''} from {sightings.length} engineer{sightings.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><X className="w-4 h-4" /></button>
        </div>
        {sightings.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">No sightings reported yet.</div>
        ) : (
          <div className="divide-y divide-border/50 max-h-80 overflow-y-auto">
            {sightings.sort((a, b) => b.count - a.count).map(u => (
              <div key={u.user_id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-teal-700 dark:text-teal-400 text-xs font-semibold">{(u.full_name || u.email).charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{u.full_name || u.email}</p>
                  {u.full_name && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-bold text-teal-600 dark:text-teal-400">{u.count}</p>
                  <p className="text-xs text-muted-foreground">sighting{u.count !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="px-5 py-3 border-t border-border bg-muted/20">
          <p className="text-xs text-muted-foreground text-center">
            Each engineer reports how many customer sites they have seen this model deployed at.
          </p>
        </div>
      </div>
    </div>
  );
}

function CountCell({ model, userId, onSaved }: { model: RelayModelWithMeta; userId: string; onSaved: () => void }) {
  const mySighting = model.sightings.find(s => s.user_id === userId);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(mySighting?.count ?? ''));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = async () => {
    const n = parseInt(inputVal, 10);
    if (isNaN(n) || n < 1) { setEditing(false); setInputVal(String(mySighting?.count ?? '')); return; }
    setSaving(true);
    if (mySighting) {
      await supabase.from('template_usages').update({ count: n }).eq('relay_model_id', model.id).eq('user_id', userId);
    } else {
      await supabase.from('template_usages').insert({ relay_model_id: model.id, user_id: userId, count: n });
    }
    setSaving(false);
    setEditing(false);
    onSaved();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setEditing(false); setInputVal(String(mySighting?.count ?? '')); }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="number"
          min={1}
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={handleKey}
          className="w-14 px-1.5 py-0.5 text-xs border border-teal-400 rounded focus:outline-none focus:ring-1 focus:ring-teal-400 bg-background text-foreground"
        />
        <button onClick={handleSave} disabled={saving} className="p-0.5 rounded text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button onClick={e => { e.stopPropagation(); setEditing(false); setInputVal(String(mySighting?.count ?? '')); }} className="p-0.5 rounded text-muted-foreground hover:bg-accent transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); setInputVal(String(mySighting?.count ?? '')); setEditing(true); }}
      className={`opacity-0 group-hover:opacity-100 transition-all inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${
        mySighting
          ? 'bg-teal-500 text-white border-teal-500 hover:bg-teal-600 opacity-100'
          : 'bg-background text-muted-foreground border-border hover:text-teal-600 hover:border-teal-400'
      }`}
      title={mySighting ? `Your count: ${mySighting.count} — click to edit` : 'Add your sighting count'}
    >
      <MapPin className="w-3 h-3" />
      {mySighting ? mySighting.count : '+'}
    </button>
  );
}

export default function RelayModelsPage() {
  const { user, profile } = useAuth();
  const [models, setModels] = useState<RelayModelWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [manufacturer, setManufacturer] = useState('All');
  const [status, setStatus] = useState('All');
  const [qualityFilter, setQualityFilter] = useState('All');
  const [popularityFilter, setPopularityFilter] = useState('All');
  const [countFilter, setCountFilter] = useState<CountFilter>('All');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'model_name' | 'feedback_count' | 'updated_at' | 'rating_count' | 'total_sightings'>('model_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [openRatersModelId, setOpenRatersModelId] = useState<string | null>(null);
  const [sightingsModal, setSightingsModal] = useState<RelayModelWithMeta | null>(null);

  useEffect(() => { loadModels(); }, []);

  const loadModels = async () => {
    setLoading(true);
    const [modelsRes, feedbackRes, ratingsRes, usagesRes] = await Promise.all([
      supabase.from('relay_models').select('*').order('model_name', { ascending: true }),
      supabase.from('feedback_entries').select('relay_model_id'),
      supabase.from('relay_model_ratings').select('relay_model_id, user_id, quality_grade, popularity_grade, comment, created_at, profiles(full_name, email)').eq('is_flagged', false),
      supabase.from('template_usages').select('relay_model_id, user_id, count, created_at, profiles(full_name, email)'),
    ]);

    const feedbackCountMap = new Map<string, number>();
    (feedbackRes.data || []).forEach(f => { feedbackCountMap.set(f.relay_model_id, (feedbackCountMap.get(f.relay_model_id) || 0) + 1); });

    const ratingsByModel = new Map<string, RatingAggregate[]>();
    ((ratingsRes.data || []) as RatingAggregate[]).forEach(r => {
      const arr = ratingsByModel.get(r.relay_model_id) || [];
      arr.push(r);
      ratingsByModel.set(r.relay_model_id, arr);
    });

    const usagesByModel = new Map<string, UsageRow[]>();
    ((usagesRes.data || []) as UsageRow[]).forEach(u => {
      const arr = usagesByModel.get(u.relay_model_id) || [];
      arr.push(u);
      usagesByModel.set(u.relay_model_id, arr);
    });

    const enriched = (modelsRes.data || []).map(m => {
      const ratings = ratingsByModel.get(m.id) || [];
      const { grade: cq, count } = computeCommunityGrade(ratings, 'quality_grade');
      const { grade: cp } = computeCommunityGrade(ratings, 'popularity_grade');
      const raters: RaterInfo[] = ratings.map(r => {
        const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        return { user_id: r.user_id, quality_grade: r.quality_grade, popularity_grade: r.popularity_grade, comment: r.comment, created_at: r.created_at, full_name: p?.full_name || '', email: p?.email || '' };
      });

      const usages = usagesByModel.get(m.id) || [];
      const sightings: SightingInfo[] = usages.map(u => {
        const p = Array.isArray(u.profiles) ? u.profiles[0] : u.profiles;
        return { user_id: u.user_id, full_name: p?.full_name || '', email: p?.email || '', count: u.count, created_at: u.created_at };
      });
      const total_sightings = sightings.reduce((sum, s) => sum + s.count, 0);

      return { ...m, feedback_count: feedbackCountMap.get(m.id) || 0, community_quality: cq, community_popularity: cp, rating_count: count, raters, total_sightings, sightings };
    });

    setModels(enriched);
    setLoading(false);
  };

  const effectiveQuality = (m: RelayModelWithMeta) => m.official_quality_grade && m.official_quality_grade !== 'N/A' ? m.official_quality_grade : m.community_quality;
  const effectivePopularity = (m: RelayModelWithMeta) => m.official_popularity_grade && m.official_popularity_grade !== 'N/A' ? m.official_popularity_grade : m.community_popularity;

  const filtered = useMemo(() => {
    let result = models;
    if (search) { const q = search.toLowerCase(); result = result.filter(m => m.model_name.toLowerCase().includes(q) || m.manufacturer.toLowerCase().includes(q) || m.template_version.toLowerCase().includes(q)); }
    if (manufacturer !== 'All') result = result.filter(m => m.manufacturer === manufacturer);
    if (status !== 'All') result = result.filter(m => m.status === status);
    if (qualityFilter !== 'All') result = result.filter(m => effectiveQuality(m) === qualityFilter);
    if (popularityFilter !== 'All') result = result.filter(m => effectivePopularity(m) === popularityFilter);
    if (countFilter !== 'All') result = result.filter(m => matchesCountFilter(m.total_sightings, countFilter));
    result = [...result].sort((a, b) => {
      let valA: string | number, valB: string | number;
      if (sortBy === 'feedback_count') { valA = a.feedback_count; valB = b.feedback_count; }
      else if (sortBy === 'rating_count') { valA = a.rating_count; valB = b.rating_count; }
      else if (sortBy === 'total_sightings') { valA = a.total_sightings; valB = b.total_sightings; }
      else { valA = a[sortBy] as string; valB = b[sortBy] as string; }
      const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [models, search, manufacturer, status, qualityFilter, popularityFilter, countFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: typeof sortBy }) => {
    if (sortBy !== col) return <span className="text-muted-foreground/40 ml-1">↕</span>;
    return <span className="text-primary ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const isFiltered = search || manufacturer !== 'All' || status !== 'All' || qualityFilter !== 'All' || popularityFilter !== 'All' || countFilter !== 'All';

  return (
    <div>
      <TopNav
        title="Relay Models"
        description={`${filtered.length} models${isFiltered ? ' (filtered)' : ''}`}
        actions={
          profile?.role === 'admin' && (
            <Link href="/relay-models/new" className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Model
            </Link>
          )
        }
      />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" placeholder="Search models, manufacturers..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <select value={manufacturer} onChange={e => { setManufacturer(e.target.value); setPage(1); }} className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {MANUFACTURERS.map(m => <option key={m} value={m}>{m === 'All' ? 'All Manufacturers' : m}</option>)}
            </select>
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {STATUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-muted-foreground" />
              <select value={qualityFilter} onChange={e => { setQualityFilter(e.target.value); setPage(1); }} className="px-3 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {GRADES.map(g => <option key={g} value={g}>{g === 'All' ? 'Quality: All' : `Quality: ${g}`}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
              <select value={popularityFilter} onChange={e => { setPopularityFilter(e.target.value); setPage(1); }} className="px-3 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {GRADES.map(g => <option key={g} value={g}>{g === 'All' ? 'Popularity: All' : `Popularity: ${g}`}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              <select value={countFilter} onChange={e => { setCountFilter(e.target.value as CountFilter); setPage(1); }} className="px-3 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {COUNT_FILTERS.map(f => <option key={f} value={f}>{f === 'All' ? 'Count: All' : `Count: ${f}`}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <button onClick={() => handleSort('model_name')} className="hover:text-foreground transition-colors">Model Name <SortIcon col="model_name" /></button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Manufacturer</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cloud Min RTMS</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <span className="flex items-center gap-1"><Star className="w-3 h-3" /> Quality</span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Popularity</span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <button onClick={() => handleSort('total_sightings')} className="hover:text-foreground transition-colors flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Count <SortIcon col="total_sightings" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <button onClick={() => handleSort('rating_count')} className="hover:text-foreground transition-colors flex items-center gap-1">
                      <Users className="w-3 h-3" /> Raters <SortIcon col="rating_count" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">PDF</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <button onClick={() => handleSort('feedback_count')} className="hover:text-foreground transition-colors">Issues <SortIcon col="feedback_count" /></button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <button onClick={() => handleSort('updated_at')} className="hover:text-foreground transition-colors">Updated <SortIcon col="updated_at" /></button>
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {[...Array(12)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}
                    </tr>
                  ))
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={12} className="px-4 py-12 text-center text-muted-foreground">No relay models found</td></tr>
                ) : (
                  paginated.map(model => {
                    const displayQuality = effectiveQuality(model);
                    const displayPopularity = effectivePopularity(model);
                    const isOfficialQ = model.official_quality_grade && model.official_quality_grade !== 'N/A';
                    const isOfficialP = model.official_popularity_grade && model.official_popularity_grade !== 'N/A';
                    const ratersOpen = openRatersModelId === model.id;

                    return (
                      <tr key={model.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors group">
                        <td className="px-4 py-3">
                          <Link href={`/relay-models/${model.id}`} className="font-medium text-foreground hover:text-primary transition-colors">{model.model_name}</Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{model.manufacturer}</td>
                        <td className="px-4 py-3">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{model.template_version || '—'}</code>
                        </td>
                        <td className="px-4 py-3"><StatusBadge value={model.status} type="model-status" /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5" title={isOfficialQ ? 'Official grade set by admin' : `Based on ${model.rating_count} user rating${model.rating_count !== 1 ? 's' : ''}`}>
                            <GradeBadge grade={displayQuality} />{isOfficialQ && <span className="text-xs text-muted-foreground font-medium">✓</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5" title={isOfficialP ? 'Official grade set by admin' : `Based on ${model.rating_count} user rating${model.rating_count !== 1 ? 's' : ''}`}>
                            <GradeBadge grade={displayPopularity} />{isOfficialP && <span className="text-xs text-muted-foreground font-medium">✓</span>}
                          </div>
                        </td>

                        {/* Count cell */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {model.total_sightings > 0 ? (
                              <button
                                onClick={e => { e.stopPropagation(); setSightingsModal(model); }}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800/50 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors"
                                title={`${model.total_sightings} total sightings from ${model.sightings.length} engineer${model.sightings.length !== 1 ? 's' : ''} — click to view`}
                              >
                                <MapPin className="w-3 h-3" /> {model.total_sightings}
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">—</span>
                            )}
                            {user && (
                              <CountCell model={model} userId={user.id} onSaved={loadModels} />
                            )}
                          </div>
                        </td>

                        {/* Raters cell */}
                        <td className="px-4 py-3">
                          {model.raters.length > 0 ? (
                            <div className="relative">
                              <button
                                onClick={e => { e.stopPropagation(); setOpenRatersModelId(ratersOpen ? null : model.id); }}
                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${ratersOpen ? 'bg-primary/10 text-primary border border-primary/30' : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent'}`}
                              >
                                <Users className="w-3 h-3" /> {model.raters.length}
                              </button>
                              {ratersOpen && <RatersPopover raters={model.raters} onClose={() => setOpenRatersModelId(null)} />}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {model.has_pdf ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400"><FileText className="w-3 h-3" /> Yes</span>
                          ) : <span className="text-xs text-muted-foreground">No</span>}
                        </td>
                        <td className="px-4 py-3">
                          {model.feedback_count > 0 ? (
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${model.feedback_count >= 5 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : model.feedback_count >= 3 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                              {model.feedback_count}
                            </span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{model.cloud_mod_date ? new Date(model.cloud_mod_date).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3">
                          <Link href={`/relay-models/${model.id}`} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-accent">
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
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

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="font-medium">✓</span> Official admin grade</span>
          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Click rater count to see who rated</span>
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-teal-500" /> Count = total market sightings — click to view breakdown</span>
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Hover a row to add or edit your own sighting count</span>
        </div>
      </div>

      {sightingsModal && (
        <SightingsModal
          model={sightingsModal}
          sightings={sightingsModal.sightings}
          onClose={() => setSightingsModal(null)}
        />
      )}
    </div>
  );
}
