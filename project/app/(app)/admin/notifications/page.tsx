'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { TopNav } from '@/components/top-nav';
import { toast } from 'sonner';
import {
  Bell, Users, Plus, Trash2, Loader2, History, Search,
  ChevronDown, ChevronUp, CheckCircle2, Mail, Zap, Clock, Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { EVENT_TYPES, FREQUENCIES } from '@/lib/notification-constants';

const CATEGORY_ORDER = ['Templates', 'Feedback', 'Driver Bugs', 'Template Requests', 'Reports'];

interface Profile { id: string; full_name: string; email: string; role: string; }
interface Subscription { id: string; user_id: string; event_type: string; frequency: string; enabled: boolean; }

interface UserWithSubs extends Profile {
  subscriptions: Map<string, Subscription>;
}

export default function AdminNotificationsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [addingUser, setAddingUser] = useState(false);
  const [allProfilesForAdd, setAllProfilesForAdd] = useState<Profile[]>([]);
  const [addSearch, setAddSearch] = useState('');
  const [logCount, setLogCount] = useState(0);

  useEffect(() => {
    if (profile && profile.role !== 'admin') { router.replace('/dashboard'); return; }
    load();
  }, [profile]);

  const load = async () => {
    setLoading(true);
    const [profilesRes, subsRes, logsRes, allProfilesRes] = await Promise.all([
      // Profiles that have at least one subscription
      supabase.from('profiles').select('id, full_name, email, role').eq('active', true),
      supabase.from('notification_subscriptions').select('*'),
      supabase.from('notification_logs').select('id', { count: 'exact' }),
      supabase.from('profiles').select('id, full_name, email, role').eq('active', true).order('full_name'),
    ]);
    setProfiles((profilesRes.data || []) as Profile[]);
    setSubscriptions((subsRes.data || []) as Subscription[]);
    setLogCount(logsRes.count || 0);
    setAllProfilesForAdd((allProfilesRes.data || []) as Profile[]);
    setLoading(false);
  };

  // Build per-user subscription map
  const subMap = new Map<string, Map<string, Subscription>>();
  subscriptions.forEach(s => {
    if (!subMap.has(s.user_id)) subMap.set(s.user_id, new Map());
    subMap.get(s.user_id)!.set(s.event_type, s);
  });

  // Users that have any subscription
  const subscribedUserIds = new Set(subscriptions.map(s => s.user_id));
  const subscribedProfiles = profiles.filter(p => subscribedUserIds.has(p.id));

  const filtered = search
    ? subscribedProfiles.filter(p => (p.full_name + p.email).toLowerCase().includes(search.toLowerCase()))
    : subscribedProfiles;

  const handleToggle = async (userId: string, eventType: string, currentSub: Subscription | undefined) => {
    const key = `${userId}-${eventType}`;
    setSaving(key);
    if (currentSub) {
      // Toggle enabled
      const { error } = await supabase.from('notification_subscriptions')
        .update({ enabled: !currentSub.enabled })
        .eq('id', currentSub.id);
      if (error) toast.error('Failed to update');
      else setSubscriptions(prev => prev.map(s => s.id === currentSub.id ? { ...s, enabled: !s.enabled } : s));
    } else {
      // Create new subscription
      const { data, error } = await supabase.from('notification_subscriptions')
        .insert({ user_id: userId, event_type: eventType, frequency: 'immediate', enabled: true })
        .select().single();
      if (error) toast.error('Failed to create subscription');
      else setSubscriptions(prev => [...prev, data as Subscription]);
    }
    setSaving(null);
  };

  const handleFrequency = async (sub: Subscription, frequency: string) => {
    setSaving(sub.id);
    const { error } = await supabase.from('notification_subscriptions')
      .update({ frequency })
      .eq('id', sub.id);
    if (error) toast.error('Failed to update frequency');
    else setSubscriptions(prev => prev.map(s => s.id === sub.id ? { ...s, frequency } : s));
    setSaving(null);
  };

  const handleRemoveUser = async (userId: string) => {
    const { error } = await supabase.from('notification_subscriptions').delete().eq('user_id', userId);
    if (error) { toast.error('Failed to remove user'); return; }
    setSubscriptions(prev => prev.filter(s => s.user_id !== userId));
    toast.success('User removed from all notifications');
  };

  const handleAddUser = async (userId: string) => {
    // Add user with all events enabled at immediate frequency
    const inserts = EVENT_TYPES.map(e => ({ user_id: userId, event_type: e.id, frequency: 'immediate', enabled: true }));
    const { data, error } = await supabase.from('notification_subscriptions').upsert(inserts, { onConflict: 'user_id,event_type' }).select();
    if (error) { toast.error('Failed to add user'); return; }
    setSubscriptions(prev => {
      const filtered = prev.filter(s => s.user_id !== userId);
      return [...filtered, ...(data as Subscription[])];
    });
    setAddingUser(false);
    setExpandedUser(userId);
    toast.success('User added to notification list');
  };

  const categories = CATEGORY_ORDER.map(cat => ({
    name: cat,
    events: EVENT_TYPES.filter(e => e.category === cat),
  }));

  const freqIcon = (freq: string) => {
    if (freq === 'immediate') return <Zap className="w-3 h-3" />;
    if (freq === 'daily') return <Clock className="w-3 h-3" />;
    return <Calendar className="w-3 h-3" />;
  };

  return (
    <div>
      <TopNav
        title="Notification Center"
        description="Configure email notification subscriptions for users"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/notifications/history"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors">
              <History className="w-3.5 h-3.5" /> History ({logCount})
            </Link>
            <button onClick={() => setAddingUser(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add User
            </button>
          </div>
        }
      />

      <div className="p-6 space-y-5">

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Subscribed Users', value: subscribedUserIds.size, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
            { label: 'Active Subscriptions', value: subscriptions.filter(s => s.enabled).length, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
            { label: 'Event Types', value: EVENT_TYPES.length, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
            { label: 'Notifications Sent', value: logCount, color: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg flex-shrink-0 ${s.color}`}><Bell className="w-4 h-4" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{loading ? '—' : s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Add user modal */}
        {addingUser && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAddingUser(false)}>
            <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h3 className="font-semibold text-foreground">Add User to Notifications</h3>
                <button onClick={() => setAddingUser(false)} className="text-muted-foreground hover:text-foreground p-1"><span className="text-lg leading-none">×</span></button>
              </div>
              <div className="p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" placeholder="Search users…" value={addSearch} onChange={e => setAddSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {allProfilesForAdd
                    .filter(p => !subscribedUserIds.has(p.id))
                    .filter(p => !addSearch || (p.full_name + p.email).toLowerCase().includes(addSearch.toLowerCase()))
                    .map(p => (
                      <button key={p.id} onClick={() => handleAddUser(p.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-left">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <span className="text-primary-foreground text-xs font-semibold">{(p.full_name || p.email).charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.full_name || 'No name'}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                        </div>
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded capitalize">{p.role}</span>
                      </button>
                    ))}
                  {allProfilesForAdd.filter(p => !subscribedUserIds.has(p.id)).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">All active users are already subscribed.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search subscribed users…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        {/* User subscription cards */}
        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">No notification subscribers yet</p>
            <p className="text-xs text-muted-foreground mt-1">Click "Add User" to configure notifications for a user.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(user => {
              const userSubs = subMap.get(user.id) || new Map();
              const enabledCount = Array.from(userSubs.values()).filter(s => s.enabled).length;
              const isExpanded = expandedUser === user.id;

              return (
                <div key={user.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  {/* User header */}
                  <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => setExpandedUser(isExpanded ? null : user.id)}>
                    <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-foreground text-sm font-semibold">{(user.full_name || user.email).charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{user.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">{enabledCount} / {EVENT_TYPES.length} active</span>
                      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${EVENT_TYPES.length > 0 ? (enabledCount / EVENT_TYPES.length) * 100 : 0}%` }} />
                      </div>
                      <button onClick={e => { e.stopPropagation(); handleRemoveUser(user.id); }}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Remove user from all notifications">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expanded: event grid */}
                  {isExpanded && (
                    <div className="border-t border-border px-5 py-4 space-y-5">
                      {categories.map(cat => (
                        <div key={cat.name}>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{cat.name}</h4>
                          <div className="space-y-2">
                            {cat.events.map(evt => {
                              const sub = userSubs.get(evt.id);
                              const isEnabled = sub?.enabled ?? false;
                              const isSaving = saving === `${user.id}-${evt.id}` || saving === sub?.id;

                              return (
                                <div key={evt.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${isEnabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20'}`}>
                                  <button onClick={() => handleToggle(user.id, evt.id, sub)} disabled={!!isSaving}
                                    className={`w-10 h-5 rounded-full transition-all flex-shrink-0 relative ${isEnabled ? 'bg-primary' : 'bg-muted'} disabled:opacity-60`}>
                                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${isEnabled ? 'left-5' : 'left-0.5'}`} />
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground">{evt.label}</p>
                                    <p className="text-xs text-muted-foreground">{evt.description}</p>
                                  </div>
                                  {isEnabled && sub && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      {FREQUENCIES.map(f => (
                                        <button key={f.id} onClick={() => handleFrequency(sub, f.id)} disabled={!!isSaving}
                                          title={f.description}
                                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors border ${sub.frequency === f.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}>
                                          {freqIcon(f.id)} {f.label}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground flex-shrink-0" />}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Frequency legend */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Notification Frequency Guide</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {FREQUENCIES.map(f => (
              <div key={f.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0"><f.icon className="w-4 h-4 text-primary" /></div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{f.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
