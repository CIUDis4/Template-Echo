'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type {
  RelayModel, FeedbackEntry, FeedbackAttachment, Profile,
  RelayModelRatingWithProfile,
} from '@/lib/database.types';
import { computeCommunityGrade, GRADE_NUMERIC, NUMERIC_GRADE } from '@/lib/database.types';
import { useAuth } from '@/lib/auth-context';
import { TopNav } from '@/components/top-nav';
import { StatusBadge, GradeBadge, GRADE_VALUES } from '@/components/severity-badge';
import { FeedbackForm } from '@/components/feedback-form';
import { toast } from 'sonner';
import {
  ChevronLeft, Plus, Edit2, Trash2, FileText, Image, File,
  Download, Clock, User, CheckCircle2, Loader2, X,
  Star, TrendingUp, Users, Flag, ShieldCheck, ChevronDown, ChevronUp,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface FeedbackWithDetails extends FeedbackEntry {
  profiles?: Profile;
  feedback_attachments?: FeedbackAttachment[];
}

export default function RelayModelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const router = useRouter();

  const [model, setModel] = useState<RelayModel | null>(null);
  const [feedback, setFeedback] = useState<FeedbackWithDetails[]>([]);
  const [ratings, setRatings] = useState<RelayModelRatingWithProfile[]>([]);
  const [myRating, setMyRating] = useState<RelayModelRatingWithProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Feedback form state
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState<FeedbackEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // My rating form state
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [ratingQuality, setRatingQuality] = useState('');
  const [ratingPopularity, setRatingPopularity] = useState('');
  const [ratingComment, setRatingComment] = useState('');
  const [savingRating, setSavingRating] = useState(false);
  const [deletingRating, setDeletingRating] = useState(false);

  // Admin official grade state
  const [editingOfficialGrades, setEditingOfficialGrades] = useState(false);
  const [officialQuality, setOfficialQuality] = useState('N/A');
  const [officialPopularity, setOfficialPopularity] = useState('N/A');
  const [savingOfficialGrades, setSavingOfficialGrades] = useState(false);

  // Admin ratings panel
  const [showAllRatings, setShowAllRatings] = useState(false);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    const [modelRes, feedbackRes, ratingsRes] = await Promise.all([
      supabase.from('relay_models').select('*').eq('id', id).maybeSingle(),
      supabase.from('feedback_entries').select('*, profiles(*), feedback_attachments(*)').eq('relay_model_id', id).order('created_at', { ascending: false }),
      supabase.from('relay_model_ratings').select('*, profiles(*)').eq('relay_model_id', id),
    ]);

    if (modelRes.error || !modelRes.data) {
      toast.error('Relay model not found');
      router.push('/relay-models');
      return;
    }

    setModel(modelRes.data);
    setOfficialQuality(modelRes.data.official_quality_grade || 'N/A');
    setOfficialPopularity(modelRes.data.official_popularity_grade || 'N/A');
    setFeedback(feedbackRes.data || []);

    const allRatings = (ratingsRes.data || []) as RelayModelRatingWithProfile[];
    setRatings(allRatings);

    const mine = user ? allRatings.find(r => r.user_id === user.id) || null : null;
    setMyRating(mine);
    if (mine) {
      setRatingQuality(mine.quality_grade || '');
      setRatingPopularity(mine.popularity_grade || '');
      setRatingComment(mine.comment || '');
    }

    setLoading(false);
  };

  const handleSaveRating = async () => {
    if (!user || (!ratingQuality && !ratingPopularity)) {
      toast.error('Please select at least one grade');
      return;
    }
    setSavingRating(true);

    if (myRating) {
      const { error } = await supabase
        .from('relay_model_ratings')
        .update({ quality_grade: ratingQuality || null, popularity_grade: ratingPopularity || null, comment: ratingComment, updated_at: new Date().toISOString() })
        .eq('id', myRating.id);
      if (error) { toast.error('Failed to update rating'); }
      else { toast.success('Rating updated'); setShowRatingForm(false); loadData(); }
    } else {
      const { error } = await supabase
        .from('relay_model_ratings')
        .insert({ relay_model_id: id, user_id: user.id, quality_grade: ratingQuality || null, popularity_grade: ratingPopularity || null, comment: ratingComment });
      if (error) { toast.error('Failed to submit rating'); }
      else { toast.success('Rating submitted'); setShowRatingForm(false); loadData(); }
    }
    setSavingRating(false);
  };

  const handleDeleteRating = async () => {
    if (!myRating) return;
    setDeletingRating(true);
    const { error } = await supabase.from('relay_model_ratings').delete().eq('id', myRating.id);
    if (error) { toast.error('Failed to delete rating'); }
    else {
      toast.success('Rating deleted');
      setMyRating(null);
      setRatingQuality('');
      setRatingPopularity('');
      setRatingComment('');
      setShowRatingForm(false);
      loadData();
    }
    setDeletingRating(false);
  };

  const handleFlagRating = async (ratingId: string, flag: boolean) => {
    const { error } = await supabase.from('relay_model_ratings').update({ is_flagged: flag }).eq('id', ratingId);
    if (error) { toast.error('Failed to update flag'); }
    else { toast.success(flag ? 'Rating flagged' : 'Flag removed'); loadData(); }
  };

  const handleAdminDeleteRating = async (ratingId: string) => {
    const { error } = await supabase.from('relay_model_ratings').delete().eq('id', ratingId);
    if (error) { toast.error('Failed to delete rating'); }
    else { toast.success('Rating removed'); loadData(); }
  };

  const handleSaveOfficialGrades = async () => {
    if (!model) return;
    setSavingOfficialGrades(true);
    const { error } = await supabase.from('relay_models').update({
      official_quality_grade: officialQuality,
      official_popularity_grade: officialPopularity,
      grade_updated_by: user?.id,
      grade_updated_at: new Date().toISOString(),
    }).eq('id', id);

    if (error) { toast.error('Failed to save official grades'); }
    else {
      toast.success('Official grades saved');
      setModel(prev => prev ? { ...prev, official_quality_grade: officialQuality, official_popularity_grade: officialPopularity } : prev);
      setEditingOfficialGrades(false);
    }
    setSavingOfficialGrades(false);
  };

  const handleApproveAsOfficial = async () => {
    const { grade: cq } = computeCommunityGrade(ratings.filter(r => !r.is_flagged), 'quality_grade');
    const { grade: cp } = computeCommunityGrade(ratings.filter(r => !r.is_flagged), 'popularity_grade');
    setOfficialQuality(cq);
    setOfficialPopularity(cp);
    setSavingOfficialGrades(true);
    const { error } = await supabase.from('relay_models').update({
      official_quality_grade: cq,
      official_popularity_grade: cp,
      grade_updated_by: user?.id,
      grade_updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) { toast.error('Failed'); }
    else {
      toast.success('Community consensus approved as official grades');
      setModel(prev => prev ? { ...prev, official_quality_grade: cq, official_popularity_grade: cp } : prev);
    }
    setSavingOfficialGrades(false);
  };

  const handleDelete = async (feedbackId: string) => {
    setDeletingId(feedbackId);
    const { error } = await supabase.from('feedback_entries').delete().eq('id', feedbackId);
    if (error) { toast.error('Failed to delete feedback'); }
    else { toast.success('Feedback deleted'); setFeedback(prev => prev.filter(f => f.id !== feedbackId)); }
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  const handleDeleteAttachment = async (attachmentId: string, fileUrl: string) => {
    const path = fileUrl.split('/feedback-files/')[1];
    if (path) await supabase.storage.from('feedback-files').remove([path]);
    await supabase.from('feedback_attachments').delete().eq('id', attachmentId);
    loadData();
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (type === 'application/pdf') return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div>
        <TopNav title="Loading..." />
        <div className="p-6 space-y-4">
          <div className="h-32 bg-muted rounded-xl animate-pulse" />
          <div className="h-64 bg-muted rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!model) return null;

  const unflaggedRatings = ratings.filter(r => !r.is_flagged);
  const { grade: communityQuality, count: qualityCount } = computeCommunityGrade(unflaggedRatings, 'quality_grade');
  const { grade: communityPopularity, count: popularityCount } = computeCommunityGrade(unflaggedRatings, 'popularity_grade');

  const displayQuality = model.official_quality_grade && model.official_quality_grade !== 'N/A' ? model.official_quality_grade : communityQuality;
  const displayPopularity = model.official_popularity_grade && model.official_popularity_grade !== 'N/A' ? model.official_popularity_grade : communityPopularity;
  const isOfficialQ = model.official_quality_grade && model.official_quality_grade !== 'N/A';
  const isOfficialP = model.official_popularity_grade && model.official_popularity_grade !== 'N/A';

  const openCount = feedback.filter(f => ['open', 'in_progress'].includes(f.status)).length;
  const totalHours = feedback.reduce((sum, f) => sum + (f.estimated_fix_hours || 0), 0);

  // Grade distribution for admin view
  const qualityDist = GRADE_VALUES.map(g => ({
    grade: g,
    count: unflaggedRatings.filter(r => r.quality_grade === g).length,
  })).filter(d => d.count > 0);
  const popularityDist = GRADE_VALUES.map(g => ({
    grade: g,
    count: unflaggedRatings.filter(r => r.popularity_grade === g).length,
  })).filter(d => d.count > 0);

  // Average numeric score
  const avgQualityNum = unflaggedRatings.length > 0
    ? unflaggedRatings.reduce((sum, r) => sum + (GRADE_NUMERIC[r.quality_grade || 'N/A'] || 0), 0) / unflaggedRatings.length
    : 0;
  const avgPopNum = unflaggedRatings.length > 0
    ? unflaggedRatings.reduce((sum, r) => sum + (GRADE_NUMERIC[r.popularity_grade || 'N/A'] || 0), 0) / unflaggedRatings.length
    : 0;

  // Conflicting = if top 2 grades each have ≥2 votes
  const isConflicting = qualityDist.length >= 2 && qualityDist[0]?.count >= 2 && qualityDist[1]?.count >= 2;

  const GradeSelector = ({
    value, onChange, label
  }: { value: string; onChange: (v: string) => void; label: string }) => (
    <div>
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {GRADE_VALUES.map(g => (
          <button
            key={g}
            type="button"
            onClick={() => onChange(value === g ? '' : g)}
            className={`transition-all ${value === g ? 'ring-2 ring-primary ring-offset-1 rounded-full scale-105' : 'opacity-55 hover:opacity-100'}`}
          >
            <GradeBadge grade={g} />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <TopNav
        title={model.model_name}
        description={model.manufacturer}
        actions={
          <Link href="/relay-models" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back
          </Link>
        }
      />

      <div className="p-6 space-y-5">
        {/* Model summary card */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <h2 className="text-lg font-bold text-foreground">{model.model_name}</h2>
                <StatusBadge value={model.status} type="model-status" />
                {model.has_pdf && (
                  <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                    <FileText className="w-3 h-3" /> PDF Available
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Manufacturer</p>
                  <p className="font-medium text-foreground">{model.manufacturer || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Template Version</p>
                  <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{model.template_version || '—'}</code>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Firmware</p>
                  <p className="font-medium text-foreground">{model.firmware_version || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Last Modified</p>
                  <p className="font-medium text-foreground">
                    {model.cloud_mod_date ? new Date(model.cloud_mod_date).toLocaleDateString() : '—'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{feedback.length}</p>
                <p className="text-xs text-muted-foreground">Total Issues</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-500">{openCount}</p>
                <p className="text-xs text-muted-foreground">Open</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-500">{totalHours.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">Est. Work</p>
              </div>
            </div>
          </div>
        </div>

        {/* Grades Card */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-foreground">Community Grades</h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              {unflaggedRatings.length} rating{unflaggedRatings.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Effective grade display */}
          <div className="grid grid-cols-2 gap-6 mb-5">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Star className="w-3 h-3" /> Quality Grade</p>
              <div className="flex items-center gap-2">
                <GradeBadge grade={displayQuality} />
                {isOfficialQ ? (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Official
                  </span>
                ) : qualityCount > 0 ? (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" /> {qualityCount} {qualityCount === 1 ? 'user' : 'users'}
                  </span>
                ) : null}
              </div>
              {isAdmin && avgQualityNum > 0 && (
                <p className="text-xs text-muted-foreground">Avg: {avgQualityNum.toFixed(1)} / 5.0</p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Popularity Grade</p>
              <div className="flex items-center gap-2">
                <GradeBadge grade={displayPopularity} />
                {isOfficialP ? (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Official
                  </span>
                ) : popularityCount > 0 ? (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" /> {popularityCount} {popularityCount === 1 ? 'user' : 'users'}
                  </span>
                ) : null}
              </div>
              {isAdmin && avgPopNum > 0 && (
                <p className="text-xs text-muted-foreground">Avg: {avgPopNum.toFixed(1)} / 5.0</p>
              )}
            </div>
          </div>

          {/* Grade distribution bars (shown when ratings exist) */}
          {unflaggedRatings.length > 0 && (
            <div className="grid grid-cols-2 gap-6 mb-5 pt-4 border-t border-border/50">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Quality Distribution</p>
                <div className="space-y-1">
                  {qualityDist.map(d => (
                    <div key={d.grade} className="flex items-center gap-2">
                      <span className="w-5 text-right text-xs font-semibold text-muted-foreground">{d.grade}</span>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${(d.count / unflaggedRatings.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-4">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Popularity Distribution</p>
                <div className="space-y-1">
                  {popularityDist.map(d => (
                    <div key={d.grade} className="flex items-center gap-2">
                      <span className="w-5 text-right text-xs font-semibold text-muted-foreground">{d.grade}</span>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${(d.count / unflaggedRatings.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-4">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* --- User's own rating section --- */}
          <div className="pt-4 border-t border-border/50">
            {!showRatingForm ? (
              <div className="flex items-center justify-between">
                <div>
                  {myRating ? (
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-muted-foreground">Your rating:</span>
                      {myRating.quality_grade && <GradeBadge grade={myRating.quality_grade} label="Q" />}
                      {myRating.popularity_grade && <GradeBadge grade={myRating.popularity_grade} label="P" />}
                      {myRating.comment && <span className="text-xs text-muted-foreground italic">"{myRating.comment}"</span>}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">You haven't rated this model yet.</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {myRating && (
                    <button
                      onClick={handleDeleteRating}
                      disabled={deletingRating}
                      className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition-colors"
                    >
                      {deletingRating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      Delete
                    </button>
                  )}
                  <button
                    onClick={() => setShowRatingForm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Star className="w-3 h-3" />
                    {myRating ? 'Update Your Rating' : 'Submit Your Rating'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-foreground">
                  {myRating ? 'Update Your Rating' : 'Submit Your Rating'}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <GradeSelector value={ratingQuality} onChange={setRatingQuality} label="Quality Grade" />
                  <GradeSelector value={ratingPopularity} onChange={setRatingPopularity} label="Popularity Grade" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Comment (optional)</p>
                  <textarea
                    value={ratingComment}
                    onChange={e => setRatingComment(e.target.value)}
                    placeholder="Share your reasoning..."
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveRating}
                    disabled={savingRating || (!ratingQuality && !ratingPopularity)}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
                  >
                    {savingRating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {myRating ? 'Update Rating' : 'Submit Rating'}
                  </button>
                  <button
                    onClick={() => { setShowRatingForm(false); if (myRating) { setRatingQuality(myRating.quality_grade || ''); setRatingPopularity(myRating.popularity_grade || ''); setRatingComment(myRating.comment); } else { setRatingQuality(''); setRatingPopularity(''); setRatingComment(''); } }}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* --- Admin: Official Grade Override + Rating Review --- */}
          {isAdmin && (
            <div className="mt-5 pt-5 border-t border-border space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Official Grade Override
                </h4>
                <div className="flex items-center gap-2">
                  {unflaggedRatings.length > 0 && !editingOfficialGrades && (
                    <button
                      onClick={handleApproveAsOfficial}
                      disabled={savingOfficialGrades}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors font-medium"
                    >
                      {savingOfficialGrades ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Approve Community Consensus
                    </button>
                  )}
                  {!editingOfficialGrades && (
                    <button onClick={() => setEditingOfficialGrades(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-accent transition-colors">
                      <Edit2 className="w-3 h-3" /> Manual Override
                    </button>
                  )}
                </div>
              </div>

              {editingOfficialGrades ? (
                <div className="bg-muted/40 rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <GradeSelector value={officialQuality} onChange={setOfficialQuality} label="Official Quality Grade" />
                    <GradeSelector value={officialPopularity} onChange={setOfficialPopularity} label="Official Popularity Grade" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveOfficialGrades}
                      disabled={savingOfficialGrades}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
                    >
                      {savingOfficialGrades ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      Set Official Grades
                    </button>
                    <button
                      onClick={() => { setEditingOfficialGrades(false); setOfficialQuality(model.official_quality_grade || 'N/A'); setOfficialPopularity(model.official_popularity_grade || 'N/A'); }}
                      className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">Current official:</span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Q:</span>
                    <GradeBadge grade={model.official_quality_grade || 'N/A'} />
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">P:</span>
                    <GradeBadge grade={model.official_popularity_grade || 'N/A'} />
                  </span>
                  {model.grade_updated_at && (
                    <span className="text-xs text-muted-foreground">
                      Updated {formatDistanceToNow(new Date(model.grade_updated_at), { addSuffix: true })}
                    </span>
                  )}
                </div>
              )}

              {/* All individual ratings */}
              {ratings.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowAllRatings(v => !v)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
                  >
                    <Users className="w-4 h-4" />
                    All Ratings ({ratings.length})
                    {isConflicting && <span className="text-xs text-amber-500 font-medium">Conflicting</span>}
                    {showAllRatings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {showAllRatings && (
                    <div className="space-y-2">
                      {ratings.map(r => (
                        <div key={r.id} className={`flex items-start gap-3 p-3 rounded-lg border ${r.is_flagged ? 'border-red-200 dark:border-red-800/40 bg-red-50/30 dark:bg-red-900/10' : 'border-border/50 bg-muted/20'}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-xs font-medium text-foreground">
                                {r.profiles?.full_name || r.profiles?.email || 'User'}
                              </span>
                              {r.is_flagged && <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-0.5"><Flag className="w-3 h-3" /> Flagged</span>}
                              <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              {r.quality_grade && <span className="flex items-center gap-1 text-xs text-muted-foreground">Q: <GradeBadge grade={r.quality_grade} /></span>}
                              {r.popularity_grade && <span className="flex items-center gap-1 text-xs text-muted-foreground">P: <GradeBadge grade={r.popularity_grade} /></span>}
                              {r.comment && <span className="text-xs text-muted-foreground italic">"{r.comment}"</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleFlagRating(r.id, !r.is_flagged)}
                              title={r.is_flagged ? 'Remove flag' : 'Flag as spam/inaccurate'}
                              className={`p-1.5 rounded-lg hover:bg-accent transition-colors ${r.is_flagged ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'}`}
                            >
                              <Flag className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleAdminDeleteRating(r.id)}
                              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive transition-colors"
                              title="Delete rating"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Feedback section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Feedback & Issues</h3>
            {profile?.role !== 'viewer' && !showFeedbackForm && !editingFeedback && (
              <button
                onClick={() => setShowFeedbackForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Feedback
              </button>
            )}
          </div>

          {(showFeedbackForm || editingFeedback) && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h4 className="font-medium text-foreground mb-4">{editingFeedback ? 'Edit Feedback' : 'New Feedback'}</h4>
              <FeedbackForm
                relayModelId={id}
                editEntry={editingFeedback || undefined}
                onSuccess={() => { setShowFeedbackForm(false); setEditingFeedback(null); loadData(); }}
                onCancel={() => { setShowFeedbackForm(false); setEditingFeedback(null); }}
              />
            </div>
          )}

          {feedback.length === 0 && !showFeedbackForm ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium text-foreground mb-1">No issues reported</p>
              <p className="text-sm text-muted-foreground mb-4">This relay model has no feedback yet.</p>
              {profile?.role !== 'viewer' && (
                <button onClick={() => setShowFeedbackForm(true)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                  Add First Feedback
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {feedback.map(entry => (
                <div key={entry.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-sm transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-semibold text-foreground">{entry.title}</h4>
                        <StatusBadge value={entry.severity} type="severity" />
                        <StatusBadge value={entry.status} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <span>{entry.profiles?.full_name || entry.profiles?.email || 'Unknown'}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}</span>
                        {entry.estimated_fix_hours > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{entry.estimated_fix_hours}h estimated</span>
                          </>
                        )}
                      </div>
                      {entry.description && (
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap mb-3 leading-relaxed">{entry.description}</p>
                      )}
                      {entry.feedback_attachments && entry.feedback_attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {entry.feedback_attachments.map(att => (
                            <div key={att.id} className="group flex items-center gap-1.5 px-2.5 py-1.5 bg-muted rounded-lg text-xs">
                              {getFileIcon(att.file_type)}
                              <span className="truncate max-w-32 text-foreground">{att.file_name}</span>
                              <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 transition-colors">
                                <Download className="w-3 h-3" />
                              </a>
                              {(user?.id === entry.user_id || isAdmin) && (
                                <button onClick={() => handleDeleteAttachment(att.id, att.file_url)} className="text-muted-foreground hover:text-destructive transition-colors hidden group-hover:block">
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {(user?.id === entry.user_id || isAdmin) && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setEditingFeedback(entry)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {confirmDeleteId === entry.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(entry.id)} disabled={deletingId === entry.id} className="px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors">
                              {deletingId === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Delete'}
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 text-xs border border-border rounded-lg hover:bg-accent transition-colors">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(entry.id)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
