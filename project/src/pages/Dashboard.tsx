import { useEffect, useState } from 'react';
import { Users, CalendarDays, Package, TrendingUp, Clock, AlertTriangle, BookOpen } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/constants';
import StatusBadge from '@/components/ui/StatusBadge';
import type { Session, InventoryItem, Tutor } from '@/types';

interface DashboardStats {
  totalTutors: number;
  activeTutors: number;
  totalSessions: number;
  scheduledSessions: number;
  totalItems: number;
  lowStockItems: number;
  totalSubjects: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalTutors: 0, activeTutors: 0, totalSessions: 0, scheduledSessions: 0,
    totalItems: 0, lowStockItems: 0, totalSubjects: 0,
  });
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    const [tutorsRes, sessionsRes, inventoryRes, subjectsRes, upcomingRes, lowStockRes] = await Promise.all([
      supabase.from('tutors').select('*'),
      supabase.from('sessions').select('*'),
      supabase.from('inventory_items').select('*'),
      supabase.from('subjects').select('*', { count: 'exact', head: true }),
      supabase.from('sessions').select('*, tutor:tutors(*), subject:subjects(*)').gte('session_date', today).order('session_date', { ascending: true }).order('start_time', { ascending: true }).limit(5),
      supabase.from('inventory_items').select('*').lt('quantity', 10).order('quantity', { ascending: true }),
    ]);

    const tutors = tutorsRes.data as Tutor[] ?? [];
    const sessions = sessionsRes.data as Session[] ?? [];
    const inventory = inventoryRes.data as InventoryItem[] ?? [];
    setStats({
      totalTutors: tutors.length,
      activeTutors: tutors.filter(t => t.status === 'active').length,
      totalSessions: sessions.length,
      scheduledSessions: sessions.filter(s => s.status === 'scheduled').length,
      totalItems: inventory.reduce((sum, i) => sum + i.quantity, 0),
      lowStockItems: inventory.filter(i => i.quantity < 10).length,
      totalSubjects: subjectsRes.count ?? 0,
    });

    setUpcomingSessions(upcomingRes.data as Session[] ?? []);
    setLowStock(lowStockRes.data as InventoryItem[] ?? []);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Overview of the Peer Tutoring and Academic Support System</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Users} label="Active Tutors" value={stats.activeTutors} subtext={`${stats.totalTutors} total`} color="sky" />
        <StatCard icon={CalendarDays} label="Scheduled Sessions" value={stats.scheduledSessions} subtext={`${stats.totalSessions} total`} color="emerald" />
        <StatCard icon={Package} label="Inventory Items" value={stats.totalItems} subtext={`${stats.lowStockItems} low stock`} color="amber" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming sessions */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-sky-600" />
              <h2 className="font-bold text-slate-900">Upcoming Sessions</h2>
            </div>
            <span className="text-xs font-medium text-slate-400">{stats.totalSubjects} subjects</span>
          </div>
          {upcomingSessions.length === 0 ? (
            <EmptyState text="No upcoming sessions scheduled" />
          ) : (
            <div className="space-y-3">
              {upcomingSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sm font-bold text-sky-700">
                      {session.tutor?.name?.charAt(0) ?? '?'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{session.student_name}</p>
                      <p className="text-xs text-slate-500">{session.subject?.name} • {session.tutor?.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-700">{formatDate(session.session_date)}</p>
                    <StatusBadge status={session.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low stock alert */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="font-bold text-slate-900">Low Stock Alerts</h2>
          </div>
          {lowStock.length === 0 ? (
            <EmptyState text="All items are well stocked" />
          ) : (
            <div className="space-y-3">
              {lowStock.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.category} • {item.location}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${item.quantity < 5 ? 'text-rose-600' : 'text-amber-600'}`}>
                      {item.quantity} {item.unit}
                    </p>
                    <StatusBadge status={item.condition_status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <h2 className="font-bold text-slate-900">Quick Overview</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MiniStat icon={BookOpen} label="Total Subjects" value={stats.totalSubjects} color="text-sky-600 bg-sky-50" />
            <MiniStat icon={Users} label="Total Tutors" value={stats.totalTutors} color="text-emerald-600 bg-emerald-50" />
            <MiniStat icon={CalendarDays} label="Total Sessions" value={stats.totalSessions} color="text-amber-600 bg-amber-50" />
            <MiniStat icon={Package} label="Item Types" value={lowStock.length > 0 ? `${stats.lowStockItems} low` : 'All good'} color="text-rose-600 bg-rose-50" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, subtext, color }: { icon: typeof Users; label: string; value: string | number; subtext: string; color: 'sky' | 'emerald' | 'amber' | 'rose' }) {
  const colors = {
    sky: 'bg-sky-50 text-sky-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-0.5 text-xs text-slate-400">{subtext}</p>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-8 text-sm text-slate-400">{text}</div>
  );
}
