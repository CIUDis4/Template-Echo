'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { TopNav } from '@/components/top-nav';
import { StatusBadge } from '@/components/severity-badge';
import { toast } from 'sonner';
import { Settings, Cpu, Trash2, Edit2, Plus, Loader2, X } from 'lucide-react';
import type { RelayModel } from '@/lib/database.types';

export default function AdminPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [models, setModels] = useState<RelayModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingModel, setEditingModel] = useState<RelayModel | null>(null);
  const [showAddModel, setShowAddModel] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    model_name: '', manufacturer: '', relay_family: '',
    firmware_version: '', template_version: '', status: 'active' as RelayModel['status'],
    has_pdf: false,
  });

  useEffect(() => {
    if (profile && profile.role !== 'admin') router.replace('/dashboard');
    else loadModels();
  }, [profile]);

  const loadModels = async () => {
    setLoading(true);
    const { data } = await supabase.from('relay_models').select('*').order('model_name');
    setModels(data || []);
    setLoading(false);
  };

  const startEdit = (m: RelayModel) => {
    setEditingModel(m);
    setFormData({
      model_name: m.model_name, manufacturer: m.manufacturer,
      relay_family: m.relay_family, firmware_version: m.firmware_version,
      template_version: m.template_version, status: m.status, has_pdf: m.has_pdf,
    });
    setShowAddModel(false);
  };

  const startAdd = () => {
    setEditingModel(null);
    setFormData({ model_name: '', manufacturer: '', relay_family: '', firmware_version: '', template_version: '', status: 'active', has_pdf: false });
    setShowAddModel(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.model_name.trim()) { toast.error('Model name required'); return; }
    setSaving(true);

    if (editingModel) {
      const { error } = await supabase.from('relay_models').update(formData).eq('id', editingModel.id);
      if (error) toast.error(error.message);
      else { toast.success('Model updated'); setEditingModel(null); loadModels(); }
    } else {
      const { error } = await supabase.from('relay_models').insert(formData);
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

  if (profile?.role !== 'admin') return null;

  const ModelForm = () => (
    <div className="bg-card border border-border rounded-xl p-5 mb-4">
      <h4 className="font-medium text-foreground mb-4">{editingModel ? 'Edit Model' : 'Add New Model'}</h4>
      <form onSubmit={handleSave} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Model Name *</label>
            <input
              value={formData.model_name}
              onChange={e => setFormData(p => ({ ...p, model_name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Manufacturer</label>
            <input
              value={formData.manufacturer}
              onChange={e => setFormData(p => ({ ...p, manufacturer: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Template Version</label>
            <input
              value={formData.template_version}
              onChange={e => setFormData(p => ({ ...p, template_version: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Firmware Version</label>
            <input
              value={formData.firmware_version}
              onChange={e => setFormData(p => ({ ...p, firmware_version: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
            <select
              value={formData.status}
              onChange={e => setFormData(p => ({ ...p, status: e.target.value as RelayModel['status'] }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="active">Active</option>
              <option value="deprecated">Deprecated</option>
              <option value="review">Under Review</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id="has_pdf"
              checked={formData.has_pdf}
              onChange={e => setFormData(p => ({ ...p, has_pdf: e.target.checked }))}
              className="rounded border-border"
            />
            <label htmlFor="has_pdf" className="text-sm text-foreground">PDF Available</label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => { setEditingModel(null); setShowAddModel(false); }}
            className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {editingModel ? 'Save Changes' : 'Add Model'}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div>
      <TopNav title="Admin Panel" description="Manage relay models and system settings" />

      <div className="p-6 space-y-5">
        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{models.length}</p>
              <p className="text-xs text-muted-foreground">Total Models</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Settings className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {models.filter(m => m.status === 'active').length}
              </p>
              <p className="text-xs text-muted-foreground">Active Models</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Settings className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {models.filter(m => m.status === 'deprecated').length}
              </p>
              <p className="text-xs text-muted-foreground">Deprecated</p>
            </div>
          </div>
        </div>

        {/* Model management */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">Relay Model Management</h3>
            <button
              onClick={startAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
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
                        {[...Array(6)].map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-muted rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : models.map(model => (
                    <tr key={model.id} className="border-b border-border/50 hover:bg-muted/20 group">
                      <td className="px-4 py-3 font-medium text-foreground">{model.model_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{model.manufacturer}</td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{model.template_version || '—'}</code>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={model.status} type="model-status" />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${model.has_pdf ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {model.has_pdf ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEdit(model)}
                            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {confirmDeleteId === model.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(model.id)}
                                disabled={deletingId === model.id}
                                className="px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90"
                              >
                                {deletingId === model.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Delete'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 text-xs border border-border rounded-lg hover:bg-accent"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(model.id)}
                              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
      </div>
    </div>
  );
}
