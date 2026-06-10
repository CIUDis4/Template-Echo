'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { TopNav } from '@/components/top-nav';
import { toast } from 'sonner';
import {
  ChevronLeft, ThumbsUp, MessageSquare, Paperclip, Send, Loader2,
  Edit2, Save, X, FileText, Download, Lock, Trash2,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  TR_STATUSES, TR_PRIORITIES, TR_TYPES, TR_MANUFACTURERS, TR_REGIONS,
  TR_STATUS_COLORS, TR_PRIORITY_COLORS,
} from '@/lib/database.types';
import type { TemplateRequest, TemplateRequestComment, TemplateRequestAttachment, TRStatus, TRPriority } from '@/lib/database.types';

interface CommentRow extends TemplateRequestComment { author_name: string; author_initial: string; }
interface FullRequest extends TemplateRequest { submitter_name: string; vote_count: number; my_vote: boolean; comments: CommentRow[]; attachments: TemplateRequestAttachment[]; }

const EXTS = ['.pdf', '.docx', '.xlsx', '.zip', '.rar', '.png', '.jpg', '.jpeg', '.cfg', '.dat', '.hdr'];
const MAX = 50 * 1024 * 1024;
const fmtBytes = (b: number) => b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
const inputCls = 'w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring';

export default function TemplateRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [req, setReq] = useState<FullRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentBody, setCommentBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<TemplateRequest>>({});
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    setLoading(true);
    const [reqRes, votesRes, commentsRes, attachRes, profilesRes] = await Promise.all([
      supabase.from('template_requests').select('*').eq('id', id).single(),
      supabase.from('template_request_votes').select('user_id').eq('request_id', id),
      supabase.from('template_request_comments').select('*').eq('request_id', id).order('created_at', { ascending: true }),
      supabase.from('template_request_attachments').select('*').eq('request_id', id).is('comment_id', null),
      supabase.from('profiles').select('id, full_name, email'),
    ]);
    if (reqRes.error || !reqRes.data) { toast.error('Request not found'); router.push('/template-requests'); return; }
    const pm = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
    const data = reqRes.data as TemplateRequest;
    const voters = (votesRes.data || []).map((v: any) => v.user_id);
    const sub: any = pm.get(data.submitted_by);
    const comments: CommentRow[] = ((commentsRes.data || []) as TemplateRequestComment[])
      .filter(c => !c.is_internal || isAdmin)
      .map(c => { const p: any = pm.get(c.user_id); return { ...c, author_name: p?.full_name || p?.email || 'Unknown', author_initial: (p?.full_name || p?.email || 'U').charAt(0).toUpperCase() }; });
    setReq({ ...data, submitter_name: sub?.full_name || sub?.email || 'Unknown', vote_count: voters.length, my_vote: !!user && voters.includes(user.id), comments, attachments: (attachRes.data || []) as TemplateRequestAttachment[] });
    setLoading(false);
  };

  const handleVote = async () => {
    if (!user || !req) return;
    if (req.my_vote) await supabase.from('template_request_votes').delete().eq('request_id', id).eq('user_id', user.id);
    else await supabase.from('template_request_votes').insert({ request_id: id, user_id: user.id });
    load();
  };

  const handleComment = async () => {
    if (!commentBody.trim() || !user) return;
    setPosting(true);
    const { data: cd, error } = await supabase.from('template_request_comments')
      .insert({ request_id: id, user_id: user.id, body: commentBody.trim(), is_internal: isAdmin && isInternal })
      .select('id').single();
    if (error) { toast.error('Failed to post'); setPosting(false); return; }
    for (const f of commentFiles) {
      const path = `${user.id}/${id}/comments/${Date.now()}_${f.name}`;
      const { error: ue } = await supabase.storage.from('template-request-attachments').upload(path, f);
      if (!ue) await supabase.from('template_request_attachments').insert({ request_id: id, comment_id: cd.id, user_id: user.id, file_name: f.name, file_size: f.size, mime_type: f.type || 'application/octet-stream', storage_path: path });
    }
    setCommentBody(''); setCommentFiles([]); setIsInternal(false); setPosting(false);
    load();
  };

  const deleteComment = async (cid: string) => {
    await supabase.from('template_request_comments').delete().eq('id', cid);
    load();
  };

  const handleStatusChange = async (status: string) => {
    await supabase.from('template_requests').update({ status }).eq('id', id);
    toast.success('Status updated'); load();
  };

  const startEdit = () => {
    if (!req) return;
    setEditForm({ title: req.title, manufacturer: req.manufacturer, relay_model: req.relay_model, firmware_version: req.firmware_version, request_type: req.request_type, justification: req.justification, customer_utility: req.customer_utility, region: req.region, priority: req.priority, status: req.status, internal_notes: req.internal_notes });
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    const { error } = await supabase.from('template_requests').update(editForm).eq('id', id);
    if (error) { toast.error('Save failed'); setSaving(false); return; }
    toast.success('Updated'); setEditing(false); setSaving(false); load();
  };

  const download = async (att: TemplateRequestAttachment) => {
    const { data } = await supabase.storage.from('template-request-attachments').createSignedUrl(att.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    else toast.error('Could not generate link');
  };

  const addCommentFiles = (fl: FileList | null) => {
    if (!fl) return;
    Array.from(fl).forEach(f => {
      const ext = '.' + f.name.split('.').pop()!.toLowerCase();
      if (!EXTS.includes(ext) || f.size > MAX) return;
      setCommentFiles(p => [...p, f]);
    });
  };

  if (loading) return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 bg-muted rounded w-64" /><div className="h-40 bg-muted rounded" /><div className="h-60 bg-muted rounded" />
    </div>
  );
  if (!req) return null;

  return (
    <div>
      <TopNav title={`TR-${req.request_number}`} description={req.title}
        actions={
          <div className="flex items-center gap-2">
            {isAdmin && !editing && <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-accent transition-colors"><Edit2 className="w-3.5 h-3.5" /> Edit</button>}
            <button onClick={() => router.back()} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors"><ChevronLeft className="w-3.5 h-3.5" /> Back</button>
          </div>
        }
      />

      <div className="p-6 max-w-5xl space-y-5">
        {/* Main card */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          {editing ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Edit Request</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2"><label className="block text-xs font-medium text-muted-foreground mb-1">Title</label><input value={editForm.title || ''} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} className={inputCls} /></div>
                <div><label className="block text-xs font-medium text-muted-foreground mb-1">Manufacturer</label>
                  <select value={editForm.manufacturer || ''} onChange={e => setEditForm(p => ({ ...p, manufacturer: e.target.value }))} className={inputCls}>
                    {TR_MANUFACTURERS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-muted-foreground mb-1">Relay Model</label><input value={editForm.relay_model || ''} onChange={e => setEditForm(p => ({ ...p, relay_model: e.target.value }))} className={inputCls} /></div>
                <div><label className="block text-xs font-medium text-muted-foreground mb-1">Firmware Version</label><input value={editForm.firmware_version || ''} onChange={e => setEditForm(p => ({ ...p, firmware_version: e.target.value }))} className={inputCls} /></div>
                <div><label className="block text-xs font-medium text-muted-foreground mb-1">Request Type</label>
                  <select value={editForm.request_type || ''} onChange={e => setEditForm(p => ({ ...p, request_type: e.target.value as TemplateRequest['request_type'] }))} className={inputCls}>
                    {TR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
                  <select value={editForm.priority || ''} onChange={e => setEditForm(p => ({ ...p, priority: e.target.value as TRPriority }))} className={inputCls}>
                    {TR_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
                  <select value={editForm.status || ''} onChange={e => setEditForm(p => ({ ...p, status: e.target.value as TRStatus }))} className={inputCls}>
                    {TR_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-muted-foreground mb-1">Customer / Utility</label><input value={editForm.customer_utility || ''} onChange={e => setEditForm(p => ({ ...p, customer_utility: e.target.value }))} className={inputCls} /></div>
                <div><label className="block text-xs font-medium text-muted-foreground mb-1">Region</label>
                  <select value={editForm.region || ''} onChange={e => setEditForm(p => ({ ...p, region: e.target.value }))} className={inputCls}>
                    <option value="">—</option>{TR_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2"><label className="block text-xs font-medium text-muted-foreground mb-1">Business Justification</label><textarea value={editForm.justification || ''} onChange={e => setEditForm(p => ({ ...p, justification: e.target.value }))} rows={3} className={`${inputCls} resize-y`} /></div>
                <div className="sm:col-span-2"><label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Lock className="w-3 h-3" /> Internal Notes (admin only)</label><textarea value={editForm.internal_notes || ''} onChange={e => setEditForm(p => ({ ...p, internal_notes: e.target.value }))} rows={2} className={`${inputCls} resize-y`} /></div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 disabled:opacity-60">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                </button>
                <button onClick={() => setEditing(false)} className="px-4 py-2 border border-border text-sm rounded-lg hover:bg-accent">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-xs font-mono text-muted-foreground">TR-{req.request_number}</span>
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${TR_STATUS_COLORS[req.status as TRStatus] || ''}`}>{req.status}</span>
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${TR_PRIORITY_COLORS[req.priority as TRPriority] || ''}`}>{req.priority}</span>
                  </div>
                  <h1 className="text-lg font-semibold text-foreground leading-tight">{req.title}</h1>
                </div>
                <button onClick={handleVote}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all flex-shrink-0 ${req.my_vote ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600' : 'bg-background text-muted-foreground border-border hover:text-blue-600 hover:border-blue-400'}`}>
                  <ThumbsUp className="w-4 h-4" />{req.vote_count} Support{req.vote_count !== 1 ? 's' : ''}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 pt-2 border-t border-border/50">
                {[['Manufacturer', req.manufacturer], ['Relay Model', req.relay_model], ['Firmware Version', req.firmware_version || '—'], ['Request Type', req.request_type], ['Region', req.region || '—'], ['Customer / Utility', req.customer_utility || '—'], ['Submitted By', req.submitter_name], ['Created', format(new Date(req.created_at), 'dd MMM yyyy')], ['Updated', format(new Date(req.updated_at), 'dd MMM yyyy')]].map(([l, v]) => (
                  <div key={l}><p className="text-xs text-muted-foreground mb-0.5">{l}</p><p className="text-sm font-medium text-foreground">{v}</p></div>
                ))}
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2 pt-2 border-t border-border/50 flex-wrap">
                  <span className="text-xs text-muted-foreground">Change status:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {TR_STATUSES.map(s => (
                      <button key={s} onClick={() => handleStatusChange(s)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all border ${req.status === s ? TR_STATUS_COLORS[s] + ' border-transparent ring-2 ring-offset-1 ring-primary/50' : 'border-border text-muted-foreground hover:bg-accent'}`}>{s}</button>
                    ))}
                  </div>
                </div>
              )}

              {req.justification && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Business Justification</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{req.justification}</p>
                </div>
              )}

              {isAdmin && req.internal_notes && (
                <div className="pt-2 border-t border-border/50 bg-amber-50/50 dark:bg-amber-900/10 rounded-lg p-3">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1"><Lock className="w-3 h-3" /> Internal Notes</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{req.internal_notes}</p>
                </div>
              )}
            </>
          )}
        </div>

        {req.attachments.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Paperclip className="w-4 h-4" /> Attachments ({req.attachments.length})</h3>
            <div className="space-y-1.5">
              {req.attachments.map(att => (
                <button key={att.id} onClick={() => download(att)} className="w-full flex items-center gap-3 px-3 py-2 bg-muted/40 hover:bg-muted/70 rounded-lg transition-colors text-left">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 text-sm text-foreground truncate">{att.file_name}</span>
                  <span className="text-xs text-muted-foreground">{fmtBytes(att.file_size)}</span>
                  <Download className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Discussion ({req.comments.length})</h3>
          </div>
          {req.comments.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-8">No comments yet. Start the discussion!</p>
            : (
              <div className="divide-y divide-border/50">
                {req.comments.map(c => (
                  <div key={c.id} className={`flex gap-3 px-5 py-4 ${c.is_internal ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-blue-700 dark:text-blue-400 text-xs font-semibold">{c.author_initial}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{c.author_name}</span>
                        {c.is_internal && <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> Internal</span>}
                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{c.body}</p>
                    </div>
                    {(user?.id === c.user_id || isAdmin) && (
                      <button onClick={() => deleteComment(c.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                ))}
              </div>
            )
          }

          {user && (
            <div className="px-5 py-4 border-t border-border bg-muted/20 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary-foreground text-xs font-semibold">{(profile?.full_name || profile?.email || 'U').charAt(0).toUpperCase()}</span>
                </div>
                <textarea value={commentBody} onChange={e => setCommentBody(e.target.value)} rows={3} placeholder="Add a comment…"
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
              {commentFiles.length > 0 && (
                <div className="ml-11 space-y-1">
                  {commentFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="w-3.5 h-3.5" /><span className="truncate">{f.name}</span>
                      <button onClick={() => setCommentFiles(p => p.filter((_, j) => j !== i))} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 ml-11 flex-wrap">
                <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-accent text-muted-foreground transition-colors">
                  <Paperclip className="w-3 h-3" /> Attach
                </button>
                <input ref={fileRef} type="file" multiple className="hidden" accept={EXTS.join(',')} onChange={e => addCommentFiles(e.target.files)} />
                {isAdmin && (
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded" />
                    <Lock className="w-3 h-3" /> Internal note
                  </label>
                )}
                <button onClick={handleComment} disabled={!commentBody.trim() || posting}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors ml-auto">
                  {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Post Comment
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
