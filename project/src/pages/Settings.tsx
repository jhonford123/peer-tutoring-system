import { useEffect, useState } from 'react';
import { Mail, Phone, Send, Settings, ShieldCheck, Star, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { formatDate } from '@/lib/constants';
import type { RoleChangeRequest } from '@/types';

export default function SettingsPage() {
  const { profile, session, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [roleRequests, setRoleRequests] = useState<RoleChangeRequest[]>([]);
  const [requestedRole, setRequestedRole] = useState<'staff' | 'tutor'>('staff');
  const [sendingRoleRequest, setSendingRoleRequest] = useState(false);

  useEffect(() => {
    if (profile) {
      setProfileForm({ full_name: profile.full_name, phone: profile.phone ?? '' });
      setRequestedRole(profile.role === 'staff' ? 'tutor' : 'staff');
    }
  }, [profile]);

  useEffect(() => {
    if (!profile || profile.role === 'admin') return;
    const requesterId = profile.id;

    async function fetchRoleRequests() {
      const { data, error } = await supabase
        .from('role_change_requests')
        .select('id, requester_id, requested_role, status, created_at')
        .eq('requester_id', requesterId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        showToast('error', 'Failed to load role change requests');
        return;
      }
      setRoleRequests((data ?? []) as RoleChangeRequest[]);
    }

    fetchRoleRequests();
  }, [profile, showToast]);

  async function handleSaveProfile() {
    if (!profile) return;
    setSavingProfile(true);
    const { error } = await supabase.from('profiles').update({
      full_name: profileForm.full_name.trim(),
      phone: profileForm.phone.trim() || null,
    }).eq('id', profile.id);
    if (error) {
      showToast('error', 'Failed to update profile');
    } else {
      showToast('success', 'Profile updated successfully');
      refreshProfile();
    }
    setSavingProfile(false);
  }

  async function handleRoleRequest() {
    if (!profile || profile.role === 'admin') return;
    setSendingRoleRequest(true);
    const { error } = await supabase.from('role_change_requests').insert({
      requester_id: profile.id,
      requested_role: requestedRole,
    });
    if (error) {
      showToast('error', 'Failed to send role change request. You may already have a pending request.');
      setSendingRoleRequest(false);
      return;
    }

    showToast('success', `Your request to become ${requestedRole} was sent to the admin`);
    const { data, error: fetchError } = await supabase
      .from('role_change_requests')
      .select('id, requester_id, requested_role, status, created_at')
      .eq('requester_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (fetchError) {
      showToast('error', 'Request sent, but failed to refresh request history');
    } else {
      setRoleRequests((data ?? []) as RoleChangeRequest[]);
    }
    setSendingRoleRequest(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Settings className="h-6 w-6 text-sky-600" />
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">Manage your account information</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-slate-600" />
          <h2 className="font-bold text-slate-900">Account Information</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={profileForm.full_name}
                onChange={event => setProfileForm({ ...profileForm, full_name: event.target.value })}
                className="form-input pl-10"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={profileForm.phone}
                onChange={event => setProfileForm({ ...profileForm, phone: event.target.value })}
                className="form-input pl-10"
                placeholder="0917-xxx-xxxx"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span className="flex items-center gap-1.5">
            <Mail className="h-4 w-4 text-slate-400" />
            <span className="text-slate-600">{session?.user?.email ?? '—'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-slate-400" />
            <span className="font-medium capitalize text-slate-600">{profile?.role}</span>
          </span>
          {profile?.is_first_admin && (
            <span className="flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
              <Star className="h-3 w-3" /> First Admin
            </span>
          )}
          <span className="text-xs text-slate-400">Joined {formatDate(profile?.created_at ?? null)}</span>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
          >
            {savingProfile ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {profile?.role !== 'admin' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4">
            <h2 className="font-bold text-slate-900">Request a Role Change</h2>
            <p className="mt-1 text-sm text-slate-500">Ask an administrator to change your role to staff or tutor.</p>
          </div>

          {roleRequests.some(request => request.status === 'pending') ? (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              You already have a pending role request. Please wait for an administrator to review it.
            </p>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={requestedRole}
                onChange={event => setRequestedRole(event.target.value as 'staff' | 'tutor')}
                className="form-input sm:max-w-xs"
                aria-label="Requested role"
              >
                {(['staff', 'tutor'] as const).filter(role => role !== profile?.role).map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <button
                onClick={handleRoleRequest}
                disabled={sendingRoleRequest}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {sendingRoleRequest ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          )}

          {roleRequests.length > 0 && (
            <div className="mt-5 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Requests</h3>
              {roleRequests.map(request => (
                <div key={request.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-700">Requested role: <strong className="capitalize">{request.requested_role}</strong></span>
                  <span className={`font-semibold capitalize ${
                    request.status === 'approved' ? 'text-emerald-700' :
                      request.status === 'rejected' ? 'text-rose-700' : 'text-amber-700'
                  }`}>{request.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
