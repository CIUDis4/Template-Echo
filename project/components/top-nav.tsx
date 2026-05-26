'use client';

import { useAuth } from '@/lib/auth-context';
import { Bell, Search } from 'lucide-react';
import Link from 'next/link';

interface TopNavProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function TopNav({ title, description, actions }: TopNavProps) {
  const { profile } = useAuth();

  return (
    <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border">
      <div className="flex items-center justify-between px-6 h-14">
        <div>
          <h1 className="text-base font-semibold text-foreground leading-none">{title}</h1>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {actions}

          <Link
            href="/search"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-accent transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-muted-foreground text-xs">Search...</span>
            <kbd className="hidden sm:inline text-xs text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded border border-border">
              ⌘K
            </kbd>
          </Link>

          <button className="relative p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
            <Bell className="w-4 h-4" />
          </button>

          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-semibold">
              {profile?.full_name?.charAt(0) || 'U'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
