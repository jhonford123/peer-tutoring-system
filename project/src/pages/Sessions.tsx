import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast-context';
import { formatDate, formatTime, SESSION_STATUSES } from '@/lib/constants';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Plus, Search, Pencil, Trash2, CalendarDays, Gift } from 'lucide-react';
import type { Session, Tutor, Subject } from '@/types';

export default function SessionsPage() {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [deleteSession, setDeleteSession] = useState<Session | null>(null);
  const [statusUpdate, setStatusUpdate] = useState<{ session: Session; newStatus: string } | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    tutor_id: '', subject_id: '', student_name: '', student_email: '',
    session_date: today, start_time: '09:00', end_time: '10:00', location: '', notes: '', status: 'scheduled',
  });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [sessionsRes, tutorsRes, subjectsRes] = await Promise.all([
      supabase.from('sessions').select('*, tutor:tutors(*), subject:subjects(*)').order('session_date', { ascending: false }).order('start_time', { ascending: false }),
      supabase.from('tutors').select('*').eq('status', 'active').order('name'),
      supabase.from('subjects').select('*').order('name'),
    ]);
    setSessions(sessionsRes.data as Session[] ?? []);
    setTutors(tutorsRes.data as Tutor[] ?? []);
    setSubjects(subjectsRes.data as Subject[] ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditingSession(null);
    setForm({
      tutor_id: '', subject_id: '', student_name: '', student_email: '',
      session_date: today, start_time: '09:00', end_time: '10:00', location: '', notes: '', status: 'scheduled',
    });
    setModalOpen(true);
  }

  function openEdit(session: Session) {
    setEditingSession(session);
    setForm({
      tutor_id: session.tutor_id, subject_id: session.subject_id,
      student_name: session.student_name, student_email: session.student_email ?? '',
      session_date: session.session_date, start_time: session.start_time,
      end_time: session.end_time, location: session.location ?? '',
      notes: session.notes ?? '', status: session.status,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.tutor_id || !form.subject_id || !form.student_name.trim() || !form.session_date) {
      showToast('error', 'Please fill in all required fields');
      return;
    }
    const sessionData = {
      tutor_id: form.tutor_id,
      subject_id: form.subject_id,
      student_name: form.student_name.trim(),
      student_email: form.student_email.trim() || null,
      session_date: form.session_date,
      start_time: form.start_time,
      end_time: form.end_time,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
    };

    if (editingSession) {
      const { error } = await supabase.from('sessions').update(sessionData).eq('id', editingSession.id);
      if (error) { showToast('error', 'Failed to update session'); return; }
      showToast('success', 'Session updated successfully');
    } else {
      const { error } = await supabase.from('sessions').insert(sessionData);
      if (error) { showToast('error', 'Failed to create session'); return; }
      showToast('success', 'Session scheduled successfully');
    }

    setModalOpen(false);
    fetchData();
  }

  async function handleDelete() {
    if (!deleteSession) return;
    const { error } = await supabase.from('sessions').delete().eq('id', deleteSession.id);
    if (error) { showToast('error', 'Failed to delete session'); return; }
    showToast('success', 'Session deleted successfully');
    setDeleteSession(null);
    fetchData();
  }

  async function handleStatusUpdate() {
    if (!statusUpdate) return;
    const { error } = await supabase.from('sessions').update({ status: statusUpdate.newStatus }).eq('id', statusUpdate.session.id);
    if (error) { showToast('error', 'Failed to update status'); return; }
    showToast('success', `Session marked as ${statusUpdate.newStatus}`);
    setStatusUpdate(null);
    fetchData();
  }

  const filtered = sessions.filter(s => {
    const matchesSearch = s.student_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.tutor?.name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tutoring Sessions</h1>
          <p className="mt-1 text-sm text-slate-500">Schedule and manage peer tutoring sessions</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Schedule Session
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student or tutor name..."
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
          {SESSION_STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-16">
          <CalendarDays className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-400">No sessions found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tutor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date & Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(session => (
                  <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                          {session.student_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{session.student_name}</p>
                          {session.student_email && <p className="text-xs text-slate-400">{session.student_email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{session.tutor?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                        {session.subject?.code ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700">{formatDate(session.session_date)}</p>
                      <p className="text-xs text-slate-400">{formatTime(session.start_time)} - {formatTime(session.end_time)}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{session.location ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <Gift className="h-3 w-3" /> Free
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={session.status}
                        onChange={e => setStatusUpdate({ session, newStatus: e.target.value })}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-100 cursor-pointer"
                      >
                        {SESSION_STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(session)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteSession(session)} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingSession ? 'Edit Session' : 'Schedule Session'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tutor *">
              <select value={form.tutor_id} onChange={e => setForm({ ...form, tutor_id: e.target.value })} className="form-input">
                <option value="">Select tutor</option>
                {tutors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Subject *">
              <select value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} className="form-input">
                <option value="">Select subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Student Name *">
              <input type="text" value={form.student_name} onChange={e => setForm({ ...form, student_name: e.target.value })}
                className="form-input" placeholder="Student name" />
            </Field>
            <Field label="Student Email">
              <input type="email" value={form.student_email} onChange={e => setForm({ ...form, student_email: e.target.value })}
                className="form-input" placeholder="student@bestlink.edu.ph" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date *">
              <input type="date" value={form.session_date} onChange={e => setForm({ ...form, session_date: e.target.value })} className="form-input" />
            </Field>
            <Field label="Start Time *">
              <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} className="form-input" />
            </Field>
            <Field label="End Time *">
              <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} className="form-input" />
            </Field>
          </div>
          <Field label="Location">
            <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
              className="form-input" placeholder="Library Room 2" />
          </Field>
          <Field label="Notes">
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              className="form-input" rows={2} placeholder="Optional session notes" />
          </Field>
          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            Tutoring sessions are free.
          </div>
          <Field label="Status">
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="form-input">
              {SESSION_STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 transition-colors">
              {editingSession ? 'Save Changes' : 'Schedule'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteSession}
        onClose={() => setDeleteSession(null)}
        onConfirm={handleDelete}
        title="Delete Session"
        message={<>Are you sure you want to delete the tutoring session for <strong>{deleteSession?.student_name}</strong>? This action cannot be undone.</>}
        confirmLabel="Delete"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={!!statusUpdate}
        onClose={() => setStatusUpdate(null)}
        onConfirm={handleStatusUpdate}
        title="Update Session Status"
        message={<>Change session for <strong>{statusUpdate?.session.student_name}</strong> from <StatusBadge status={statusUpdate?.session.status ?? ''} /> to <StatusBadge status={statusUpdate?.newStatus ?? ''} />?</>}
        confirmLabel="Update Status"
        variant="info"
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  );
}
