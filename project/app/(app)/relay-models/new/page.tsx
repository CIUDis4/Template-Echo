'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { TopNav } from '@/components/top-nav';
import { toast } from 'sonner';
import { ChevronLeft, Loader2, Cpu, Save } from 'lucide-react';

const MANUFACTURERS = [
  'ABB', 'ABB Westinghouse', 'Alfanar_SEL', 'Alstom', 'Basler', 'Beckwith',
  'ERL', 'GE', 'Megger', 'Micom', 'Nari', 'PowerShield', 'Reyrole',
  'SAS', 'Schneider', 'SEG', 'SEL', 'Sifang', 'SIEMENS', 'Woodward', 'ZIV',
];

export default function NewRelayModelPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    model_name: '',
    manufacturer: '',
    manufacturer_custom: '',
    relay_family: '',
    firmware_version: '',
    template_version: '',
    cloud_mod_date: '',
    status: 'active' as 'active' | 'deprecated' | 'review',
    has_pdf: false,
  });

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  if (profile?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-sm">Access denied. Admin only.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.model_name.trim();
    if (!name) { toast.error('Model name is required'); return; }

    const manufacturer = form.manufacturer === '__custom__'
      ? form.manufacturer_custom.trim()
      : form.manufacturer.trim();

    if (!manufacturer) { toast.error('Manufacturer is required'); return; }

    setSaving(true);
    const { data, error } = await supabase
      .from('relay_models')
      .insert({
        model_name: name,
        manufacturer,
        relay_family: form.relay_family.trim(),
        firmware_version: form.firmware_version.trim(),
        template_version: form.template_version.trim(),
        status: form.status,
        has_pdf: form.has_pdf,
        cloud_mod_date: form.cloud_mod_date ? new Date(form.cloud_mod_date).toISOString() : null,
      })
      .select('id')
      .single();

    if (error) {
      toast.error(error.message || 'Failed to add model');
      setSaving(false);
      return;
    }

    toast.success(`Model "${name}" added successfully`);
    router.push(`/relay-models/${data.id}`);
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring';
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-1.5';

  return (
    <div>
      <TopNav
        title="Add New Relay Model"
        description="Manually add a relay model to the catalog"
        actions={
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </button>
        }
      />

      <form onSubmit={handleSubmit} className="p-6 max-w-2xl space-y-5">

        {/* Identity */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-500" /> Model Identity
          </h2>

          <div>
            <label className={labelCls}>Model Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.model_name}
              onChange={e => set('model_name', e.target.value)}
              placeholder="e.g. REF615A"
              className={inputCls}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Manufacturer <span className="text-red-500">*</span></label>
              <select
                value={form.manufacturer}
                onChange={e => set('manufacturer', e.target.value)}
                className={inputCls}
              >
                <option value="">Select manufacturer…</option>
                {MANUFACTURERS.map(m => <option key={m} value={m}>{m}</option>)}
                <option value="__custom__">Other (type below)</option>
              </select>
            </div>
            {form.manufacturer === '__custom__' && (
              <div>
                <label className={labelCls}>Manufacturer Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.manufacturer_custom}
                  onChange={e => set('manufacturer_custom', e.target.value)}
                  placeholder="e.g. Toshiba"
                  className={inputCls}
                />
              </div>
            )}
            <div>
              <label className={labelCls}>Relay Family</label>
              <input
                type="text"
                value={form.relay_family}
                onChange={e => set('relay_family', e.target.value)}
                placeholder="e.g. REF600"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Versions */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Version Information</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Cloud Min RTMS (Template Version)</label>
              <input
                type="text"
                value={form.template_version}
                onChange={e => set('template_version', e.target.value)}
                placeholder="e.g. D100.53.36.17"
                className={inputCls}
              />
              <p className="text-xs text-muted-foreground mt-1">Minimum RTMS version required</p>
            </div>
            <div>
              <label className={labelCls}>Firmware Version</label>
              <input
                type="text"
                value={form.firmware_version}
                onChange={e => set('firmware_version', e.target.value)}
                placeholder="e.g. 4.1.4"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Cloud Mod Date</label>
              <input
                type="date"
                value={form.cloud_mod_date}
                onChange={e => set('cloud_mod_date', e.target.value)}
                className={inputCls}
              />
              <p className="text-xs text-muted-foreground mt-1">Date this template was last modified</p>
            </div>
          </div>
        </div>

        {/* Status & flags */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Status</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Status</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value as typeof form.status)}
                className={inputCls}
              >
                <option value="active">Active</option>
                <option value="deprecated">Deprecated</option>
                <option value="review">Under Review</option>
              </select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="has_pdf"
                checked={form.has_pdf}
                onChange={e => set('has_pdf', e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary"
              />
              <label htmlFor="has_pdf" className="text-sm text-foreground cursor-pointer">
                PDF documentation available
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pb-8">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Add Model'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
