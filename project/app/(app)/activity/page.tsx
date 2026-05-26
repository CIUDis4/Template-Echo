'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { TopNav } from '@/components/top-nav';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity, MessageSquare, Upload, Edit2, Trash2,
  LogIn, ChevronLeft, ChevronRight,
} from 'lucide-react';

interface ActivityRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  user_name: string;
  user_email: string;
}

const PAGE_SIZE = 30;

const actionConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  feedback_submitted: { label: 'Submitted feedback', icon: MessageSquare, color: 'text-blue-500' },
  feedback_updated: { label: 'Updated feedback', icon: Edit2, color: 'text-amber-500' },
  feedback_deleted: { label: 'Deleted feedback', icon: Trash2, color: 'text-red-500' },
  file_uploaded: { label: 'Uploaded file', icon: Upload, color: 'text-green-500' },
  login: { label: 'Logged in', icon: LogIn, color: 'text-slate-500' },
};

export default function ActivityPage() {
  const { profile } = useAuth();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadActivity();
  }, [page, profile]);

  const loadActivity = async () => {
    if (!profile) return;
    setLoading(true);

    let query = supabase
      .from('activity_logs')
      .select('*, profiles(full_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (profile.role !== 'admin') {
      query = query.eq('user_id', profile.id);
    }

    const { data, count } = await query;

    setTotal(count || 0);
    setActivities(
      (data || []).map((a: any) => ({
        id: a.id,
        action: a.action,
        entity_type: a.entity_type,
        entity_id: a.entity_id,
        details: a.details || {},
        created_at: a.created_at,
        user_name: a.profiles?.full_name || 'Unknown',
        user_email: a.profiles?.email || '',
      }))
    );
    setLoading(false);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const getActionConfig = (action: string) => {
    return actionConfig[action] || { label: action.replace(/_/g, ' '), icon: Activity, color: 'text-muted-foreground' };
  };

  return (
    <div>
      <TopNav
        title="Activity Log"
        description={profile?.role === 'admin' ? 'All user activity across the platform' : 'Your activity history'}
      />

      <div className="p-6 space-y-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
                    <div className="h-3 bg-muted rounded animate-pulse w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium text-foreground">No activity yet</p>
              <p className="text-sm text-muted-foreground mt-1">Actions will appear here as you use the system</p>
            </div>
          ) : (
            <div>
              <div className="divide-y divide-border">
                {activities.map(activity => {
                  const cfg = getActionConfig(activity.action);
                  const Icon = cfg.icon;
                  return (
                    <div key={activity.id} className="flex items-start gap-3 px-5 py-4 hover:bg-muted/20 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {profile?.role === 'admin' && (
                            <span className="font-medium text-foreground text-sm">{activity.user_name}</span>
                          )}
                          <span className="text-sm text-muted-foreground">{cfg.label}</span>
                          {activity.details && typeof activity.details === 'object' && 'title' in activity.details && (
                            <span className="text-sm font-medium text-foreground">
                              "{String(activity.details.title)}"
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <span>{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</span>
                          {activity.entity_type && (
                            <>
                              <span>•</span>
                              <span className="capitalize">{activity.entity_type.replace(/_/g, ' ')}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block">
                        {new Date(activity.created_at).toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {total > PAGE_SIZE && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-40 transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 text-sm text-muted-foreground">{page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-40 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
