'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { TopNav } from '@/components/top-nav';
import { toast } from 'sonner';
import { Users, UserPlus, Edit2, UserX, UserCheck, Loader2, Shield } from 'lucide-react';
import type { Profile } from '@/lib/database.types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function UsersPage() {
  const { profile: currentProfile } = useAuth();
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ full_name: string; role: Profile['role'] }>({ full_name: '', role: 'engineer' });
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'engineer' as Profile['role'] });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (currentProfile && currentProfile.role !== 'admin') router.replace('/dashboard');
    else loadProfiles();
  }, [currentProfile]);

  const loadProfiles = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setProfiles(data || []);
    setLoading(false);
  };

  const startEdit = (p: Profile) => {
    setEditingId(p.id);
    setEditData({ full_name: p.full_name, role: p.role });
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: editData.full_name, role: editData.role })
      .eq('id', id);

    if (error) toast.error(error.message);
    else {
      toast.success('User updated');
      setEditingId(null);
      loadProfiles();
    }
    setSaving(false);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email.toLowerCase().endsWith('@megger.com')) {
      toast.error('Email must be a @megger.com address.');
      return;
    }
    setAdding(true);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-admin-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(newUser),
    });
    const json = await res.json();
    setAdding(false);
    if (json.error) {
      toast.error(json.error);
    } else {
      toast.success('User created successfully');
      setShowAddModal(false);
      setNewUser({ email: '', password: '', full_name: '', role: 'engineer' });
      loadProfiles();
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from('profiles').update({ active: !active }).eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success(active ? 'User disabled' : 'User enabled');
      loadProfiles();
    }
  };

  const roleColors = {
    admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    engineer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    viewer: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  };

  if (currentProfile?.role !== 'admin') return null;

  return (
    <div>
      <TopNav title="User Management" description="Manage user accounts, roles, and permissions" />

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: profiles.length, color: 'blue' },
            { label: 'Admins', value: profiles.filter(p => p.role === 'admin').length, color: 'red' },
            { label: 'Engineers', value: profiles.filter(p => p.role === 'engineer').length, color: 'green' },
            { label: 'Active', value: profiles.filter(p => p.active).length, color: 'slate' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Users table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              All Users
            </h3>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add User
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">User</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Role</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Joined</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {[...Array(5)].map((_, j) => (
                        <td key={j} className="px-5 py-3">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : profiles.map(p => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <span className="text-primary-foreground text-xs font-semibold">
                            {p.full_name?.charAt(0) || p.email.charAt(0)}
                          </span>
                        </div>
                        <div>
                          {editingId === p.id ? (
                            <input
                              value={editData.full_name}
                              onChange={e => setEditData(d => ({ ...d, full_name: e.target.value }))}
                              className="px-2 py-1 text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring w-36"
                            />
                          ) : (
                            <p className="font-medium text-foreground">{p.full_name || '—'}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{p.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {editingId === p.id ? (
                        <select
                          value={editData.role}
                          onChange={e => setEditData(d => ({ ...d, role: e.target.value as Profile['role'] }))}
                          className="px-2 py-1 text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="engineer">Engineer</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[p.role]}`}>
                          {p.role === 'admin' && <Shield className="w-2.5 h-2.5" />}
                          {p.role}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.active
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {p.active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {editingId === p.id ? (
                          <>
                            <button
                              onClick={() => handleSave(p.id)}
                              disabled={saving}
                              className="px-2.5 py-1 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60"
                            >
                              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2.5 py-1 text-xs border border-border rounded-lg hover:bg-accent"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(p)}
                              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {p.id !== currentProfile?.id && (
                              <button
                                onClick={() => toggleActive(p.id, p.active)}
                                className={`p-1.5 rounded-lg hover:bg-accent transition-colors ${
                                  p.active ? 'text-muted-foreground hover:text-destructive' : 'text-muted-foreground hover:text-green-600'
                                }`}
                                title={p.active ? 'Disable user' : 'Enable user'}
                              >
                                {p.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </>
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

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-muted-foreground" />
                Add New User
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={newUser.full_name}
                  onChange={e => setNewUser(u => ({ ...u, full_name: e.target.value }))}
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email Address <span className="text-destructive">*</span></label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))}
                  placeholder="jane@megger.com"
                  required
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password <span className="text-destructive">*</span></label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Role <span className="text-destructive">*</span></label>
                <select
                  value={newUser.role}
                  onChange={e => setNewUser(u => ({ ...u, role: e.target.value as Profile['role'] }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="viewer">Viewer</option>
                  <option value="engineer">Engineer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={adding}
                  className="flex-1 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {adding ? 'Creating...' : 'Create User'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
