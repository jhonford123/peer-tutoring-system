import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast-context';
import { formatDate, formatTime, SESSION_STATUSES } from '@/lib/constants';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Plus, Search, Pencil, Trash2, Presentation, CalendarDays, MapPin, Clock, UserPlus, Users, X } from 'lucide-react';
import type { Workshop, WorkshopEnrollment, Tutor } from '@/types';

export default function WorkshopsPage() {
  const { showToast } = useToast();
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(null);
  const [deleteWorkshop, setDeleteWorkshop] = useState<Workshop | null>(null);
  const [enrollModal, setEnrollModal] = useState<Workshop | null>(null);
  const [viewEnrollments, setViewEnrollments] = useState<Workshop | null>(null);
  const [enrollments, setEnrollments] = useState<WorkshopEnrollment[]>([]);
  const [statusUpdate, setStatusUpdate] = useState<{ workshop: Workshop; newStatus: string } | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    title: '', description: '', tutor_id: '', workshop_date: today,
    start_time: '13:00', end_time: '15:00', location: '', capacity: '30', status: 'scheduled',
  });
  const [enrollForm, setEnrollForm] = useState({ student_name: '', student_email: '' });
  const [enrollConfirm, setEnrollConfirm] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [wsRes, tutorsRes] = await Promise.all([
      supabase.from('workshops').select('*, tutor:tutors(*), enrollments:workshop_enrollments(*)').order('workshop_date', { ascending: false }),
      supabase.from('tutors').select('*').eq('status', 'active').order('name'),
    ]);
    setWorkshops(wsRes.data as Workshop[] ?? []);
    setTutors(tutorsRes.data as Tutor[] ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditingWorkshop(null);
    setForm({
      title: '', description: '', tutor_id: '', workshop_date: today,
      start_time: '13:00', end_time: '15:00', location: '', capacity: '30', status: 'scheduled',
    });
    setModalOpen(true);
  }

  function openEdit(ws: Workshop) {
    setEditingWorkshop(ws);
    setForm({
      title: ws.title, description: ws.description ?? '', tutor_id: ws.tutor_id ?? '',
      workshop_date: ws.workshop_date, start_time: ws.start_time, end_time: ws.end_time,
      location: ws.location ?? '', capacity: String(ws.capacity), status: ws.status,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.workshop_date) {
      showToast('error', 'Title and date are required');
      return;
    }

    const wsData = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      tutor_id: form.tutor_id || null,
      workshop_date: form.workshop_date,
      start_time: form.start_time,
      end_time: form.end_time,
      location: form.location.trim() || null,
      capacity: parseInt(form.capacity) || 30,
      status: form.status,
    };

    if (editingWorkshop) {
      const { error } = await supabase.from('workshops').update(wsData).eq('id', editingWorkshop.id);
      if (error) { showToast('error', 'Failed to update workshop'); return; }
      showToast('success', 'Workshop updated successfully');
    } else {
      const { error } = await supabase.from('workshops').insert(wsData);
      if (error) { showToast('error', 'Failed to create workshop'); return; }
      showToast('success', 'Workshop created successfully');
    }

    setModalOpen(false);
    fetchData();
  }

  async function handleDelete() {
    if (!deleteWorkshop) return;
    const { error } = await supabase.from('workshops').delete().eq('id', deleteWorkshop.id);
    if (error) { showToast('error', 'Failed to delete workshop'); return; }
    showToast('success', 'Workshop deleted successfully');
    setDeleteWorkshop(null);
    fetchData();
  }

  async function handleStatusUpdate() {
    if (!statusUpdate) return;
    const { error } = await supabase.from('workshops').update({ status: statusUpdate.newStatus }).eq('id', statusUpdate.workshop.id);
    if (error) { showToast('error', 'Failed to update status'); return; }
    showToast('success', `Workshop marked as ${statusUpdate.newStatus}`);
    setStatusUpdate(null);
    fetchData();
  }

  async function openEnrollModal(ws: Workshop) {
    setEnrollForm({ student_name: '', student_email: '' });
    setEnrollModal(ws);
    setEnrollConfirm(false);
  }

  async function handleEnroll() {
    if (!enrollModal) return;
    if (!enrollForm.student_name.trim()) {
      showToast('error', 'Student name is required');
      return;
    }

    const enrolled = enrollModal.enrollments?.filter(e => e.status === 'enrolled').length ?? 0;
    if (enrolled >= enrollModal.capacity) {
      showToast('error', 'Workshop is at full capacity');
      return;
    }

    if (enrollConfirm) {
      const { error } = await supabase.from('workshop_enrollments').insert({
        workshop_id: enrollModal.id,
        student_name: enrollForm.student_name.trim(),
        student_email: enrollForm.student_email.trim() || null,
        status: 'enrolled',
      });

      if (error) {
        if (error.message.includes('unique') || error.code === '23505') {
          showToast('error', 'This student is already enrolled in this workshop');
        } else {
          showToast('error', 'Failed to enroll student');
        }
        return;
      }

      showToast('success', `${enrollForm.student_name} enrolled successfully`);
      setEnrollModal(null);
      fetchData();
    } else {
      setEnrollConfirm(true);
    }
  }

  async function openEnrollmentsView(ws: Workshop) {
    setViewEnrollments(ws);
    const { data } = await supabase
      .from('workshop_enrollments')
      .select('*')
      .eq('workshop_id', ws.id)
      .order('created_at', { ascending: false });
    setEnrollments(data as WorkshopEnrollment[] ?? []);
  }

  async function updateEnrollmentStatus(id: string, status: string) {
    const { error } = await supabase.from('workshop_enrollments').update({ status }).eq('id', id);
    if (error) { showToast('error', 'Failed to update enrollment'); return; }
    showToast('success', `Enrollment marked as ${status}`);
    if (viewEnrollments) {
      openEnrollmentsView(viewEnrollments);
    }
    fetchData();
  }

  async function removeEnrollment(id: string) {
    const { error } = await supabase.from('workshop_enrollments').delete().eq('id', id);
    if (error) { showToast('error', 'Failed to remove enrollment'); return; }
    showToast('success', 'Enrollment removed');
    if (viewEnrollments) {
      openEnrollmentsView(viewEnrollments);
    }
    fetchData();
  }

  const filtered = workshops.filter(w => {
    const matchesSearch = w.title.toLowerCase().includes(search.toLowerCase()) ||
      (w.tutor?.name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || w.status === filterStatus;
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
          <h1 className="text-2xl font-bold text-slate-900">Tutor Workshops</h1>
          <p className="mt-1 text-sm text-slate-500">Schedule workshops and manage student enrollments</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Workshop
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search workshops..."
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
          <Presentation className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-400">No workshops found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(ws => {
            const enrolled = ws.enrollments?.filter(e => e.status === 'enrolled').length ?? 0;
            const isFull = enrolled >= ws.capacity;
            return (
              <div key={ws.id} className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50">
                      <Presentation className="h-5 w-5 text-sky-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 line-clamp-1">{ws.title}</h3>
                      <p className="text-xs text-slate-500">{ws.tutor?.name ?? 'Unassigned'}</p>
                    </div>
                  </div>
                  <StatusBadge status={ws.status} />
                </div>

                {ws.description && (
                  <p className="mt-3 text-sm text-slate-500 line-clamp-2">{ws.description}</p>
                )}

                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5" /> {formatDate(ws.workshop_date)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="h-3.5 w-3.5" /> {formatTime(ws.start_time)} - {formatTime(ws.end_time)}
                  </div>
                  {ws.location && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5" /> {ws.location}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <span className={isFull ? 'font-semibold text-rose-600' : 'text-slate-600'}>
                      {enrolled} / {ws.capacity} enrolled
                    </span>
                    {isFull && <span className="rounded bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-600">Full</span>}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => openEnrollModal(ws)}
                    disabled={isFull || ws.status === 'cancelled'}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Enroll
                  </button>
                  <button
                    onClick={() => openEnrollmentsView(ws)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    <Users className="h-3.5 w-3.5" /> View ({enrolled})
                  </button>
                  <button
                    onClick={() => openEdit(ws)}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteWorkshop(ws)}
                    className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingWorkshop ? 'Edit Workshop' : 'Add Workshop'}>
        <div className="space-y-4">
          <Field label="Title *">
            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              className="form-input" placeholder="Effective Study Strategies" />
          </Field>
          <Field label="Description">
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="form-input" rows={3} placeholder="What will be covered in this workshop?" />
          </Field>
          <Field label="Tutor (Facilitator)">
            <select value={form.tutor_id} onChange={e => setForm({ ...form, tutor_id: e.target.value })} className="form-input">
              <option value="">Unassigned</option>
              {tutors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date *">
              <input type="date" value={form.workshop_date} onChange={e => setForm({ ...form, workshop_date: e.target.value })} className="form-input" />
            </Field>
            <Field label="Start *">
              <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} className="form-input" />
            </Field>
            <Field label="End *">
              <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} className="form-input" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Location">
              <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                className="form-input" placeholder="Library Seminar Room A" />
            </Field>
            <Field label="Capacity">
              <input type="number" min="1" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className="form-input" />
            </Field>
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
              {editingWorkshop ? 'Save Changes' : 'Add Workshop'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Enroll modal with confirmation */}
      <Modal isOpen={!!enrollModal} onClose={() => { setEnrollModal(null); setEnrollConfirm(false); }} title="Enroll Student">
        {enrollModal && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">{enrollModal.title}</p>
              <p className="text-xs text-slate-500">{formatDate(enrollModal.workshop_date)} • {formatTime(enrollModal.start_time)}</p>
            </div>
            <Field label="Student Name *">
              <input
                type="text"
                value={enrollForm.student_name}
                onChange={e => setEnrollForm({ ...enrollForm, student_name: e.target.value })}
                className="form-input"
                placeholder="Student name"
                autoFocus
              />
            </Field>
            <Field label="Student Email">
              <input
                type="email"
                value={enrollForm.student_email}
                onChange={e => setEnrollForm({ ...enrollForm, student_email: e.target.value })}
                className="form-input"
                placeholder="student@bestlink.edu.ph"
              />
            </Field>
            {enrollConfirm && (
              <div className="rounded-lg bg-sky-50 px-3 py-2.5 text-sm text-sky-700">
                Please confirm: enroll <strong>{enrollForm.student_name || 'this student'}</strong> in <strong>{enrollModal.title}</strong>?
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setEnrollModal(null); setEnrollConfirm(false); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleEnroll}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
                  enrollConfirm ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-sky-600 hover:bg-sky-700'
                }`}
              >
                {enrollConfirm ? 'Confirm Enrollment' : 'Enroll Student'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* View enrollments modal */}
      <Modal isOpen={!!viewEnrollments} onClose={() => setViewEnrollments(null)} title="Enrolled Students" maxWidth="max-w-2xl">
        {viewEnrollments && (
          <div className="space-y-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">{viewEnrollments.title}</p>
              <p className="text-xs text-slate-500">
                {formatDate(viewEnrollments.workshop_date)} • {enrollments.filter(e => e.status === 'enrolled').length} / {viewEnrollments.capacity} enrolled
              </p>
            </div>
            {enrollments.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No students enrolled yet</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {enrollments.map(e => (
                  <div key={e.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                        {e.student_name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{e.student_name}</p>
                        {e.student_email && <p className="text-xs text-slate-400">{e.student_email}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={e.status}
                        onChange={ev => updateEnrollmentStatus(e.id, ev.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-100 cursor-pointer"
                      >
                        <option value="enrolled">Enrolled</option>
                        <option value="attended">Attended</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <button
                        onClick={() => removeEnrollment(e.id)}
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteWorkshop}
        onClose={() => setDeleteWorkshop(null)}
        onConfirm={handleDelete}
        title="Delete Workshop"
        message={<>Are you sure you want to delete <strong>{deleteWorkshop?.title}</strong>? All enrollments will also be removed. This action cannot be undone.</>}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Status update confirm */}
      <ConfirmDialog
        isOpen={!!statusUpdate}
        onClose={() => setStatusUpdate(null)}
        onConfirm={handleStatusUpdate}
        title="Update Workshop Status"
        message={<>Change workshop <strong>{statusUpdate?.workshop.title}</strong> status to <StatusBadge status={statusUpdate?.newStatus ?? ''} />?</>}
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
