import { Link, useLocation } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/useTheme';
import { cn } from '@/lib/format';
import {
  LayoutDashboard, Briefcase, Target, Sparkles, Search, Users, Globe,
  Megaphone, UserPlus, Users2, CheckSquare, BarChart3, Bot, Bell,
  Shield, Settings, CreditCard, Moon, Sun, LogOut, Menu, X, ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

interface NavItem {
  section: string;
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { section: 'main', label: 'Overview', path: '/', icon: LayoutDashboard },
  { section: 'main', label: 'My Businesses', path: '/businesses', icon: Briefcase },
  { section: 'main', label: 'Business Goals', path: '/goals', icon: Target },
  { section: 'main', label: 'AI Business Planner', path: '/planner', icon: Sparkles },
  { section: 'research', label: 'Market Research', path: '/market-research', icon: Search },
  { section: 'research', label: 'Competitor Analysis', path: '/competitors', icon: Users },
  { section: 'research', label: 'Website Builder', path: '/website-builder', icon: Globe },
  { section: 'growth', label: 'Marketing', path: '/marketing', icon: Megaphone },
  { section: 'growth', label: 'Leads', path: '/leads', icon: UserPlus },
  { section: 'growth', label: 'Customers', path: '/customers', icon: Users2 },
  { section: 'growth', label: 'Tasks', path: '/tasks', icon: CheckSquare },
  { section: 'analytics', label: 'Revenue & Analytics', path: '/analytics', icon: BarChart3 },
  { section: 'system', label: 'AI Agents', path: '/agents', icon: Bot },
  { section: 'system', label: 'Notifications', path: '/notifications', icon: Bell },
  { section: 'system', label: 'Security Center', path: '/security', icon: Shield },
  { section: 'system', label: 'Settings', path: '/settings', icon: Settings },
  { section: 'system', label: 'Billing', path: '/billing', icon: CreditCard },
  { section: 'system', label: 'Admin Panel', path: '/admin', icon: ShieldCheck, roles: ['admin'] },
];

const SECTION_LABELS: Record<string, string> = {
  main: 'Main',
  research: 'Research',
  growth: 'Growth',
  analytics: 'Analytics',
  system: 'System',
};

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter((i) => !i.roles || (profile && i.roles.includes(profile.role)));
  const sectionsWithItems = Array.from(new Set(visibleItems.map((i) => i.section)));
  const currentLabel = NAV_ITEMS.find((i) => i.path === location.pathname)?.label ?? 'Overview';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center gap-2 px-5 h-16 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="font-bold text-slate-900 dark:text-white">AI Business Builder</span>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {sectionsWithItems.map((section) => (
            <div key={section}>
              <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {SECTION_LABELS[section]}
              </p>
              <div className="space-y-0.5">
                {visibleItems.filter((i) => i.section === section).map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group',
                      location.pathname === item.path
                        ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                    )}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 text-white flex items-center justify-center text-sm font-semibold">
              {profile?.full_name?.[0]?.toUpperCase() ?? profile?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-xs text-slate-400 truncate">{profile?.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center px-4 lg:px-6 gap-4 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-500"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="hidden sm:inline">Dashboard</span>
            <ChevronRight className="w-4 h-4 hidden sm:inline" />
            <span className="font-medium text-slate-900 dark:text-white">{currentLabel}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggle}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 lg:p-6 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
