'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { TopNav } from '@/components/top-nav';
import { BUG_STATUSES, BUG_PRIORITIES, BUG_SEVERITIES, BUG_REPRODUCIBILITIES, formatBytes } from '@/lib/bug-utils';
import { toast } from 'sonner';
import {
  ChevronLeft, Loader2, Upload, X, Image as ImageIcon, FileText, AlertTriangle,
  Bold, Italic, List, Link2, Code,
} from 'lucide-react';

interface PendingAttachment {
  file: File;
  preview: string | null;
  id: string;
}

export default function NewBugPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    software_version: '',
    build_version: '',
    affected_module: '',
    affected_driver: '',
    operating_system: '',
    browser: '',
    priority: 'Medium',
    severity: 'Major',
    reproducibility: 'N/A',
    expected_behavior: '',
    actual_behavior: '',
    steps_to_reproduce: '',
    workaround: '',
    additional_notes: '',
  });

  const set = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  // Simple rich text helpers — insert markdown-style markup around selection
  const insertMarkup = (before: string, after = '') => {
    const ta = descRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const val = ta.value;
    const selected = val.slice(start, end);
    const newVal = val.slice(0, start) + before + selected + after + val.slice(end);
    setForm(prev => ({ ...prev, description: newVal }));
    requestAnimationFrame(() => {
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + selected.length;
      ta.focus();
    });
  };

  const addFiles = useCallback((files: File[]) => {
    const allowed = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp',
      'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip', 'application/x-7z-compressed', 'text/plain', 'text/csv',
      'application/xml', 'text/xml', 'application/json', 'application/octet-stream'];
    const validFiles = files.filter(f => allowed.includes(f.type) || f.name.match(/\.(xrio|cfg|comtrade|dat|log)$/i));
    validFiles.forEach(file => {
      const id = crypto.randomUUID();
      const isImage = file.type.startsWith('image/');
      if (isImage) {
        const reader = new FileReader();
        reader.onload = e => setAttachments(prev => [...prev, { file, preview: e.target?.result as string, id }]);
        reader.readAsDataURL(file);
      } else {
        setAttachments(prev => [...prev, { file, preview: null, id }]);
      }
    });
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const files = items.filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean) as File[];
    if (files.length > 0) { e.preventDefault(); addFiles(files); }
  }, [addFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error('You must be logged in'); return; }
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.description.trim()) { toast.error('Description is required'); return; }
    if (!form.software_version.trim()) { toast.error('Software version is required'); return; }

    setSaving(true);
    try {
      const { data: bug, error } = await supabase
        .from('driver_bugs')
        .insert({
          ...form,
          reporter_id: user.id,
        })
        .select('id, bug_number')
        .single();

      if (error || !bug) { toast.error('Failed to create bug report'); setSaving(false); return; }

      // Upload attachments
      for (const att of attachments) {
        const ext = att.file.name.split('.').pop();
        const path = `${user.id}/${bug.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('bug-attachments').upload(path, att.file);
        if (!uploadError) {
          await supabase.from('bug_attachments').insert({
            bug_id: bug.id,
            uploader_id: user.id,
            file_name: att.file.name,
            file_size: att.file.size,
            mime_type: att.file.type,
            storage_path: path,
          });
        }
      }

      // Add history entry
      await supabase.from('bug_history').insert({
        bug_id: bug.id,
        changed_by_id: user.id,
        field_name: 'status',
        old_value: null,
        new_value: 'New',
      });

      toast.success(`Bug BUG-${String(bug.bug_number).padStart(4, '0')} created`);
      router.push(`/bugs/${bug.id}`);
    } catch {
      toast.error('Unexpected error');
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof form, required = false, placeholder = '', hint = '') => (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={form[key]}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );

  const textarea = (label: string, key: keyof typeof form, rows = 3, placeholder = '') => (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <textarea
        value={form[key]}
        onChange={e => set(key, e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-vertical"
      />
    </div>
  );

  const selectField = (label: string, key: keyof typeof form, options: readonly string[]) => (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <select
        value={form[key]}
        onChange={e => set(key, e.target.value)}
        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div>
      <TopNav
        title="Report New Bug"
        description="Submit a new bug report to the Driver Bug Tracker"
        actions={
          <button onClick={() => router.back()} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </button>
        }
      />

      <form onSubmit={handleSubmit} className="p-6 max-w-4xl space-y-6">

        {/* Basic info */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm"><AlertTriangle className="w-4 h-4 text-red-500" /> Bug Details</h2>
          {field('Title', 'title', true, 'Brief summary of the issue')}

          {/* Rich description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Description <span className="text-red-500">*</span></label>
            <div className="border border-border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-ring">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-muted/40 border-b border-border">
                {[
                  { icon: Bold, title: 'Bold', action: () => insertMarkup('**', '**') },
                  { icon: Italic, title: 'Italic', action: () => insertMarkup('*', '*') },
                  { icon: Code, title: 'Inline code', action: () => insertMarkup('`', '`') },
                  { icon: List, title: 'Bullet list', action: () => insertMarkup('\n- ') },
                  { icon: Link2, title: 'Link', action: () => insertMarkup('[', '](url)') },
                ].map(({ icon: Icon, title, action }) => (
                  <button
                    key={title}
                    type="button"
                    onClick={action}
                    title={title}
                    className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
                <span className="text-xs text-muted-foreground/60 ml-2">Markdown supported</span>
              </div>
              <textarea
                ref={descRef}
                value={form.description}
                onChange={e => set('description', e.target.value)}
                onPaste={handlePaste}
                rows={8}
                placeholder="Describe the bug in detail. You can paste images directly here."
                className="w-full px-3 py-2 text-sm bg-background focus:outline-none resize-vertical font-mono"
              />
            </div>
          </div>

          {field('Software Version', 'software_version', true, 'e.g. v3.2.1')}
          {field('Build Version', 'build_version', false, 'e.g. 2024.05.30-build-142')}
        </div>

        {/* Classification */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-foreground text-sm">Classification</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {selectField('Priority', 'priority', BUG_PRIORITIES)}
            {selectField('Severity', 'severity', BUG_SEVERITIES)}
            {selectField('Reproducibility', 'reproducibility', BUG_REPRODUCIBILITIES)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Affected Module', 'affected_module', false, 'e.g. RTMS, Database, UI')}
            {field('Affected Driver', 'affected_driver', false, 'e.g. SEL-351, GE D60')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Operating System', 'operating_system', false, 'e.g. Windows 11')}
            {field('Browser', 'browser', false, 'e.g. Chrome 124')}
          </div>
        </div>

        {/* Behavior & Steps */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-foreground text-sm">Behavior & Reproduction</h2>
          {textarea('Expected Behavior', 'expected_behavior', 3, 'What should happen?')}
          {textarea('Actual Behavior', 'actual_behavior', 3, 'What actually happens?')}
          {textarea('Steps to Reproduce', 'steps_to_reproduce', 5, '1. Open...\n2. Click...\n3. See error...')}
          {textarea('Workaround', 'workaround', 2, 'Any known workaround?')}
          {textarea('Additional Notes', 'additional_notes', 3, 'Any other relevant information...')}
        </div>

        {/* Attachments */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-foreground text-sm flex items-center gap-2"><Upload className="w-4 h-4" /> Attachments</h2>

          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-border/70'}`}
          >
            <Upload className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-1">Drag & drop files here, or</p>
            <label className="cursor-pointer text-sm text-primary hover:underline">
              browse files
              <input
                type="file"
                multiple
                className="hidden"
                accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.docx,.xlsx,.zip,.7z,.txt,.csv,.log,.xml,.json,.xrio,.cfg,.dat"
                onChange={e => addFiles(Array.from(e.target.files || []))}
              />
            </label>
            <p className="text-xs text-muted-foreground/60 mt-2">PNG, JPG, GIF, WebP, PDF, DOCX, XLSX, ZIP, TXT, CSV, LOG, XML, JSON, XRIO, CFG, DAT</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">You can also paste images from clipboard in the description field</p>
          </div>

          {attachments.length > 0 && (
            <div className="space-y-2">
              {attachments.map(att => (
                <div key={att.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                  {att.preview ? (
                    <img src={att.preview} alt={att.file.name} className="w-10 h-10 object-cover rounded border border-border flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 bg-muted rounded border border-border flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{att.file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(att.file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                    className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pb-8">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            {saving ? 'Submitting…' : 'Submit Bug Report'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
