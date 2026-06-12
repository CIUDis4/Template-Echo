'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { X, Paperclip, Upload, Loader2 } from 'lucide-react';
import type { FeedbackEntry } from '@/lib/database.types';

interface FeedbackFormProps {
  relayModelId: string;
  onSuccess: () => void;
  onCancel: () => void;
  editEntry?: FeedbackEntry;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/zip', 'text/plain', 'application/octet-stream'];

export function FeedbackForm({ relayModelId, onSuccess, onCancel, editEntry }: FeedbackFormProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState(editEntry?.title || '');
  const [description, setDescription] = useState(editEntry?.description || '');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>(editEntry?.severity || 'medium');
  const [estimatedHours, setEstimatedHours] = useState(editEntry?.estimated_fix_hours?.toString() || '1');
  const [status, setStatus] = useState(editEntry?.status || 'open');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter(f => {
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name} exceeds 20MB limit`);
        return false;
      }
      return true;
    });
    setFiles(prev => [...prev, ...valid]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) { toast.error('Title is required'); return; }

    setSubmitting(true);
    try {
      let entryId = editEntry?.id;

      if (editEntry) {
        const { error } = await supabase
          .from('feedback_entries')
          .update({ title, description, severity, estimated_fix_hours: parseFloat(estimatedHours) || 1, status })
          .eq('id', editEntry.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('feedback_entries')
          .insert({
            relay_model_id: relayModelId,
            user_id: user.id,
            title,
            description,
            severity,
            estimated_fix_hours: parseFloat(estimatedHours) || 1,
            status: 'open',
          })
          .select()
          .single();
        if (error) throw error;
        entryId = data.id;

        // Log activity
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'feedback_submitted',
          entity_type: 'feedback_entry',
          entity_id: data.id,
          details: { title, severity },
        });
      }

      // Upload attachments
      if (files.length > 0 && entryId) {
        for (const file of files) {
          const path = `attachments/${entryId}/${Date.now()}_${file.name}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('feedback-files')
            .upload(path, file, { upsert: false });

          if (uploadError) {
            toast.warning(`Failed to upload ${file.name}: ${uploadError.message}`);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('feedback-files')
            .getPublicUrl(path);

          await supabase.from('feedback_attachments').insert({
            feedback_id: entryId,
            file_url: publicUrl,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
          });
        }
      }

      toast.success(editEntry ? 'Feedback updated' : 'Feedback submitted successfully');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Issue Title <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Brief description of the issue"
          required
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Description
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Detailed description of the issue, steps to reproduce, expected vs actual behavior..."
          rows={5}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Severity</label>
          <select
            value={severity}
            onChange={e => setSeverity(e.target.value as typeof severity)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Estimated Fix Hours</label>
          <input
            type="number"
            value={estimatedHours}
            onChange={e => setEstimatedHours(e.target.value)}
            min="0"
            step="0.5"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {editEntry && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as 'open' | 'in_progress' | 'resolved' | 'closed')}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      )}

      {/* File uploads */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Attachments
        </label>
        <div
          className="border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-1.5 text-center">
            <Upload className="w-6 h-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Click to upload images, PDFs, ZIPs, or logs
            </p>
            <p className="text-xs text-muted-foreground">Max 20MB per file</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
            accept="image/*,.pdf,.zip,.log,.txt"
          />
        </div>
        {files.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {files.map((file, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm">
                <Paperclip className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 truncate text-foreground">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(1)}MB
                </span>
                <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {editEntry ? 'Save Changes' : 'Submit Feedback'}
        </button>
      </div>
    </form>
  );
}
