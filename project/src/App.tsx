import { useState } from 'react';
import { GraduationCap, Clock, XCircle, LogOut } from 'lucide-react';
import Layout, { PageKey } from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import TutorsPage from '@/pages/Tutors';
import SessionsPage from '@/pages/Sessions';
import SubjectsPage from '@/pages/Subjects';
import InventoryPage from '@/pages/Inventory';
import WorkshopsPage from '@/pages/Workshops';
import AdminPage from '@/pages/Admin';
import BooksPage from '@/pages/Books';
import SettingsPage from '@/pages/Settings';
import AuthPage from '@/pages/AuthPage';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ToastProvider, useToast } from '@/lib/toast-context';
import ToastContainer from '@/components/ui/Toast';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
        <ToastContainerWrapper />
      </AuthProvider>
    </ToastProvider>
  );
}

function AppContent() {
  const { session, profile, loading, isApproved, signOut } = useAuth();
  const [activePage, setActivePage] = useState<PageKey>('dashboard');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" />
      </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  if (!isApproved) {
    return <PendingApprovalPage status={profile?.account_status ?? 'pending'} reason={profile?.rejected_reason ?? null} onSignOut={signOut} />;
  }

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      {activePage === 'dashboard' && <Dashboard />}
      {activePage === 'tutors' && <TutorsPage />}
      {activePage === 'sessions' && <SessionsPage />}
      {activePage === 'subjects' && <SubjectsPage />}
      {activePage === 'workshops' && <WorkshopsPage />}
      {activePage === 'inventory' && <InventoryPage />}
      {activePage === 'admin' && <AdminPage />}
      {activePage === 'books' && <BooksPage />}
      {activePage === 'settings' && <SettingsPage />}
    </Layout>
  );
}

function PendingApprovalPage({ status, reason, onSignOut }: { status: string; reason: string | null; onSignOut: () => Promise<void> }) {
  const isRejected = status === 'rejected';
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 shadow-lg shadow-sky-200">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {isRejected ? (
            <>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50">
                <XCircle className="h-6 w-6 text-rose-500" />
              </div>
              <h1 className="mt-4 text-xl font-bold text-slate-900">Application Rejected</h1>
              <p className="mt-2 text-sm text-slate-500">
                Your account application has been rejected by an administrator.
                {reason && <span className="mt-2 block rounded-lg bg-rose-50 px-3 py-2 text-rose-700">Reason: {reason}</span>}
              </p>
            </>
          ) : (
            <>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
                <Clock className="h-6 w-6 text-amber-500" />
              </div>
              <h1 className="mt-4 text-xl font-bold text-slate-900">Awaiting Approval</h1>
              <p className="mt-2 text-sm text-slate-500">
                Your account has been created and is pending admin approval. You will be able to access the system once an administrator approves your application.
              </p>
            </>
          )}
          <button
            onClick={onSignOut}
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

function ToastContainerWrapper() {
  const { toasts, removeToast } = useToast();
  return <ToastContainer toasts={toasts} onRemove={removeToast} />;
}
