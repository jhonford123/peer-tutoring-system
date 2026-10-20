import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DEPARTMENTS } from '@/lib/constants';
import { useToast } from '@/lib/toast-context';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Plus, Search, Pencil, Trash2, Mail, Phone, Star, BookOpen, Users, CalendarDays, Clock3, Video, MapPin } from 'lucide-react';
import type { Tutor, Subject, TutorSubject } from '@/types';

export default function TutorsPage() {
  const { showToast } = useToast();
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tutorSubjects, setTutorSubjects] = useState<TutorSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTutor, setEditingTutor] = useState<Tutor | null>(null);
  const [deleteTutor, setDeleteTutor] = useState<Tutor | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', department: '', year_level: '', status: 'active', rating: '5.0',
    availability_date: '', availability_start_time: '', availability_end_time: '',
    tutoring_method: '', meeting_details: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [tutorsRes, subjectsRes, tsRes] = await Promise.all([
      supabase.from('tutors').select('*').order('name'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('tutor_subjects').select('*, tutor:tutors(*), subject:subjects(*)'),
    ]);
    setTutors(tutorsRes.data as Tutor[] ?? []);
    setSubjects(subjectsRes.data as Subject[] ?? []);
    setTutorSubjects(tsRes.data as TutorSubject[] ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditingTutor(null);
    setForm({
      name: '', email: '', phone: '', department: '', year_level: '', status: 'active', rating: '5.0',
      availability_date: '', availability_start_time: '', availability_end_time: '',
      tutoring_method: '', meeting_details: '',
    });
    setSelectedSubjectIds([]);
    setModalOpen(true);
  }

  function openEdit(tutor: Tutor) {
    setEditingTutor(tutor);
    setForm({
      name: tutor.name, email: tutor.email ?? '', phone: tutor.phone ?? '',
      department: tutor.department ?? '', year_level: tutor.year_level ?? '',
      status: tutor.status, rating: String(tutor.rating),
      availability_date: tutor.availability_date ?? '',
      availability_start_time: tutor.availability_start_time?.slice(0, 5) ?? '',
      availability_end_time: tutor.availability_end_time?.slice(0, 5) ?? '',
      tutoring_method: tutor.tutoring_method ?? '',
      meeting_details: tutor.meeting_details ?? '',
    });
    const tutorSubs = tutorSubjects.filter(ts => ts.tutor_id === tutor.id).map(ts => ts.subject_id);
    setSelectedSubjectIds(tutorSubs);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      showToast('error', 'Tutor name is required');
      return;
    }

    const hasSchedule = form.availability_date || form.availability_start_time || form.availability_end_time;
    if (hasSchedule && (!form.availability_date || !form.availability_start_time || !form.availability_end_time || !form.tutoring_method)) {
      showToast('error', 'Complete the tutoring date, start/end times, and method');
      return;
    }
    if (form.availability_start_time && form.availability_end_time && form.availability_end_time <= form.availability_start_time) {
      showToast('error', 'End time must be later than start time');
      return;
    }
    if (['Google Meet', 'Zoom', 'Microsoft Teams'].includes(form.tutoring_method) && !form.meeting_details.trim()) {
      showToast('error', 'Add the meeting link or code for the selected online method');
      return;
    }

    const tutorData = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      department: form.department || null,
      year_level: form.year_level || null,
      status: form.status,
      rating: parseFloat(form.rating) || 5.0,
      availability_date: form.availability_date || null,
      availability_start_time: form.availability_start_time || null,
      availability_end_time: form.availability_end_time || null,
      tutoring_method: form.tutoring_method || null,
      meeting_details: form.meeting_details.trim() || null,
    };

    if (editingTutor) {
      const { error } = await supabase.from('tutors').update(tutorData).eq('id', editingTutor.id);
      if (error) { showToast('error', 'Failed to update tutor'); return; }

      await supabase.from('tutor_subjects').delete().eq('tutor_id', editingTutor.id);
      if (selectedSubjectIds.length > 0) {
        await supabase.from('tutor_subjects').insert(
          selectedSubjectIds.map(sid => ({ tutor_id: editingTutor.id, subject_id: sid }))
        );
      }
      showToast('success', 'Tutor updated successfully');
    } else {
      const { data, error } = await supabase.from('tutors').insert(tutorData).select().single();
      if (error) { showToast('error', 'Failed to create tutor'); return; }

      if (selectedSubjectIds.length > 0) {
        await supabase.from('tutor_subjects').insert(
          selectedSubjectIds.map(sid => ({ tutor_id: data.id, subject_id: sid }))
        );
      }
      showToast('success', 'Tutor added successfully');
    }

    setModalOpen(false);
    fetchData();
  }

  async function handleDelete() {
    if (!deleteTutor) return;
    const { error } = await supabase.from('tutors').delete().eq('id', deleteTutor.id);
    if (error) { showToast('error', 'Failed to delete tutor'); return; }
    showToast('success', 'Tutor deleted successfully');
    setDeleteTutor(null);
    fetchData();
  }

  const filtered = tutors.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.email ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesDept = filterDept === 'all' || t.department === filterDept;
    return matchesSearch && matchesDept;
  });

  function getTutorSubjects(tutorId: string): Subject[] {
    return tutorSubjects.filter(ts => ts.tutor_id === tutorId).map(ts => ts.subject!).filter(Boolean);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tutors</h1>
          <p className="mt-1 text-sm text-slate-500">Manage peer tutors and their subject assignments</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Tutor
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search tutors by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </div>
        <select
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
        >
          <option value="all">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Tutor grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-16">
          <Users className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-400">No tutors found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(tutor => {
            const subs = getTutorSubjects(tutor.id);
            return (
              <div key={tutor.id} className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-lg font-bold text-sky-700">
                      {tutor.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{tutor.name}</h3>
                      <p className="text-xs text-slate-500">{tutor.department} • {tutor.year_level}</p>
                    </div>
                  </div>
                  <StatusBadge status={tutor.status} />
                </div>

                <div className="mt-4 space-y-2">
                  {tutor.email && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Mail className="h-3.5 w-3.5" /> {tutor.email}
                    </div>
                  )}
                  {tutor.phone && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Phone className="h-3.5 w-3.5" /> {tutor.phone}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Star className="h-3.5 w-3.5 text-amber-400" /> {tutor.rating.toFixed(1)} rating
                  </div>
                  {tutor.availability_date && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {new Date(`${tutor.availability_date}T00:00:00`).toLocaleDateString()}
                    </div>
                  )}
                  {tutor.availability_start_time && tutor.availability_end_time && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatTime(tutor.availability_start_time)} - {formatTime(tutor.availability_end_time)}
                    </div>
                  )}
                  {tutor.tutoring_method && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {tutor.tutoring_method === 'Face-to-face'
                        ? <MapPin className="h-3.5 w-3.5" />
                        : <Video className="h-3.5 w-3.5" />}
                      {tutor.tutoring_method}
                    </div>
                  )}
                  {tutor.meeting_details && (
                    <div className="break-all pl-5 text-xs text-sky-700">
                      {/^https?:\/\//i.test(tutor.meeting_details)
                        ? <a href={tutor.meeting_details} target="_blank" rel="noreferrer" className="hover:underline">{tutor.meeting_details}</a>
                        : tutor.meeting_details}
                    </div>
                  )}
                </div>

                {subs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {subs.slice(0, 3).map(s => (
                      <span key={s.id} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {s.code}
                      </span>
                    ))}
                    {subs.length > 3 && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        +{subs.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => openEdit(tutor)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => setDeleteTutor(tutor)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingTutor ? 'Edit Tutor' : 'Add Tutor'}>
        <div className="space-y-4">
          <Field label="Full Name *">
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="form-input" placeholder="Juan Dela Cruz" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="form-input" placeholder="email@bestlink.edu.ph" />
            </Field>
            <Field label="Phone">
              <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="form-input" placeholder="0917-xxx-xxxx" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department">
              <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="form-input">
                <option value="">Select department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Year Level">
              <input type="text" value={form.year_level} onChange={e => setForm({ ...form, year_level: e.target.value })}
                className="form-input" placeholder="3rd Year" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="form-input">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            <Field label="Rating">
              <input type="number" min="0" max="5" step="0.1" value={form.rating}
                onChange={e => setForm({ ...form, rating: e.target.value })} className="form-input" />
            </Field>
          </div>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Tutoring Schedule & Method</h3>
              <p className="mt-1 text-xs text-slate-500">Optional. Set a date, time, and how students can meet you.</p>
            </div>
            <Field label="Tutoring Date">
              <input type="date" value={form.availability_date}
                onChange={e => setForm({ ...form, availability_date: e.target.value })} className="form-input" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Time">
                <input type="time" value={form.availability_start_time}
                  onChange={e => setForm({ ...form, availability_start_time: e.target.value })} className="form-input" />
              </Field>
              <Field label="End Time">
                <input type="time" value={form.availability_end_time}
                  onChange={e => setForm({ ...form, availability_end_time: e.target.value })} className="form-input" />
              </Field>
            </div>
            <Field label="Tutoring Method">
              <select value={form.tutoring_method}
                onChange={e => setForm({ ...form, tutoring_method: e.target.value })} className="form-input">
                <option value="">Select a method</option>
                <option value="Google Meet">Google Meet</option>
                <option value="Zoom">Zoom</option>
                <option value="Microsoft Teams">Microsoft Teams</option>
                <option value="Face-to-face">Face-to-face</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field label={['Google Meet', 'Zoom', 'Microsoft Teams'].includes(form.tutoring_method) ? 'Meeting Link or Code *' : 'Meeting Link, Code, or Location'}>
              <input type="text" value={form.meeting_details}
                onChange={e => setForm({ ...form, meeting_details: e.target.value })}
                className="form-input"
                placeholder={['Google Meet', 'Zoom', 'Microsoft Teams'].includes(form.tutoring_method)
                  ? 'Paste the meeting URL or enter the code'
                  : 'Enter a meeting link, code, room, or venue'} />
            </Field>
          </div>
          <Field label="Assigned Subjects">
            <div className="max-h-40 overflow-y-auto space-y-2 rounded-xl border border-slate-200 p-3">
              {subjects.length === 0 ? (
                <p className="text-xs text-slate-400">No subjects available</p>
              ) : subjects.map(s => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 rounded-lg p-1.5">
                  <input
                    type="checkbox"
                    checked={selectedSubjectIds.includes(s.id)}
                    onChange={e => {
                      if (e.target.checked) setSelectedSubjectIds([...selectedSubjectIds, s.id]);
                      else setSelectedSubjectIds(selectedSubjectIds.filter(id => id !== s.id));
                    }}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-medium">{s.code}</span> - {s.name}
                </label>
              ))}
            </div>
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 transition-colors">
              {editingTutor ? 'Save Changes' : 'Add Tutor'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTutor}
        onClose={() => setDeleteTutor(null)}
        onConfirm={handleDelete}
        title="Delete Tutor"
        message={<>Are you sure you want to delete <strong>{deleteTutor?.name}</strong>? This will also remove all their session assignments and subject links. This action cannot be undone.</>}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

function formatTime(value: string): string {
  const [hours, minutes] = value.split(':');
  const hour = Number(hours);
  const period = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${minutes} ${period}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  );
}
