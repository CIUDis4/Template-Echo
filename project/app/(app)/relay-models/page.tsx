'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { RelayModel } from '@/lib/database.types';
import { computeCommunityGrade } from '@/lib/database.types';
import { TopNav } from '@/components/top-nav';
import { StatusBadge, GradeBadge, GRADE_VALUES } from '@/components/severity-badge';
import { useAuth } from '@/lib/auth-context';
import { Plus, Search, FileText, ExternalLink, ChevronLeft, ChevronRight, Star, TrendingUp, Users } from 'lucide-react';

interface RatingAggregate {
  relay_model_id: string;
  quality_grade: string | null;
  popularity_grade: string | null;
}

interface RelayModelWithMeta extends RelayModel {
  feedback_count: number;
  community_quality: string;
  community_popularity: string;
  rating_count: number;
}

const MANUFACTURERS = ['All', 'ABB', 'ABB Westinghouse', 'Alstom', 'Basler', 'Beckwith', 'ERL', 'GE', 'Megger', 'Micom', 'Nari', 'PowerShield', 'Reyrole', 'SAS', 'Schneider', 'SEG', 'SEL', 'Sifang', 'SIEMENS', 'Woodward', 'ZIV', 'Alfanar_SEL'];
const STATUSES = ['All', 'active', 'deprecated', 'review'];
const GRADES = ['All', ...GRADE_VALUES];
const PAGE_SIZE = 20;

export default function RelayModelsPage() {
  const { profile } = useAuth();
  const [models, setModels] = useState<RelayModelWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [manufacturer, setManufacturer] = useState('All');
  const [status, setStatus] = useState('All');
  const [qualityFilter, setQualityFilter] = useState('All');
  const [popularityFilter, setPopularityFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'model_name' | 'feedback_count' | 'updated_at' | 'rating_count'>('model_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setLoading(true);
    const [modelsRes, feedbackRes, ratingsRes] = await Promise.all([
      supabase.from('relay_models').select('*').order('model_name', { ascending: true }),
      supabase.from('feedback_entries').select('relay_model_id'),
      supabase.from('relay_model_ratings').select('relay_model_id, quality_grade, popularity_grade').eq('is_flagged', false),
    ]);

    const feedbackCountMap = new Map<string, number>();
    (feedbackRes.data || []).forEach(f => {
      feedbackCountMap.set(f.relay_model_id, (feedbackCountMap.get(f.relay_model_id) || 0) + 1);
    });

    // Group ratings by model
    const ratingsByModel = new Map<string, RatingAggregate[]>();
    (ratingsRes.data || []).forEach(r => {
      const arr = ratingsByModel.get(r.relay_model_id) || [];
      arr.push(r);
      ratingsByModel.set(r.relay_model_id, arr);
    });

    const enriched = (modelsRes.data || []).map(m => {
      const ratings = ratingsByModel.get(m.id) || [];
      const { grade: cq, count } = computeCommunityGrade(ratings, 'quality_grade');
      const { grade: cp } = computeCommunityGrade(ratings, 'popularity_grade');
      return {
        ...m,
        feedback_count: feedbackCountMap.get(m.id) || 0,
        community_quality: cq,
        community_popularity: cp,
        rating_count: count,
      };
    });

    setModels(enriched);
    setLoading(false);
  };

  // Effective display grade: official if set, else community
  const effectiveQuality = (m: RelayModelWithMeta) =>
    m.official_quality_grade && m.official_quality_grade !== 'N/A' ? m.official_quality_grade : m.community_quality;
  const effectivePopularity = (m: RelayModelWithMeta) =>
    m.official_popularity_grade && m.official_popularity_grade !== 'N/A' ? m.official_popularity_grade : m.community_popularity;

  const filtered = useMemo(() => {
    let result = models;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(m =>
        m.model_name.toLowerCase().includes(q) ||
        m.manufacturer.toLowerCase().includes(q) ||
        m.template_version.toLowerCase().includes(q)
      );
    }
    if (manufacturer !== 'All') result = result.filter(m => m.manufacturer === manufacturer);
    if (status !== 'All') result = result.filter(m => m.status === status);
    if (qualityFilter !== 'All') result = result.filter(m => effectiveQuality(m) === qualityFilter);
    if (popularityFilter !== 'All') result = result.filter(m => effectivePopularity(m) === popularityFilter);

    result = [...result].sort((a, b) => {
      let valA: string | number;
      let valB: string | number;
      if (sortBy === 'feedback_count') { valA = a.feedback_count; valB = b.feedback_count; }
      else if (sortBy === 'rating_count') { valA = a.rating_count; valB = b.rating_count; }
      else { valA = a[sortBy] as string; valB = b[sortBy] as string; }
      const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [models, search, manufacturer, status, qualityFilter, popularityFilter, sortBy, sortDir]);

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

  const isFiltered = search || manufacturer !== 'All' || status !== 'All' || qualityFilter !== 'All' || popularityFilter !== 'All';

  return (
    <div>
      <TopNav
        title="Relay Models"
        description={`${filtered.length} models${isFiltered ? ' (filtered)' : ''}`}
        actions={
          profile?.role === 'admin' && (
            <Link
              href="/relay-models/new"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Model
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
              <input
                type="text"
                placeholder="Search models, manufacturers..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <select
              value={manufacturer}
              onChange={e => { setManufacturer(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {MANUFACTURERS.map(m => <option key={m} value={m}>{m === 'All' ? 'All Manufacturers' : m}</option>)}
            </select>
            <select
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {STATUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={qualityFilter}
                onChange={e => { setQualityFilter(e.target.value); setPage(1); }}
                className="px-3 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {GRADES.map(g => <option key={g} value={g}>{g === 'All' ? 'Quality: All' : `Quality: ${g}`}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={popularityFilter}
                onChange={e => { setPopularityFilter(e.target.value); setPage(1); }}
                className="px-3 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {GRADES.map(g => <option key={g} value={g}>{g === 'All' ? 'Popularity: All' : `Popularity: ${g}`}</option>)}
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
                    <button onClick={() => handleSort('model_name')} className="hover:text-foreground transition-colors">
                      Model Name <SortIcon col="model_name" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Manufacturer</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Template</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <span className="flex items-center gap-1"><Star className="w-3 h-3" /> Quality</span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Popularity</span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <button onClick={() => handleSort('rating_count')} className="hover:text-foreground transition-colors flex items-center gap-1">
                      <Users className="w-3 h-3" /> Raters <SortIcon col="rating_count" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">PDF</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <button onClick={() => handleSort('feedback_count')} className="hover:text-foreground transition-colors">
                      Issues <SortIcon col="feedback_count" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <button onClick={() => handleSort('updated_at')} className="hover:text-foreground transition-colors">
                      Updated <SortIcon col="updated_at" />
                    </button>
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {[...Array(10)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">
                      No relay models found
                    </td>
                  </tr>
                ) : (
                  paginated.map(model => {
                    const displayQuality = effectiveQuality(model);
                    const displayPopularity = effectivePopularity(model);
                    const isOfficialQ = model.official_quality_grade && model.official_quality_grade !== 'N/A';
                    const isOfficialP = model.official_popularity_grade && model.official_popularity_grade !== 'N/A';
                    return (
                      <tr key={model.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors group">
                        <td className="px-4 py-3">
                          <Link href={`/relay-models/${model.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                            {model.model_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{model.manufacturer}</td>
                        <td className="px-4 py-3">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{model.template_version || '—'}</code>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge value={model.status} type="model-status" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5" title={isOfficialQ ? 'Official grade set by admin' : `Based on ${model.rating_count} user rating${model.rating_count !== 1 ? 's' : ''}`}>
                            <GradeBadge grade={displayQuality} />
                            {isOfficialQ && <span className="text-xs text-muted-foreground font-medium">✓</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5" title={isOfficialP ? 'Official grade set by admin' : `Based on ${model.rating_count} user rating${model.rating_count !== 1 ? 's' : ''}`}>
                            <GradeBadge grade={displayPopularity} />
                            {isOfficialP && <span className="text-xs text-muted-foreground font-medium">✓</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {model.rating_count > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="w-3 h-3" />
                              {model.rating_count}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {model.has_pdf ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                              <FileText className="w-3 h-3" /> Yes
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {model.feedback_count > 0 ? (
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                              model.feedback_count >= 5 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              model.feedback_count >= 3 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}>
                              {model.feedback_count}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {model.cloud_mod_date ? new Date(model.cloud_mod_date).toLocaleDateString() : '—'}
                        </td>
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
              <p className="text-sm text-muted-foreground">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 text-sm text-muted-foreground">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="font-medium">✓</span> Official admin grade</span>
          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Community consensus grade</span>
        </div>
      </div>
    </div>
  );
}
