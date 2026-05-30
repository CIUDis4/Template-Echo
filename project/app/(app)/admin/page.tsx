'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { TopNav } from '@/components/top-nav';
import { StatusBadge, GradeBadge, GRADE_VALUES } from '@/components/severity-badge';
import { toast } from 'sonner';
import {
  Settings, Cpu, Trash2, Edit2, Plus, Loader2, Star, TrendingUp,
  Users, Flag, ShieldCheck, ChevronDown, ChevronUp, Search,
} from 'lucide-react';
import type { RelayModel } from '@/lib/database.types';
import { computeCommunityGrade } from '@/lib/database.types';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface RatingRow {
  id: string;
  relay_model_id: string;
  user_id: string;
  quality_grade: string | null;
  popularity_grade: string | null;
  comment: string;
  is_flagged: boolean;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string; email: string };
}

interface ModelWithRatings {
  id: string;
  model_name: string;
  manufacturer: string;
  official_quality_grade: string;
  official_popularity_grade: string;
  grade_updated_at: string | null;
  ratings: RatingRow[];
  community_quality: string;
  community_popularity: string;
  rater_count: number;
}

type Tab = 'models' | 'ratings';

export default function AdminPage() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('models');

  // Model management state
  const [models, setModels] = useState<RelayModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingModel, setEditingModel] = useState<RelayModel | null>(null);
  const [showAddModel, setShowAddModel] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    model_name: '', manufacturer: '', relay_family: '',
    firmware_version: '', template_version: '', cloud_mod_date: '',
    status: 'active' as RelayModel['status'],
    has_pdf: false,
  });

  // Ratings review state
  const [modelsWithRatings, setModelsWithRatings] = useState<ModelWithRatings[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);
  const [ratingsSearch, setRatingsSearch] = useState('');
  const [savingGradeFor, setSavingGradeFor] = useState<string | null>(null);
  const [officialEdits, setOfficialEdits] = useState<Record<string, { quality: string; popularity: string }>>({});

  useEffect(() => {
    if (profile && profile.role !== 'admin') router.replace('/dashboard');
    else { loadModels(); loadRatingsData(); }
  }, [profile]);

  const loadModels = async () => {
    setLoading(true);
    const { data } = await supabase.from('relay_models').select('*').order('model_name');
    setModels(data || []);
    setLoading(false);
  };

  const loadRatingsData = async () => {
    setRatingsLoading(true);
    const [modelsRes, ratingsRes] = await Promise.all([
      supabase.from('relay_models').select('id, model_name, manufacturer, official_quality_grade, official_popularity_grade, grade_updated_at').order('model_name'),
      supabase.from('relay_model_ratings').select('*, profiles(full_name, email)').order('created_at', { ascending: false }),
    ]);

    const allRatings: RatingRow[] = (ratingsRes.data || []) as RatingRow[];
    const ratingsByModel = new Map<string, RatingRow[]>();
    allRatings.forEach(r => {
      const arr = ratingsByModel.get(r.relay_model_id) || [];
      arr.push(r);
      ratingsByModel.set(r.relay_model_id, arr);
    });

    const enriched: ModelWithRatings[] = (modelsRes.data || [])
      .map(m => {
        const ratings = ratingsByModel.get(m.id) || [];
        const unflagged = ratings.filter(r => !r.is_flagged);
        const { grade: cq, count } = computeCommunityGrade(unflagged, 'quality_grade');
        const { grade: cp } = computeCommunityGrade(unflagged, 'popularity_grade');
        return {
          ...m,
          ratings,
          community_quality: cq,
          community_popularity: cp,
          rater_count: count,
        };
      })
      .filter(m => m.ratings.length > 0);

    setModelsWithRatings(enriched);
    setRatingsLoading(false);
  };

  const startEdit = (m: RelayModel) => {
    setEditingModel(m);
    setFormData({
      model_name: m.model_name, manufacturer: m.manufacturer,
      relay_family: m.relay_family, firmware_version: m.firmware_version,
      template_version: m.template_version,
      cloud_mod_date: m.cloud_mod_date ? new Date(m.cloud_mod_date).toISOString().split('T')[0] : '',
      status: m.status, has_pdf: m.has_pdf,
    });
    setShowAddModel(false);
  };

  const startAdd = () => {
    setEditingModel(null);
    setFormData({ model_name: '', manufacturer: '', relay_family: '', firmware_version: '', template_version: '', cloud_mod_date: '', status: 'active', has_pdf: false });
    setShowAddModel(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.model_name.trim()) { toast.error('Model name required'); return; }
    setSaving(true);
    const payload = {
      model_name: formData.model_name,
      manufacturer: formData.manufacturer,
      relay_family: formData.relay_family,
      firmware_version: formData.firmware_version,
      template_version: formData.template_version,
      status: formData.status,
      has_pdf: formData.has_pdf,
      cloud_mod_date: formData.cloud_mod_date ? new Date(formData.cloud_mod_date).toISOString() : null,
    };
    if (editingModel) {
      const { error } = await supabase.from('relay_models').update(payload).eq('id', editingModel.id);
      if (error) toast.error(error.message);
      else { toast.success('Model updated'); setEditingModel(null); loadModels(); }
    } else {
      const { error } = await supabase.from('relay_models').insert(payload);
      if (error) toast.error(error.message);
      else { toast.success('Model added'); setShowAddModel(false); loadModels(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('relay_models').delete().eq('id', id);
    if (error) toast.error('Cannot delete: model may have related feedback');
    else { toast.success('Model deleted'); setModels(prev => prev.filter(m => m.id !== id)); }
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  const handleFlagRating = async (ratingId: string, flag: boolean) => {
    const { error } = await supabase.from('relay_model_ratings').update({ is_flagged: flag }).eq('id', ratingId);
    if (error) { toast.error('Failed'); return; }
    toast.success(flag ? 'Rating flagged' : 'Flag removed');
    loadRatingsData();
  };

  const handleDeleteRating = async (ratingId: string) => {
    const { error } = await supabase.from('relay_model_ratings').delete().eq('id', ratingId);
    if (error) { toast.error('Failed to delete rating'); return; }
    toast.success('Rating deleted');
    loadRatingsData();
  };

  const handleSetOfficialGrade = async (modelId: string, quality: string, popularity: string) => {
    setSavingGradeFor(modelId);
    const { error } = await supabase.from('relay_models').update({
      official_quality_grade: quality,
      official_popularity_grade: popularity,
      grade_updated_by: user?.id,
      grade_updated_at: new Date().toISOString(),
    }).eq('id', modelId);
    if (error) { toast.error('Failed to save grades'); }
    else { toast.success('Official grades updated'); loadRatingsData(); }
    setSavingGradeFor(null);
  };

  const handleApproveConsensus = async (m: ModelWithRatings) => {
    await handleSetOfficialGrade(m.id, m.community_quality, m.community_popularity);
  };

  const filteredRatingModels = modelsWithRatings.filter(m =>
    !ratingsSearch ||
    m.model_name.toLowerCase().includes(ratingsSearch.toLowerCase()) ||
    m.manufacturer.toLowerCase().includes(ratingsSearch.toLowerCase())
  );

  if (profile?.role !== 'admin') return null;

  const ModelForm = () => (
    <div className="bg-card border border-border rounded-xl p-5 mb-4">
      <h4 className="font-medium text-foreground mb-4">{editingModel ? 'Edit Model' : 'Add New Model'}</h4>
      <form onSubmit={handleSave} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Model Name *</label>
            <input value={formData.model_name} onChange={e => setFormData(p => ({ ...p, model_name: e.target.value }))} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Manufacturer</label>
            <input value={formData.manufacturer} onChange={e => setFormData(p => ({ ...p, manufacturer: e.target.value }))} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Relay Family</label>
            <input value={formData.relay_family} onChange={e => setFormData(p => ({ ...p, relay_family: e.target.value }))} placeholder="e.g. REF600" className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Cloud Min RTMS (Template Version)</label>
            <input value={formData.template_version} onChange={e => setFormData(p => ({ ...p, template_version: e.target.value }))} placeholder="e.g. D100.53.36.17" className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Firmware Version</label>
            <input value={formData.firmware_version} onChange={e => setFormData(p => ({ ...p, firmware_version: e.target.value }))} placeholder="e.g. 4.1.4" className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Cloud Mod Date</label>
            <input type="date" value={formData.cloud_mod_date} onChange={e => setFormData(p => ({ ...p, cloud_mod_date: e.target.value }))} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
            <select value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value as RelayModel['status'] }))} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="active">Active</option>
              <option value="deprecated">Deprecated</option>
              <option value="review">Under Review</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input type="checkbox" id="has_pdf" checked={formData.has_pdf} onChange={e => setFormData(p => ({ ...p, has_pdf: e.target.checked }))} className="rounded border-border" />
            <label htmlFor="has_pdf" className="text-sm text-foreground">PDF Available</label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={() => { setEditingModel(null); setShowAddModel(false); }} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {editingModel ? 'Save Changes' : 'Add Model'}
          </button>
        </div>
      </form>
    </div>
  );

  const totalRatings = modelsWithRatings.reduce((sum, m) => sum + m.ratings.length, 0);
  const flaggedCount = modelsWithRatings.reduce((sum, m) => sum + m.ratings.filter(r => r.is_flagged).length, 0);
  const needsApproval = modelsWithRatings.filter(m =>
    m.ratings.filter(r => !r.is_flagged).length > 0 &&
    (m.official_quality_grade === 'N/A' || m.official_popularity_grade === 'N/A')
  ).length;

  return (
    <div>
      <TopNav title="Admin Panel" description="Manage relay models and grade ratings" />

      <div className="p-6 space-y-5">
        {/* Quick stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
            <div><p className="text-2xl font-bold text-foreground">{models.length}</p><p className="text-xs text-muted-foreground">Total Models</p></div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg"><Settings className="w-5 h-5 text-green-600 dark:text-green-400" /></div>
            <div><p className="text-2xl font-bold text-foreground">{models.filter(m => m.status === 'active').length}</p><p className="text-xs text-muted-foreground">Active</p></div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg"><Users className="w-5 h-5 text-slate-600 dark:text-slate-400" /></div>
            <div><p className="text-2xl font-bold text-foreground">{totalRatings}</p><p className="text-xs text-muted-foreground">Total Ratings</p></div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg"><ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>
            <div><p className="text-2xl font-bold text-foreground">{needsApproval}</p><p className="text-xs text-muted-foreground">Needs Approval</p></div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg"><Flag className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
            <div><p className="text-2xl font-bold text-foreground">{flaggedCount}</p><p className="text-xs text-muted-foreground">Flagged</p></div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          {(['models', 'ratings'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'models' ? 'Model Management' : (
                <span className="flex items-center gap-1.5">
                  Rating Reviews
                  {needsApproval > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-xs font-bold">{needsApproval}</span>
                  )}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Model Management Tab */}
        {tab === 'models' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">Relay Model Management</h3>
              <button onClick={startAdd} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Model
              </button>
            </div>
            {(showAddModel || editingModel) && <ModelForm />}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur border-b border-border">
                    <tr>
                      {['Model Name', 'Manufacturer', 'Template Version', 'Status', 'PDF', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i} className="border-b border-border/50">
                          {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}
                        </tr>
                      ))
                    ) : models.map(model => (
                      <tr key={model.id} className="border-b border-border/50 hover:bg-muted/20 group">
                        <td className="px-4 py-3 font-medium text-foreground">
                          <Link href={`/relay-models/${model.id}`} className="hover:text-primary transition-colors">{model.model_name}</Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{model.manufacturer}</td>
                        <td className="px-4 py-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{model.template_version || '—'}</code></td>
                        <td className="px-4 py-3"><StatusBadge value={model.status} type="model-status" /></td>
                        <td className="px-4 py-3"><span className={`text-xs font-medium ${model.has_pdf ? 'text-green-600' : 'text-muted-foreground'}`}>{model.has_pdf ? 'Yes' : 'No'}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => startEdit(model)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                            {confirmDeleteId === model.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleDelete(model.id)} disabled={deletingId === model.id} className="px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90">
                                  {deletingId === model.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Delete'}
                                </button>
                                <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 text-xs border border-border rounded-lg hover:bg-accent">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDeleteId(model.id)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Rating Reviews Tab */}
        {tab === 'ratings' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search models..."
                  value={ratingsSearch}
                  onChange={e => setRatingsSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <p className="text-sm text-muted-foreground">{filteredRatingModels.length} model{filteredRatingModels.length !== 1 ? 's' : ''} with ratings</p>
            </div>

            {ratingsLoading ? (
              <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
            ) : filteredRatingModels.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium text-foreground mb-1">No ratings submitted yet</p>
                <p className="text-sm text-muted-foreground">User ratings will appear here once engineers start grading models.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRatingModels.map(m => {
                  const isExpanded = expandedModelId === m.id;
                  const edit = officialEdits[m.id] || { quality: m.official_quality_grade || 'N/A', popularity: m.official_popularity_grade || 'N/A' };
                  const unflagged = m.ratings.filter(r => !r.is_flagged);
                  const flaggedRatings = m.ratings.filter(r => r.is_flagged);
                  const needsGrade = m.official_quality_grade === 'N/A' || m.official_popularity_grade === 'N/A';

                  return (
                    <div key={m.id} className={`bg-card border rounded-xl overflow-hidden transition-colors ${needsGrade && unflagged.length > 0 ? 'border-amber-300 dark:border-amber-700' : 'border-border'}`}>
                      {/* Header row */}
                      <div className="flex items-center gap-4 p-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Link href={`/relay-models/${m.id}`} className="font-medium text-foreground hover:text-primary transition-colors">{m.model_name}</Link>
                            <span className="text-xs text-muted-foreground">{m.manufacturer}</span>
                            {needsGrade && unflagged.length > 0 && (
                              <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">Needs approval</span>
                            )}
                            {flaggedRatings.length > 0 && (
                              <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Flag className="w-3 h-3" /> {flaggedRatings.length} flagged
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 flex-wrap">
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              Community Q: <GradeBadge grade={m.community_quality} />
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              Community P: <GradeBadge grade={m.community_popularity} />
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              Official Q: <GradeBadge grade={m.official_quality_grade || 'N/A'} />
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              Official P: <GradeBadge grade={m.official_popularity_grade || 'N/A'} />
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> {unflagged.length} rating{unflagged.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {unflagged.length > 0 && needsGrade && (
                            <button
                              onClick={() => handleApproveConsensus(m)}
                              disabled={savingGradeFor === m.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-medium rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                            >
                              {savingGradeFor === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                              Approve Consensus
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedModelId(isExpanded ? null : m.id)}
                            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded rating details */}
                      {isExpanded && (
                        <div className="border-t border-border p-4 space-y-4 bg-muted/20">
                          {/* Manual override */}
                          <div className="flex items-start gap-4 flex-wrap">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><Star className="w-3 h-3" /> Set Official Quality</p>
                              <div className="flex flex-wrap gap-1">
                                {GRADE_VALUES.map(g => (
                                  <button
                                    key={g}
                                    onClick={() => setOfficialEdits(prev => ({ ...prev, [m.id]: { ...edit, quality: g } }))}
                                    className={`transition-all ${edit.quality === g ? 'ring-2 ring-primary ring-offset-1 rounded-full scale-105' : 'opacity-55 hover:opacity-100'}`}
                                  >
                                    <GradeBadge grade={g} />
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Set Official Popularity</p>
                              <div className="flex flex-wrap gap-1">
                                {GRADE_VALUES.map(g => (
                                  <button
                                    key={g}
                                    onClick={() => setOfficialEdits(prev => ({ ...prev, [m.id]: { ...edit, popularity: g } }))}
                                    className={`transition-all ${edit.popularity === g ? 'ring-2 ring-primary ring-offset-1 rounded-full scale-105' : 'opacity-55 hover:opacity-100'}`}
                                  >
                                    <GradeBadge grade={g} />
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-end">
                              <button
                                onClick={() => handleSetOfficialGrade(m.id, edit.quality, edit.popularity)}
                                disabled={savingGradeFor === m.id}
                                className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
                              >
                                {savingGradeFor === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                                Save Official Grades
                              </button>
                            </div>
                          </div>

                          {/* Individual ratings table */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Individual Ratings ({m.ratings.length})</p>
                            <div className="space-y-1.5">
                              {m.ratings.map(r => (
                                <div key={r.id} className={`flex items-start gap-3 p-3 rounded-lg border ${r.is_flagged ? 'border-red-200 dark:border-red-800/40 bg-red-50/30 dark:bg-red-900/10' : 'border-border/50 bg-card'}`}>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <span className="text-xs font-medium text-foreground">{r.profiles?.full_name || r.profiles?.email || 'Unknown User'}</span>
                                      {r.is_flagged && <span className="text-xs text-red-500 flex items-center gap-0.5"><Flag className="w-3 h-3" /> Flagged</span>}
                                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                                    </div>
                                    <div className="flex items-center gap-3 flex-wrap">
                                      {r.quality_grade && <span className="text-xs text-muted-foreground flex items-center gap-1">Q: <GradeBadge grade={r.quality_grade} /></span>}
                                      {r.popularity_grade && <span className="text-xs text-muted-foreground flex items-center gap-1">P: <GradeBadge grade={r.popularity_grade} /></span>}
                                      {r.comment && <span className="text-xs text-muted-foreground italic">"{r.comment}"</span>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                      onClick={() => handleFlagRating(r.id, !r.is_flagged)}
                                      title={r.is_flagged ? 'Remove flag' : 'Flag as spam'}
                                      className={`p-1.5 rounded-lg hover:bg-accent transition-colors ${r.is_flagged ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'}`}
                                    >
                                      <Flag className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDeleteRating(r.id)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
