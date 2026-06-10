'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { TopNav } from '@/components/top-nav';
import { toast } from 'sonner';
import { ChevronLeft, Loader2, Save, Paperclip, X, FileText } from 'lucide-react';
import { TR_TYPES, TR_MANUFACTURERS, TR_REGIONS, TR_PRIORITIES } from '@/lib/database.types';
import type { TRType, TRPriority } from '@/lib/database.types';

const ALLOWED_EXTS = ['.pdf', '.docx', '.xlsx', '.zip', '.rar', '.png', '.jpg', '.jpeg', '.cfg', '.dat', '.hdr', '.comtrade'];
const MAX_MB = 50 * 1024 * 1024;
const fmtBytes = (b: number) => b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

const inputCls = 'w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-1.5';
const cardCls = 'bg-card border border-border rounded-xl p-5 space-y-4';

export default function NewTemplateRequestPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    title: '', manufacturer: '', relay_model: '', firmware_version: '',
    request_type: 'New Template' as TRType, justification: '', customer_utility: '',
    region: '', priority: 'Medium' as TRPriority,
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(p => ({ ...p, [k]: v }));

  if (!user) return <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Sign in to submit a request.</div>;

  const addFiles = (fl: FileList | null) => {
    if (!fl) return;
    Array.from(fl).forEach(f => {
      const ext = '.' + f.name.split('.').pop()!.toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) { toast.error(`${f.name}: unsupported type`); return; }
      if (f.size > MAX_MB) { toast.error(`${f.name}: exceeds 50 MB`); return; }
      if (files.some(x => x.name === f.name)) return;
      setFiles(p => [...p, f]);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.manufacturer) { toast.error('Manufacturer is required'); return; }
    if (!form.relay_model.trim()) { toast.error('Relay model is required'); return; }
    setSaving(true);

    const { data, error } = await supabase
      .from('template_requests')
      .insert({ ...form, title: form.title.trim(), relay_model: form.relay_model.trim(), firmware_version: form.firmware_version.trim(), justification: form.justification.trim(), customer_utility: form.customer_utility.trim(), submitted_by: user.id, status: 'New' })
      .select('id').single();

    if (error) { toast.error(error.message || 'Failed to submit'); setSaving(false); return; }

    for (const f of files) {
      const path = `${user.id}/${data.id}/${Date.now()}_${f.name}`;
      const { error: upErr } = await supabase.storage.from('template-request-attachments').upload(path, f);
      if (!upErr) {
        await supabase.from('template_request_attachments').insert({ request_id: data.id, user_id: user.id, file_name: f.name, file_size: f.size, mime_type: f.type || 'application/octet-stream', storage_path: path });
      }
    }

    toast.success('Template request submitted!');
    router.push(`/template-requests/${data.id}`);
  };

  return (
    <div>
      <TopNav title="New Template Request" description="Request development of a new RTMS template"
        actions={<button onClick={() => router.back()} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors"><ChevronLeft className="w-3.5 h-3.5" /> Back</button>} />

      <form onSubmit={handleSubmit} className="p-6 max-w-3xl space-y-5">
        <div className={cardCls}>
          <h2 className="text-sm font-semibold text-foreground">Request Details</h2>
          <div>
            <label className={labelCls}>Request Title <span className="text-red-500">*</span></label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. New SEL-411L Template for firmware 6.x" className={inputCls} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Manufacturer <span className="text-red-500">*</span></label>
              <select value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} className={inputCls}>
                <option value="">Select manufacturer…</option>
                {TR_MANUFACTURERS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Relay Model <span className="text-red-500">*</span></label>
              <input type="text" value={form.relay_model} onChange={e => set('relay_model', e.target.value)} placeholder="e.g. SEL-411L" className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Firmware Version</label>
              <input type="text" value={form.firmware_version} onChange={e => set('firmware_version', e.target.value)} placeholder="e.g. R702" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Request Type</label>
              <select value={form.request_type} onChange={e => set('request_type', e.target.value as TRType)} className={inputCls}>
                {TR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className={cardCls}>
          <h2 className="text-sm font-semibold text-foreground">Business Context</h2>
          <div>
            <label className={labelCls}>Business Justification</label>
            <textarea value={form.justification} onChange={e => set('justification', e.target.value)} rows={4} placeholder="Describe why this template is needed, the business value, and any relevant background…" className={`${inputCls} resize-y`} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Customer / Utility</label>
              <input type="text" value={form.customer_utility} onChange={e => set('customer_utility', e.target.value)} placeholder="e.g. National Grid" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Region</label>
              <select value={form.region} onChange={e => set('region', e.target.value)} className={inputCls}>
                <option value="">Select region…</option>
                {TR_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority Requested</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value as TRPriority)} className={inputCls}>
                {TR_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className={cardCls}>
          <h2 className="text-sm font-semibold text-foreground">Submitted By</h2>
          <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/40 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground text-xs font-semibold">{(profile?.full_name || profile?.email || 'U').charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{profile?.full_name || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
            </div>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded capitalize">{profile?.role}</span>
          </div>
        </div>

        <div className={cardCls}>
          <h2 className="text-sm font-semibold text-foreground">Attachments</h2>
          <p className="text-xs text-muted-foreground">PDF, DOCX, XLSX, ZIP, RAR, PNG, JPG, COMTRADE — max 50 MB each.</p>
          <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
            <Paperclip className="w-5 h-5 text-muted-foreground mb-1.5" />
            <span className="text-sm text-muted-foreground">Click to attach files</span>
            <span className="text-xs text-muted-foreground/60 mt-0.5">or drag and drop</span>
            <input type="file" multiple className="hidden" accept={ALLOWED_EXTS.join(',')} onChange={e => addFiles(e.target.files)} />
          </label>
          {files.length > 0 && (
            <div className="space-y-1.5">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 bg-muted/40 rounded-lg">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 text-sm text-foreground truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{fmtBytes(f.size)}</span>
                  <button type="button" onClick={() => setFiles(p => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pb-8">
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Submitting…' : 'Submit Request'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  );
}
