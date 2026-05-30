'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { TopNav } from '@/components/top-nav';
import type { DriverBug, BugComment, BugAttachment, BugHistory, BugStatus, BugPriority, BugSeverity } from '@/lib/database.types';
import {
  BUG_STATUSES, BUG_PRIORITIES, BUG_SEVERITIES, BUG_REPRODUCIBILITIES,
  statusColor, priorityColor, severityColor, formatBugId, formatBytes,
} from '@/lib/bug-utils';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ChevronLeft, Edit2, Save, X, Loader2, Upload, FileText, Image as ImageIcon,
  MessageSquare, History, User, Paperclip, Trash2, Check, Bold, Italic,
  List, Link2, Code, AlertTriangle, Clock, CheckCircle2,
} from 'lucide-react';

interface BugFull extends DriverBug {
  reporter_name: string;
  reporter_email: string;
  assigned_name: string | null;
  assigned_email: string | null;
}

interface CommentFull extends BugComment {
  author_name: string;
  author_email: string;
}

interface AttachmentFull extends BugAttachment {
  uploader_name: string;
}

interface HistoryFull extends BugHistory {
  changer_name: string;
}

interface Profile { id: string; full_name: string; email: string; role: string; }

export default function BugDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, profile: myProfile } = useAuth();
  const isAdmin = myProfile?.role === 'admin';

  const [bug, setBug] = useState<BugFull | null>(null);
  const [comments, setComments] = useState<CommentFull[]>([]);
  const [attachments, setAttachments] = useState<AttachmentFull[]>([]);
  const [history, setHistory] = useState<HistoryFull[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<DriverBug>>({});
  const [saving, setSaving] = useState(false);

  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const [uploadingFile, setUploadingFile] = useState(false);
  const [deletingAttachment, setDeletingAttachment] = useState<string | null>(null);
  const [deletingComment, setDeletingComment] = useState<string | null>(null);

  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [tab, setTab] = useState<'comments' | 'history' | 'attachments'>('comments');

  useEffect(() => { loadAll(); }, [id]);

  const loadAll = async () => {
    setLoading(true);
    const [bugRes, commentsRes, attachmentsRes, historyRes, profilesRes] = await Promise.all([
      supabase.from('driver_bugs').select('*, reporter:profiles!reporter_id(full_name, email), assignee:profiles!assigned_to_id(full_name, email)').eq('id', id).maybeSingle(),
      supabase.from('bug_comments').select('*, author:profiles!author_id(full_name, email)').eq('bug_id', id).order('created_at', { ascending: true }),
      supabase.from('bug_attachments').select('*, uploader:profiles!uploader_id(full_name, email)').eq('bug_id', id).order('created_at', { ascending: true }),
      supabase.from('bug_history').select('*, changer:profiles!changed_by_id(full_name, email)').eq('bug_id', id).order('changed_at', { ascending: true }),
      supabase.from('profiles').select('id, full_name, email, role').eq('active', true),
    ]);

    if (!bugRes.data) { toast.error('Bug not found'); router.push('/bugs'); return; }

    const b = bugRes.data as any;
    setBug({ ...b, reporter_name: b.reporter?.full_name || b.reporter?.email || 'Unknown', reporter_email: b.reporter?.email || '', assigned_name: b.assignee ? (b.assignee.full_name || b.assignee.email) : null, assigned_email: b.assignee?.email || null });
    setEditForm({ status: b.status, priority: b.priority, severity: b.severity, assigned_to_id: b.assigned_to_id, due_date: b.due_date });

    const rawComments = (commentsRes.data || []) as any[];
    setComments(rawComments.map(c => ({ ...c, author_name: c.author?.full_name || c.author?.email || 'Unknown', author_email: c.author?.email || '' })));

    const rawAtts = (attachmentsRes.data || []) as any[];
    setAttachments(rawAtts.map(a => ({ ...a, uploader_name: a.uploader?.full_name || a.uploader?.email || 'Unknown' })));

    const rawHist = (historyRes.data || []) as any[];
    setHistory(rawHist.map(h => ({ ...h, changer_name: h.changer?.full_name || h.changer?.email || 'Unknown' })));

    setAllProfiles((profilesRes.data || []) as Profile[]);
    setLoading(false);
  };

  const recordHistory = async (field: string, oldVal: string | null, newVal: string | null) => {
    if (!user || oldVal === newVal) return;
    await supabase.from('bug_history').insert({ bug_id: id, changed_by_id: user.id, field_name: field, old_value: oldVal, new_value: newVal });
  };

  const handleSaveEdit = async () => {
    if (!bug || !user) return;
    setSaving(true);
    const changes: Record<string, any> = { updated_at: new Date().toISOString() };
    const historyEntries: Array<[string, string | null, string | null]> = [];

    if (editForm.status !== bug.status) { changes.status = editForm.status; historyEntries.push(['status', bug.status, editForm.status || null]); if (editForm.status === 'Resolved' || editForm.status === 'Closed') changes.resolved_at = new Date().toISOString(); }
    if (editForm.priority !== bug.priority) { changes.priority = editForm.priority; historyEntries.push(['priority', bug.priority, editForm.priority || null]); }
    if (editForm.severity !== bug.severity) { changes.severity = editForm.severity; historyEntries.push(['severity', bug.severity, editForm.severity || null]); }
    if (editForm.assigned_to_id !== bug.assigned_to_id) {
      changes.assigned_to_id = editForm.assigned_to_id || null;
      changes.assigned_at = editForm.assigned_to_id ? new Date().toISOString() : null;
      const oldName = bug.assigned_name || 'Unassigned';
      const newProfile = allProfiles.find(p => p.id === editForm.assigned_to_id);
      const newName = newProfile ? (newProfile.full_name || newProfile.email) : 'Unassigned';
      historyEntries.push(['assigned_to', oldName, newName]);
    }
    if (editForm.due_date !== bug.due_date) { changes.due_date = editForm.due_date || null; historyEntries.push(['due_date', bug.due_date, editForm.due_date || null]); }

    const { error } = await supabase.from('driver_bugs').update(changes).eq('id', id);
    if (error) { toast.error('Failed to save changes'); setSaving(false); return; }
    for (const [field, oldVal, newVal] of historyEntries) await recordHistory(field, oldVal, newVal);
    toast.success('Bug updated');
    setEditing(false);
    setSaving(false);
    loadAll();
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !user) return;
    setSubmittingComment(true);
    const { error } = await supabase.from('bug_comments').insert({ bug_id: id, author_id: user.id, body: commentText.trim() });
    if (error) { toast.error('Failed to add comment'); }
    else {
      await supabase.from('driver_bugs').update({ updated_at: new Date().toISOString() }).eq('id', id);
      await recordHistory('comment', null, 'Comment added');
      setCommentText('');
      toast.success('Comment added');
      loadAll();
    }
    setSubmittingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    setDeletingComment(commentId);
    await supabase.from('bug_comments').delete().eq('id', commentId);
    setDeletingComment(null);
    toast.success('Comment deleted');
    loadAll();
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !user) return;
    setUploadingFile(true);
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('bug-attachments').upload(path, file);
      if (!uploadError) {
        await supabase.from('bug_attachments').insert({ bug_id: id, uploader_id: user.id, file_name: file.name, file_size: file.size, mime_type: file.type, storage_path: path });
        await recordHistory('attachment', null, `Attached: ${file.name}`);
      }
    }
    await supabase.from('driver_bugs').update({ updated_at: new Date().toISOString() }).eq('id', id);
    toast.success('File uploaded');
    setUploadingFile(false);
    loadAll();
  };

  const handleDeleteAttachment = async (att: AttachmentFull) => {
    setDeletingAttachment(att.id);
    await supabase.storage.from('bug-attachments').remove([att.storage_path]);
    await supabase.from('bug_attachments').delete().eq('id', att.id);
    setDeletingAttachment(null);
    toast.success('Attachment removed');
    loadAll();
  };

  const getAttachmentUrl = (path: string) => {
    const { data } = supabase.storage.from('bug-attachments').getPublicUrl(path);
    return data.publicUrl;
  };

  const insertCommentMarkup = (before: string, after = '') => {
    const ta = commentRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const val = ta.value;
    const selected = val.slice(start, end);
    const newVal = val.slice(0, start) + before + selected + after + val.slice(end);
    setCommentText(newVal);
    requestAnimationFrame(() => { ta.selectionStart = start + before.length; ta.selectionEnd = start + before.length + selected.length; ta.focus(); });
  };

  const historyLabel = (field: string) => {
    const map: Record<string, string> = { status: 'Status', priority: 'Priority', severity: 'Severity', assigned_to: 'Assigned To', due_date: 'Due Date', comment: 'Comment', attachment: 'Attachment' };
    return map[field] || field;
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!bug) return null;

  const canEdit = isAdmin || bug.reporter_id === user?.id;

  return (
    <div>
      <TopNav
        title={`${formatBugId(bug.bug_number)} — ${bug.title}`}
        description={`${bug.software_version ? `v${bug.software_version}` : ''} · Reported ${formatDistanceToNow(new Date(bug.created_at), { addSuffix: true })}`}
        actions={
          <button onClick={() => router.push('/bugs')} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" /> All Bugs
          </button>
        }
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-5 max-w-7xl">

        {/* Left: main content */}
        <div className="xl:col-span-2 space-y-5">

          {/* Bug body */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-lg font-bold text-foreground leading-tight">{bug.title}</h1>
              {canEdit && !editing && (
                <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg text-muted-foreground hover:bg-accent transition-colors flex-shrink-0">
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(bug.status)}`}>{bug.status}</span>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${priorityColor(bug.priority)}`}>P: {bug.priority}</span>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${severityColor(bug.severity)}`}>S: {bug.severity}</span>
              {bug.software_version && <code className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted font-mono">{bug.software_version}</code>}
            </div>

            {bug.description && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm text-foreground bg-muted/30 rounded-lg p-3 border border-border">{bug.description}</pre>
              </div>
            )}

            {(bug.expected_behavior || bug.actual_behavior) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {bug.expected_behavior && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-lg">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Expected</p>
                    <p className="text-sm text-foreground">{bug.expected_behavior}</p>
                  </div>
                )}
                {bug.actual_behavior && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1 flex items-center gap-1"><X className="w-3 h-3" /> Actual</p>
                    <p className="text-sm text-foreground">{bug.actual_behavior}</p>
                  </div>
                )}
              </div>
            )}

            {bug.steps_to_reproduce && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Steps to Reproduce</p>
                <pre className="whitespace-pre-wrap text-sm font-sans text-foreground bg-muted/30 rounded-lg p-3 border border-border">{bug.steps_to_reproduce}</pre>
              </div>
            )}
            {bug.workaround && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Workaround</p>
                <p className="text-sm text-foreground">{bug.workaround}</p>
              </div>
            )}
            {bug.additional_notes && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Additional Notes</p>
                <p className="text-sm text-foreground">{bug.additional_notes}</p>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex border-b border-border">
              {([
                ['comments', `Comments (${comments.length})`],
                ['attachments', `Attachments (${attachments.length})`],
                ['history', `History (${history.length})`],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Comments tab */}
            {tab === 'comments' && (
              <div className="p-4 space-y-4">
                {comments.length === 0 && (
                  <div className="text-center py-8">
                    <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No comments yet</p>
                  </div>
                )}
                {comments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-semibold">{c.author_name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">{c.author_name}</span>
                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                        {(isAdmin || c.author_id === user?.id) && (
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            disabled={deletingComment === c.id}
                            className="ml-auto p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete comment"
                          >
                            {deletingComment === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-sm text-foreground bg-muted/20 rounded-lg p-3 border border-border">{c.body}</pre>
                    </div>
                  </div>
                ))}

                {user && (
                  <div className="pt-2 border-t border-border">
                    <div className="border border-border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                      <div className="flex items-center gap-1 px-2 py-1.5 bg-muted/40 border-b border-border">
                        {[
                          { icon: Bold, action: () => insertCommentMarkup('**', '**'), title: 'Bold' },
                          { icon: Italic, action: () => insertCommentMarkup('*', '*'), title: 'Italic' },
                          { icon: Code, action: () => insertCommentMarkup('`', '`'), title: 'Code' },
                          { icon: List, action: () => insertCommentMarkup('\n- '), title: 'List' },
                          { icon: Link2, action: () => insertCommentMarkup('[', '](url)'), title: 'Link' },
                        ].map(({ icon: Icon, action, title }) => (
                          <button key={title} type="button" onClick={action} title={title} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                            <Icon className="w-3.5 h-3.5" />
                          </button>
                        ))}
                      </div>
                      <textarea
                        ref={commentRef}
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        rows={3}
                        placeholder="Add a comment… Markdown supported"
                        className="w-full px-3 py-2 text-sm bg-background focus:outline-none resize-none font-mono"
                      />
                    </div>
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={handleAddComment}
                        disabled={submittingComment || !commentText.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {submittingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
                        Add Comment
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Attachments tab */}
            {tab === 'attachments' && (
              <div className="p-4 space-y-3">
                {user && (
                  <label className={`flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer w-fit ${uploadingFile ? 'opacity-60 pointer-events-none' : ''}`}>
                    {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploadingFile ? 'Uploading…' : 'Upload File'}
                    <input type="file" multiple className="hidden" onChange={e => handleFileUpload(e.target.files)} />
                  </label>
                )}
                {attachments.length === 0 ? (
                  <div className="text-center py-8">
                    <Paperclip className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No attachments</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {attachments.map(att => {
                      const isImage = att.mime_type.startsWith('image/');
                      return (
                        <div key={att.id} className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border border-border">
                          {isImage ? (
                            <a href={getAttachmentUrl(att.storage_path)} target="_blank" rel="noopener noreferrer">
                              <ImageIcon className="w-8 h-8 text-blue-500 flex-shrink-0" />
                            </a>
                          ) : (
                            <FileText className="w-8 h-8 text-muted-foreground flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <a href={getAttachmentUrl(att.storage_path)} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground hover:text-primary truncate block">{att.file_name}</a>
                            <p className="text-xs text-muted-foreground">{formatBytes(att.file_size)} · {att.uploader_name} · {formatDistanceToNow(new Date(att.created_at), { addSuffix: true })}</p>
                          </div>
                          {(isAdmin || att.uploader_id === user?.id) && (
                            <button
                              onClick={() => handleDeleteAttachment(att)}
                              disabled={deletingAttachment === att.id}
                              className="p-1 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                              title="Delete attachment"
                            >
                              {deletingAttachment === att.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* History tab */}
            {tab === 'history' && (
              <div className="p-4">
                {history.length === 0 ? (
                  <div className="text-center py-8">
                    <History className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No history yet</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                    <div className="space-y-4 pl-10">
                      {history.map(h => (
                        <div key={h.id} className="relative">
                          <div className="absolute -left-6 w-3 h-3 rounded-full bg-border border-2 border-card top-1" />
                          <div className="bg-muted/20 rounded-lg p-3 border border-border">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-semibold text-foreground">{h.changer_name}</span>
                              <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(h.changed_at), { addSuffix: true })}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {historyLabel(h.field_name)}
                              {h.old_value && <> · <span className="line-through">{h.old_value}</span></>}
                              {h.new_value && <> → <span className="text-foreground font-medium">{h.new_value}</span></>}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: sidebar with meta */}
        <div className="space-y-4">

          {/* Edit panel (admin/owner) */}
          {canEdit && editing ? (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Edit Bug</h3>
                <button onClick={() => setEditing(false)} className="p-1 text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
                <select value={editForm.status || ''} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as BugStatus }))} className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                  {BUG_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
                <select value={editForm.priority || ''} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value as BugPriority }))} className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                  {BUG_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Severity</label>
                <select value={editForm.severity || ''} onChange={e => setEditForm(f => ({ ...f, severity: e.target.value as BugSeverity }))} className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                  {BUG_SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Assign To</label>
                  <select value={editForm.assigned_to_id || ''} onChange={e => setEditForm(f => ({ ...f, assigned_to_id: e.target.value || undefined }))} className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Unassigned</option>
                    {allProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
                  </select>
                </div>
              )}
              {isAdmin && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Due Date</label>
                  <input type="date" value={editForm.due_date || ''} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={handleSaveEdit} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors flex-1 justify-center">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </button>
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Details</h3>
                {canEdit && <button onClick={() => setEditing(true)} className="p-1 text-muted-foreground hover:text-foreground transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>}
              </div>
              {[
                ['Status', <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(bug.status)}`}>{bug.status}</span>],
                ['Priority', <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priorityColor(bug.priority)}`}>{bug.priority}</span>],
                ['Severity', <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${severityColor(bug.severity)}`}>{bug.severity}</span>],
                ['Reproducibility', <span className="text-xs text-foreground">{bug.reproducibility}</span>],
                ['Reporter', <span className="text-xs text-foreground">{bug.reporter_name}</span>],
                ['Assigned To', <span className="text-xs text-foreground">{bug.assigned_name || <span className="text-muted-foreground">Unassigned</span>}</span>],
                ['Due Date', bug.due_date ? <span className="text-xs text-foreground">{format(new Date(bug.due_date), 'MMM d, yyyy')}</span> : <span className="text-xs text-muted-foreground">—</span>],
                ['Created', <span className="text-xs text-muted-foreground">{format(new Date(bug.created_at), 'MMM d, yyyy')}</span>],
                ['Updated', <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(bug.updated_at), { addSuffix: true })}</span>],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-start justify-between gap-2">
                  <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
                  <div className="text-right">{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Environment */}
          {(bug.software_version || bug.build_version || bug.affected_module || bug.affected_driver || bug.operating_system || bug.browser) && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Environment</h3>
              {[
                ['Software', bug.software_version],
                ['Build', bug.build_version],
                ['Module', bug.affected_module],
                ['Driver', bug.affected_driver],
                ['OS', bug.operating_system],
                ['Browser', bug.browser],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k as string} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{k}</span>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{v}</code>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
