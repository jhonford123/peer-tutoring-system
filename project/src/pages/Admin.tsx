import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast-context';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/constants';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { ShieldCheck, CheckCircle2, XCircle, Clock, Users, Search, Trash2, BookOpen, Eye, Send } from 'lucide-react';
import type { Book, Profile, RoleChangeRequest } from '@/types';

type UserRole = Profile['role'];
type Action = 'approve' | 'reject' | 'delete' | 'changeRole';

interface PendingAction {
  profile: Profile;
  action: Action;
  newRole?: UserRole;
}

export default function AdminPage() {
  const { profile: currentProfile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [roleRequests, setRoleRequests] = useState<RoleChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [pendingBookAction, setPendingBookAction] = useState<{ book: Book; action: 'approve' | 'reject' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [bookReviewNote, setBookReviewNote] = useState('');

  const isFirstAdmin = currentProfile?.is_first_admin === true;

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) {
      showToast('error', 'Failed to load profiles');
      setLoading(false);
      return;
    }
    setProfiles(data as Profile[] ?? []);
    setLoading(false);
  }, [showToast]);

  const fetchBooks = useCallback(async () => {
    const { data, error } = await supabase.from('books').select('*').order('created_at', { ascending: false });
    if (error) {
      showToast('error', 'Failed to load book review requests');
      return;
    }
    setBooks(data as Book[] ?? []);
  }, [showToast]);

  const fetchRoleRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('role_change_requests')
      .select('id, requester_id, requested_role, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) {
      showToast('error', 'Failed to load role change requests');
      return;
    }
    setRoleRequests(data as RoleChangeRequest[]);
  }, [showToast]);

  useEffect(() => {
    fetchProfiles();
    fetchBooks();
    fetchRoleRequests();
  }, [fetchProfiles, fetchBooks, fetchRoleRequests]);

  async function handleRoleRequestReview(request: RoleChangeRequest, approve: boolean) {
    const { error } = await supabase.rpc('review_role_change_request', {
      p_request_id: request.id,
      p_approve: approve,
    });
    if (error) {
      showToast('error', approve ? 'Failed to approve role change request' : 'Failed to reject role change request');
      return;
    }
    showToast('success', approve ? 'Role change request approved' : 'Role change request rejected');
    await Promise.all([fetchProfiles(), fetchRoleRequests()]);
    refreshProfile();
  }

  async function handleAction() {
    if (!pendingAction) return;
    const { profile, action } = pendingAction;

    if (action === 'approve') {
      const { error } = await supabase.from('profiles').update({ account_status: 'approved', rejected_reason: null }).eq('id', profile.id);
      if (error) { showToast('error', 'Failed to approve user'); return; }
      showToast('success', `${profile.full_name} has been approved`);
    } else if (action === 'reject') {
      const { error } = await supabase.from('profiles').update({ account_status: 'rejected', rejected_reason: rejectReason.trim() || null }).eq('id', profile.id);
      if (error) { showToast('error', 'Failed to reject user'); return; }
      showToast('info', `${profile.full_name}'s application has been rejected`);
    } else if (action === 'delete') {
      const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
      if (error) { showToast('error', 'Failed to delete profile'); return; }
      showToast('success', 'Profile deleted');
    } else if (action === 'changeRole' && pendingAction.newRole) {
      const { error } = await supabase.from('profiles').update({ role: pendingAction.newRole }).eq('id', profile.id);
      if (error) { showToast('error', 'Failed to update role'); return; }
      showToast('success', `${profile.full_name}'s role changed to ${pendingAction.newRole}`);
    }

    setPendingAction(null);
    setRejectReason('');
    fetchProfiles();
    refreshProfile();
  }

  async function handleBookReviewAction() {
    if (!pendingBookAction) return;

    const { book, action } = pendingBookAction;
    const nextStatus = action === 'approve' ? 'approved' : 'rejected';
    const reviewMessage = action === 'reject' && bookReviewNote.trim()
      ? `${book.description ?? ''}\nAdmin review: ${bookReviewNote.trim()}`.trim()
      : (book.description ?? null);

    const { error } = await supabase.from('books').update({
      status: nextStatus,
      description: reviewMessage,
    }).eq('id', book.id);

    if (error) {
      showToast('error', action === 'approve' ? 'Failed to approve book request' : 'Failed to reject book request');
      return;
    }

    showToast('success', action === 'approve' ? `${book.title} has been approved for publishing` : `${book.title} has been rejected`);
    setPendingBookAction(null);
    setBookReviewNote('');
    fetchBooks();
  }

  const filtered = profiles.filter(p => {
    const matchesSearch = p.full_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || p.account_status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = profiles.filter(p => p.account_status === 'pending').length;
  const approvedCount = profiles.filter(p => p.account_status === 'approved').length;
  const rejectedCount = profiles.filter(p => p.account_status === 'rejected').length;
  const adminCount = profiles.filter(p => p.role === 'admin' && p.account_status === 'approved').length;

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
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-sky-600" />
          Admin Panel
        </h1>
        <p className="mt-1 text-sm text-slate-500">Review account applications and manage user roles</p>
      </div>

      {isFirstAdmin ? (
        <div className="rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
            As admin1, you can change the role of any other account. Regular admins can only assign user, staff, or tutor roles.
        </div>
      ) : (
        <div className="rounded-lg bg-sky-50 px-4 py-2.5 text-sm text-sky-700">
            You can promote or demote users between user, staff, and tutor. Only admin1 can change admin accounts or promote users to admin.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Clock} label="Pending" value={pendingCount} color="amber" />
        <StatCard icon={CheckCircle2} label="Approved" value={approvedCount} color="emerald" />
        <StatCard icon={XCircle} label="Rejected" value={rejectedCount} color="rose" />
        <StatCard icon={ShieldCheck} label="Admins" value={adminCount} color="sky" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Send className="h-5 w-5 text-sky-600" />
          <h2 className="font-bold text-slate-900">Role Change Requests</h2>
          {roleRequests.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{roleRequests.length}</span>
          )}
        </div>
        {roleRequests.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
            No pending role change requests.
          </p>
        ) : (
          <div className="space-y-3">
            {roleRequests.map(request => {
              const requester = profiles.find(item => item.id === request.requester_id);
              return (
                <div key={request.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{requester?.full_name ?? 'User'}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Current role: <span className="capitalize">{requester?.role ?? 'unknown'}</span>
                      {' · '}Requested role: <span className="font-semibold capitalize text-slate-700">{request.requested_role}</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Submitted {formatDate(request.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRoleRequestReview(request, true)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Approve
                    </button>
                    <button
                      onClick={() => handleRoleRequestReview(request, false)}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      <XCircle className="h-4 w-4" /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-sky-600" />
          <h2 className="font-bold text-slate-900">Book Publish Requests</h2>
        </div>

        {books.filter(book => ['pending_review', 'approved', 'rejected'].includes(book.status)).length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
            No book submissions yet.
          </div>
        ) : (
          <div className="space-y-3">
            {books.filter(book => ['pending_review', 'approved', 'rejected'].includes(book.status)).map(book => (
              <div key={book.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{book.title}</p>
                      <BookStatusBadge status={book.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">by {book.author} · {book.category}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {book.cover_image_url && (() => {
                      try {
                        const url = new URL(book.cover_image_url);
                        const pathName = decodeURIComponent(url.pathname.split('/').pop() ?? '');
                        const fileName = pathName || `${book.title}.pdf`;
                        return (
                          <a
                            href={book.cover_image_url}
                            download={fileName}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" /> Download File
                          </a>
                        );
                      } catch {
                        return (
                          <a
                            href={book.cover_image_url}
                            download={`${book.title}.pdf`}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" /> Download File
                          </a>
                        );
                      }
                    })()}
                    {book.status === 'pending_review' && (
                      <>
                        <button
                          onClick={() => setPendingBookAction({ book, action: 'approve' })}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => { setBookReviewNote(''); setPendingBookAction({ book, action: 'reject' }); }}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 transition-colors"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {book.description && (
                  <p className="mt-3 text-sm text-slate-500">{book.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search users by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* User list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-16">
          <Users className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-400">No users found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Joined</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(p => {
                  const isSelf = p.id === currentProfile?.id;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">
                            {p.full_name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {p.full_name}
                              {isSelf && <span className="ml-1.5 text-xs text-slate-400">(You)</span>}
                            </p>
                            <p className="text-xs text-slate-400">{p.phone ?? 'No phone'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${
                            p.role === 'admin' ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {p.role}
                          </span>
                          {p.account_status === 'approved' && !isSelf && (isFirstAdmin || p.role !== 'admin') && (
                            <select
                              value={p.role}
                              aria-label={`Change role for ${p.full_name}`}
                              onChange={e => setPendingAction({
                                profile: p,
                                action: 'changeRole',
                                newRole: e.target.value as UserRole,
                              })}
                              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 focus:border-sky-400 focus:outline-none"
                            >
                              {(isFirstAdmin
                                ? ['user', 'staff', 'tutor', 'admin']
                                : ['user', 'staff', 'tutor']
                              ).map(role => (
                                <option key={role} value={role}>{role === p.role ? `Role: ${role}` : role}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <AccountStatusBadge status={p.account_status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{formatDate(p.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.account_status === 'pending' && (
                            <>
                              <button
                                onClick={() => setPendingAction({ profile: p, action: 'approve' })}
                                title="Approve"
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => { setRejectReason(''); setPendingAction({ profile: p, action: 'reject' }); }}
                                title="Reject"
                                className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 transition-colors"
                              >
                                <XCircle className="h-3.5 w-3.5" /> Reject
                              </button>
                            </>
                          )}
                          {p.account_status === 'rejected' && (
                            <button
                              onClick={() => setPendingAction({ profile: p, action: 'approve' })}
                              title="Approve"
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                            </button>
                          )}
                          {p.account_status === 'approved' && !isSelf && (
                            <>
                              <button
                                onClick={() => setPendingAction({ profile: p, action: 'delete' })}
                                title="Delete Profile"
                                className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reject modal with reason input */}
      <Modal
        isOpen={!!pendingAction && pendingAction.action === 'reject'}
        onClose={() => { setPendingAction(null); setRejectReason(''); }}
        title="Reject Application"
      >
        {pendingAction && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              You are about to reject <strong>{pendingAction.profile.full_name}</strong>'s application. They will not be able to access the system.
            </p>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Reason (optional)</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="form-input"
                rows={3}
                placeholder="Reason for rejection..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setPendingAction(null); setRejectReason(''); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleAction} className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 transition-colors">
                Reject Application
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!pendingBookAction && pendingBookAction.action === 'reject'}
        onClose={() => { setPendingBookAction(null); setBookReviewNote(''); }}
        title="Reject Book Request"
      >
        {pendingBookAction && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              You are about to reject <strong>{pendingBookAction.book.title}</strong>. The author will see that the publication request was rejected.
            </p>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Reason (optional)</label>
              <textarea
                value={bookReviewNote}
                onChange={e => setBookReviewNote(e.target.value)}
                className="form-input"
                rows={3}
                placeholder="Reason for rejection..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setPendingBookAction(null); setBookReviewNote(''); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleBookReviewAction} className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 transition-colors">
                Reject Request
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!pendingBookAction && pendingBookAction.action === 'approve'}
        onClose={() => setPendingBookAction(null)}
        onConfirm={handleBookReviewAction}
        title="Approve Book Request"
        message={<>Approve <strong>{pendingBookAction?.book.title}</strong> for publishing? It will become visible in the book catalog once approved.</>}
        confirmLabel="Approve"
        variant="success"
      />

      {/* Confirmation dialogs for other actions */}
      <ConfirmDialog
        isOpen={!!pendingAction && (pendingAction.action === 'approve')}
        onClose={() => setPendingAction(null)}
        onConfirm={handleAction}
        title="Approve Application"
        message={<>Approve <strong>{pendingAction?.profile.full_name}</strong>'s account? They will be able to access the system immediately.</>}
        confirmLabel="Approve"
        variant="success"
      />
      <ConfirmDialog
        isOpen={!!pendingAction && pendingAction.action === 'delete'}
        onClose={() => setPendingAction(null)}
        onConfirm={handleAction}
        title="Delete Profile"
        message={<>Delete <strong>{pendingAction?.profile.full_name}</strong>'s profile? The auth account will remain but the profile record will be removed. This action cannot be undone.</>}
        confirmLabel="Delete"
        variant="danger"
      />
      <ConfirmDialog
        isOpen={!!pendingAction && pendingAction.action === 'changeRole'}
        onClose={() => setPendingAction(null)}
        onConfirm={handleAction}
        title="Change User Role"
        message={<>Change <strong>{pendingAction?.profile.full_name}</strong>'s role from <strong>{pendingAction?.profile.role}</strong> to <strong>{pendingAction?.newRole}</strong>?</>}
        confirmLabel="Change Role"
        variant="info"
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Clock; label: string; value: number; color: 'amber' | 'emerald' | 'rose' | 'sky' }) {
  const colors = {
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
    sky: 'bg-sky-50 text-sky-600',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}

function BookStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    pending_review: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Pending Review' },
    approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Approved' },
    rejected: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Rejected' },
    published: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Published' },
    unpublished: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Unpublished' },
  };
  const c = config[status] ?? { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function AccountStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Pending' },
    approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Approved' },
    rejected: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Rejected' },
  };
  const c = config[status] ?? { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
