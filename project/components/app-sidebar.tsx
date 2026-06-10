'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard, Cpu, MessageSquare, Upload, Settings,
  Users, Search, Activity, Zap, ChevronRight, LogOut, Moon, Sun, BarChart3, Bug, FileInput,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/relay-models', label: 'Relay Models', icon: Cpu },
  { href: '/feedback', label: 'Feedback', icon: MessageSquare },
  { href: '/bugs', label: 'Driver Bug Tracker', icon: Bug },
  { href: '/template-requests', label: 'Template Requests', icon: FileInput },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/activity', label: 'Activity Log', icon: Activity },
];

const adminItems = [
  { href: '/import', label: 'Import Models', icon: Upload },
  { href: '/admin', label: 'Admin Panel', icon: Settings },
  { href: '/admin/users', label: 'User Management', icon: Users },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
    router.push('/login');
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-sidebar border-r border-sidebar-border flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-white font-bold text-sm leading-none">Template Echo</div>
          <div className="text-sidebar-muted text-xs mt-0.5">Template Feedback Platform</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        <div className="mb-2">
          <p className="px-2 text-xs font-semibold text-sidebar-muted uppercase tracking-wider mb-1">
            Main
          </p>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 group',
                isActive(item.href)
                  ? 'bg-sidebar-accent text-white'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white'
              )}
            >
              <item.icon className={cn(
                'w-4 h-4 flex-shrink-0 transition-colors',
                isActive(item.href) ? 'text-blue-400' : 'text-sidebar-muted group-hover:text-blue-400'
              )} />
              {item.label}
              {isActive(item.href) && (
                <ChevronRight className="w-3 h-3 ml-auto text-sidebar-muted" />
              )}
            </Link>
          ))}
        </div>

        {profile?.role === 'admin' && (
          <div className="mt-4 pt-4 border-t border-sidebar-border">
            <p className="px-2 text-xs font-semibold text-sidebar-muted uppercase tracking-wider mb-1">
              Admin
            </p>
            {adminItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 group',
                  isActive(item.href)
                    ? 'bg-sidebar-accent text-white'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white'
                )}
              >
                <item.icon className={cn(
                  'w-4 h-4 flex-shrink-0 transition-colors',
                  isActive(item.href) ? 'text-blue-400' : 'text-sidebar-muted group-hover:text-blue-400'
                )} />
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* User / bottom */}
      <div className="border-t border-sidebar-border p-3 space-y-1">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white transition-all w-full"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-sidebar-muted" />
          ) : (
            <Moon className="w-4 h-4 text-sidebar-muted" />
          )}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>

        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-semibold">
              {profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate leading-none">
              {profile?.full_name || 'User'}
            </p>
            <p className="text-xs text-sidebar-muted capitalize mt-0.5">{profile?.role}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sidebar-muted hover:text-white transition-colors p-1"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
