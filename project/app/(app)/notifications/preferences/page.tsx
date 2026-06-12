'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { TopNav } from '@/components/top-nav';
import { toast } from 'sonner';
import { Bell, Zap, Clock, Calendar, Loader2, CheckCircle2 } from 'lucide-react';
import { EVENT_TYPES, FREQUENCIES } from '@/lib/notification-constants';

interface Subscription {
  id: string;
  user_id: string;
  event_type: string;
  frequency: string;
  enabled: boolean;
}

const CATEGORY_ORDER = ['Templates', 'Feedback', 'Driver Bugs', 'Template Requests', 'Reports'];

export default function NotificationPreferencesPage() {
  const { user, profile } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notification_subscriptions')
      .select('*')
      .eq('user_id', user!.id);
    setSubscriptions((data || []) as Subscription[]);
    setLoading(false);
  };

  const subMap = new Map(subscriptions.map(s => [s.event_type, s]));

  const handleToggle = async (eventType: string) => {
    const sub = subMap.get(eventType);
    setSaving(eventType);
    if (sub) {
      const { error } = await supabase.from('notification_subscriptions')
        .update({ enabled: !sub.enabled })
        .eq('id', sub.id);
      if (error) { toast.error('Failed to save'); setSaving(null); return; }
      setSubscriptions(prev => prev.map(s => s.id === sub.id ? { ...s, enabled: !s.enabled } : s));
    } else {
      const { data, error } = await supabase.from('notification_subscriptions')
        .insert({ user_id: user!.id, event_type: eventType, frequency: 'immediate', enabled: true })
        .select().single();
      if (error) { toast.error('Failed to save'); setSaving(null); return; }
      setSubscriptions(prev => [...prev, data as Subscription]);
    }
    setSaving(null);
    flashSaved(eventType);
  };

  const handleFrequency = async (eventType: string, frequency: string) => {
    const sub = subMap.get(eventType);
    if (!sub) return;
    setSaving(eventType);
    const { error } = await supabase.from('notification_subscriptions')
      .update({ frequency })
      .eq('id', sub.id);
    if (error) { toast.error('Failed to save'); setSaving(null); return; }
    setSubscriptions(prev => prev.map(s => s.id === sub.id ? { ...s, frequency } : s));
    setSaving(null);
    flashSaved(eventType);
  };

  const handleEnableAll = async () => {
    setSaving('all');
    const upserts = EVENT_TYPES.map(e => ({ user_id: user!.id, event_type: e.id, frequency: subMap.get(e.id)?.frequency || 'immediate', enabled: true }));
    const { data, error } = await supabase.from('notification_subscriptions').upsert(upserts, { onConflict: 'user_id,event_type' }).select();
    if (error) { toast.error('Failed to save'); setSaving(null); return; }
    setSubscriptions(data as Subscription[]);
    setSaving(null);
    toast.success('All notifications enabled');
  };

  const handleDisableAll = async () => {
    setSaving('all');
    const updates = subscriptions.map(s => supabase.from('notification_subscriptions').update({ enabled: false }).eq('id', s.id));
    await Promise.all(updates);
    setSubscriptions(prev => prev.map(s => ({ ...s, enabled: false })));
    setSaving(null);
    toast.success('All notifications disabled');
  };

  const flashSaved = (key: string) => {
    setSaved(key);
    setTimeout(() => setSaved(null), 1500);
  };

  const enabledCount = subscriptions.filter(s => s.enabled).length;
  const categories = CATEGORY_ORDER.map(cat => ({
    name: cat,
    events: EVENT_TYPES.filter(e => e.category === cat),
  }));

  const freqIcon = (id: string) => {
    if (id === 'immediate') return <Zap className="w-3 h-3" />;
    if (id === 'daily') return <Clock className="w-3 h-3" />;
    return <Calendar className="w-3 h-3" />;
  };

  return (
    <div>
      <TopNav
        title="My Notifications"
        description="Manage your personal email notification preferences"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={handleDisableAll} disabled={saving === 'all'} className="px-3 py-1.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors disabled:opacity-60">
              Disable All
            </button>
            <button onClick={handleEnableAll} disabled={saving === 'all'} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
              {saving === 'all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
              Enable All
            </button>
          </div>
        }
      />

      <div className="p-6 max-w-3xl space-y-5">
        {/* Summary */}
        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex-shrink-0">
            <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {loading ? '…' : `${enabledCount} of ${EVENT_TYPES.length} notification types active`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Emails will be sent to <span className="font-medium text-foreground">{profile?.email}</span>
            </p>
          </div>
          {!loading && (
            <div className="flex-shrink-0">
              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${EVENT_TYPES.length > 0 ? (enabledCount / EVENT_TYPES.length) * 100 : 0}%` }} />
              </div>
              <p className="text-xs text-muted-foreground text-right mt-1">{EVENT_TYPES.length > 0 ? Math.round((enabledCount / EVENT_TYPES.length) * 100) : 0}%</p>
            </div>
          )}
        </div>

        {/* Frequency guide */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {FREQUENCIES.map(f => (
            <div key={f.id} className="flex items-start gap-3 p-3 bg-card border border-border rounded-xl">
              <div className="p-2 bg-muted rounded-lg flex-shrink-0"><f.icon className="w-4 h-4 text-muted-foreground" /></div>
              <div>
                <p className="text-sm font-semibold text-foreground">{f.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Event categories */}
        {loading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />)}</div>
        ) : (
          categories.map(cat => (
            <div key={cat.name} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/20">
                <h3 className="text-sm font-semibold text-foreground">{cat.name}</h3>
              </div>
              <div className="divide-y divide-border/50">
                {cat.events.map(evt => {
                  const sub = subMap.get(evt.id);
                  const isEnabled = sub?.enabled ?? false;
                  const isSaving = saving === evt.id;
                  const wasSaved = saved === evt.id;

                  return (
                    <div key={evt.id} className={`flex items-center gap-4 px-5 py-4 transition-colors ${isEnabled ? 'bg-primary/3' : ''}`}>
                      {/* Toggle */}
                      <button onClick={() => handleToggle(evt.id)} disabled={isSaving}
                        className={`w-11 h-6 rounded-full flex-shrink-0 relative transition-all ${isEnabled ? 'bg-primary' : 'bg-muted'} disabled:opacity-60`}>
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${isEnabled ? 'left-5' : 'left-0.5'}`} />
                      </button>

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>{evt.label}</p>
                        <p className="text-xs text-muted-foreground">{evt.description}</p>
                      </div>

                      {/* Frequency selector */}
                      {isEnabled && sub && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {FREQUENCIES.map(f => (
                            <button key={f.id} onClick={() => handleFrequency(evt.id, f.id)} disabled={isSaving}
                              title={f.description}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-all ${sub.frequency === f.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}>
                              {freqIcon(f.id)}
                              <span className="hidden sm:inline">{f.label}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Save feedback */}
                      <div className="w-5 flex-shrink-0">
                        {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                        {wasSaved && !isSaving && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        <p className="text-xs text-muted-foreground text-center pb-6">
          Changes take effect immediately. Notification emails are sent to your registered address.
        </p>
      </div>
    </div>
  );
}
