'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { TopNav } from '@/components/top-nav';
import { StatusBadge } from '@/components/severity-badge';
import { Search, Cpu, MessageSquare, User } from 'lucide-react';

interface SearchResult {
  type: 'relay_model' | 'feedback' | 'user';
  id: string;
  title: string;
  subtitle: string;
  href: string;
  badge?: { value: string; type?: 'severity' | 'status' | 'model-status' };
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    const [modelsRes, feedbackRes, usersRes] = await Promise.all([
      supabase
        .from('relay_models')
        .select('id, model_name, manufacturer, status')
        .ilike('model_name', `%${q}%`)
        .limit(10),
      supabase
        .from('feedback_entries')
        .select('id, title, severity, status, relay_model_id, relay_models(model_name)')
        .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
        .limit(10),
      supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(5),
    ]);

    const combined: SearchResult[] = [
      ...(modelsRes.data || []).map(m => ({
        type: 'relay_model' as const,
        id: m.id,
        title: m.model_name,
        subtitle: m.manufacturer,
        href: `/relay-models/${m.id}`,
        badge: { value: m.status, type: 'model-status' as const },
      })),
      ...(feedbackRes.data || []).map((f: any) => ({
        type: 'feedback' as const,
        id: f.id,
        title: f.title,
        subtitle: f.relay_models?.model_name || 'Unknown model',
        href: `/relay-models/${f.relay_model_id}`,
        badge: { value: f.severity, type: 'severity' as const },
      })),
      ...(usersRes.data || []).map(u => ({
        type: 'user' as const,
        id: u.id,
        title: u.full_name || u.email,
        subtitle: `${u.email} • ${u.role}`,
        href: `/admin/users`,
      })),
    ];

    setResults(combined);
    setLoading(false);
    setSearched(true);
  };

  const typeIcon = {
    relay_model: <Cpu className="w-4 h-4 text-blue-500" />,
    feedback: <MessageSquare className="w-4 h-4 text-orange-500" />,
    user: <User className="w-4 h-4 text-slate-500" />,
  };

  const typeLabel = {
    relay_model: 'Relay Model',
    feedback: 'Feedback',
    user: 'User',
  };

  return (
    <div>
      <TopNav title="Global Search" description="Search across relay models, feedback, and users" />

      <div className="p-6 max-w-2xl mx-auto">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search relay models, feedback, users..."
            autoFocus
            className="w-full pl-12 pr-4 py-3 text-base border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {searched && !loading && results.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No results found</p>
            <p className="text-sm mt-1">Try a different search term</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-1">
            {results.map(result => (
              <Link
                key={`${result.type}-${result.id}`}
                href={result.href}
                className="flex items-center gap-3 p-3.5 rounded-xl hover:bg-accent transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  {typeIcon[result.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground text-sm group-hover:text-primary transition-colors truncate">
                      {result.title}
                    </p>
                    {result.badge && (
                      <StatusBadge value={result.badge.value} type={result.badge.type} />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {typeLabel[result.type]}
                </span>
              </Link>
            ))}
          </div>
        )}

        {!searched && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium text-foreground">Start typing to search</p>
            <p className="text-sm mt-1">Search across relay models, feedback entries, and users</p>
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {['SEL-751A', 'ABB RED670', 'critical', 'firmware'].map(term => (
                <button
                  key={term}
                  onClick={() => handleSearch(term)}
                  className="px-3 py-1.5 text-xs bg-muted rounded-full hover:bg-accent transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
