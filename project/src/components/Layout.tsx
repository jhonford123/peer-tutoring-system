import { LayoutDashboard, Users, CalendarDays, Package, BookOpen, GraduationCap, Menu, X, Presentation, LogOut, ShieldCheck, Library, Settings } from 'lucide-react';
import { useState, ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';

export type PageKey = 'dashboard' | 'tutors' | 'sessions' | 'subjects' | 'inventory' | 'workshops' | 'admin' | 'books' | 'settings';

interface LayoutProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  children: ReactNode;
}

const baseNavItems: { key: PageKey; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'tutors', label: 'Tutors', icon: Users },
  { key: 'sessions', label: 'Sessions', icon: CalendarDays },
  { key: 'subjects', label: 'Subjects', icon: BookOpen },
  { key: 'workshops', label: 'Workshops', icon: Presentation },
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'books', label: 'Books', icon: Library },
  { key: 'admin', label: 'Admin Panel', icon: ShieldCheck, adminOnly: true },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export default function Layout({ activePage, onNavigate, children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (page: PageKey) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar - desktop */}
      <aside className="fixed left-0 top-0 hidden h-full w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <SidebarContent activePage={activePage} onNavigate={handleNav} />
      </aside>

      {/* Sidebar - mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 flex flex-col border-r border-slate-200 bg-white animate-slide-in-left">
            <SidebarContent activePage={activePage} onNavigate={handleNav} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-sky-600" />
            <span className="font-bold text-slate-900 text-sm">BCP Tutoring</span>
          </div>
          <div className="w-9" />
        </header>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({ activePage, onNavigate }: { activePage: PageKey; onNavigate: (p: PageKey) => void }) {
  const { profile, signOut, isAdmin } = useAuth();
  const { showToast } = useToast();
  const navItems = baseNavItems.filter(item => !item.adminOnly || isAdmin);

  async function handleLogout() {
    await signOut();
    showToast('info', 'You have been signed out.');
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600">
          <GraduationCap className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-900 leading-tight">Bestlink College</h1>
          <p className="text-xs text-slate-500">Peer Tutoring System</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-sky-50 text-sky-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4 space-y-3">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sm font-bold text-sky-700">
            {profile?.full_name?.charAt(0) ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-700 truncate">{profile?.full_name ?? 'User'}</p>
            <p className="text-xs text-slate-400 capitalize">{profile?.role ?? 'user'}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <p className="text-center text-xs text-slate-400">Academic Year 2026-2027</p>
      </div>
    </>
  );
}
