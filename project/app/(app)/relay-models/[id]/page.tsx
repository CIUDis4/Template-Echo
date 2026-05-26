'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { RelayModel, FeedbackEntry, FeedbackAttachment, Profile } from '@/lib/database.types';
import { useAuth } from '@/lib/auth-context';
import { TopNav } from '@/components/top-nav';
import { StatusBadge } from '@/components/severity-badge';
import { FeedbackForm } from '@/components/feedback-form';
import { toast } from 'sonner';
import {
  ChevronLeft, Plus, Edit2, Trash2, FileText, Image, File,
  Download, Clock, User, AlertTriangle, CheckCircle2, Loader2, X
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
  const [loading, setLoading] = useState(true);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState<FeedbackEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    const [modelRes, feedbackRes] = await Promise.all([
      supabase.from('relay_models').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('feedback_entries')
        .select('*, profiles(*), feedback_attachments(*)')
        .eq('relay_model_id', id)
        .order('created_at', { ascending: false }),
    ]);

    if (modelRes.error || !modelRes.data) {
      toast.error('Relay model not found');
      router.push('/relay-models');
      return;
    }

    setModel(modelRes.data);
    setFeedback(feedbackRes.data || []);
    setLoading(false);
  };

  const handleDelete = async (feedbackId: string) => {
    setDeletingId(feedbackId);
    const { error } = await supabase.from('feedback_entries').delete().eq('id', feedbackId);
    if (error) {
      toast.error('Failed to delete feedback');
    } else {
      toast.success('Feedback deleted');
      setFeedback(prev => prev.filter(f => f.id !== feedbackId));
    }
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  const handleDeleteAttachment = async (attachmentId: string, fileUrl: string) => {
    const path = fileUrl.split('/feedback-files/')[1];
    if (path) {
      await supabase.storage.from('feedback-files').remove([path]);
    }
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

  const openCount = feedback.filter(f => ['open', 'in_progress'].includes(f.status)).length;
  const totalHours = feedback.reduce((sum, f) => sum + (f.estimated_fix_hours || 0), 0);

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

        {/* Feedback section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Feedback & Issues</h3>
            {profile?.role !== 'viewer' && !showFeedbackForm && !editingFeedback && (
              <button
                onClick={() => setShowFeedbackForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Feedback
              </button>
            )}
          </div>

          {/* Feedback form */}
          {(showFeedbackForm || editingFeedback) && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h4 className="font-medium text-foreground mb-4">
                {editingFeedback ? 'Edit Feedback' : 'New Feedback'}
              </h4>
              <FeedbackForm
                relayModelId={id}
                editEntry={editingFeedback || undefined}
                onSuccess={() => {
                  setShowFeedbackForm(false);
                  setEditingFeedback(null);
                  loadData();
                }}
                onCancel={() => {
                  setShowFeedbackForm(false);
                  setEditingFeedback(null);
                }}
              />
            </div>
          )}

          {/* Feedback list */}
          {feedback.length === 0 && !showFeedbackForm ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium text-foreground mb-1">No issues reported</p>
              <p className="text-sm text-muted-foreground mb-4">This relay model has no feedback yet.</p>
              {profile?.role !== 'viewer' && (
                <button
                  onClick={() => setShowFeedbackForm(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
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
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {entry.estimated_fix_hours}h estimated
                            </span>
                          </>
                        )}
                      </div>

                      {entry.description && (
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap mb-3 leading-relaxed">
                          {entry.description}
                        </p>
                      )}

                      {/* Attachments */}
                      {entry.feedback_attachments && entry.feedback_attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {entry.feedback_attachments.map(att => (
                            <div key={att.id} className="group flex items-center gap-1.5 px-2.5 py-1.5 bg-muted rounded-lg text-xs">
                              {getFileIcon(att.file_type)}
                              <span className="truncate max-w-32 text-foreground">{att.file_name}</span>
                              <a
                                href={att.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80 transition-colors"
                              >
                                <Download className="w-3 h-3" />
                              </a>
                              {(user?.id === entry.user_id || profile?.role === 'admin') && (
                                <button
                                  onClick={() => handleDeleteAttachment(att.id, att.file_url)}
                                  className="text-muted-foreground hover:text-destructive transition-colors hidden group-hover:block"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {(user?.id === entry.user_id || profile?.role === 'admin') && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setEditingFeedback(entry)}
                          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {confirmDeleteId === entry.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(entry.id)}
                              disabled={deletingId === entry.id}
                              className="px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
                            >
                              {deletingId === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Delete'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-xs border border-border rounded-lg hover:bg-accent transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(entry.id)}
                            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete"
                          >
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
