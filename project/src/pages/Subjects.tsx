import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CODING_LANGUAGE_SUBJECTS, DEPARTMENTS } from '@/lib/constants';
import { useToast } from '@/lib/toast-context';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Plus, Search, Pencil, Trash2, BookOpen, Code } from 'lucide-react';
import type { Subject } from '@/types';

export default function SubjectsPage() {
  const { showToast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [addingCodingSubjects, setAddingCodingSubjects] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [deleteSubject, setDeleteSubject] = useState<Subject | null>(null);

  const [form, setForm] = useState({ code: '', name: '', department: '', description: '' });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase.from('subjects').select('*').order('department').order('name');
    setSubjects(data as Subject[] ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditingSubject(null);
    setForm({ code: '', name: '', department: '', description: '' });
    setModalOpen(true);
  }

  function openEdit(subject: Subject) {
    setEditingSubject(subject);
    setForm({ code: subject.code, name: subject.name, department: subject.department, description: subject.description ?? '' });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.code.trim() || !form.name.trim() || !form.department) {
      showToast('error', 'Code, name, and department are required');
      return;
    }

    const subjectData = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      department: form.department,
      description: form.description.trim() || null,
    };

    if (editingSubject) {
      const { error } = await supabase.from('subjects').update(subjectData).eq('id', editingSubject.id);
      if (error) { showToast('error', error.message.includes('unique') ? 'Subject code already exists' : 'Failed to update subject'); return; }
      showToast('success', 'Subject updated successfully');
    } else {
      const { error } = await supabase.from('subjects').insert(subjectData);
      if (error) { showToast('error', error.message.includes('unique') ? 'Subject code already exists' : 'Failed to create subject'); return; }
      showToast('success', 'Subject added successfully');
    }

    setModalOpen(false);
    fetchData();
  }

  async function handleAddCodingSubjects() {
    setAddingCodingSubjects(true);
    const { data: existingSubjects, error: fetchError } = await supabase
      .from('subjects')
      .select('code, name');
    if (fetchError) {
      showToast('error', `Failed to check existing subjects: ${fetchError.message}`);
      setAddingCodingSubjects(false);
      return;
    }

    const existingCodes = new Set((existingSubjects ?? []).map(subject => subject.code.toUpperCase()));
    const existingNames = new Set((existingSubjects ?? []).map(subject => subject.name.trim().toLowerCase()));
    const newSubjects = CODING_LANGUAGE_SUBJECTS
      .filter(subject => !existingCodes.has(subject.code) && !existingNames.has(subject.name.toLowerCase()))
      .map(subject => ({
        ...subject,
        department: 'Computer Science',
        description: `Introduction to ${subject.name.replace(/ Programming$| Scripting$/, '')} programming concepts and practical coding.`,
      }));

    if (newSubjects.length === 0) {
      showToast('info', 'Coding language subjects are already in the subject list');
      setAddingCodingSubjects(false);
      return;
    }

    const { error } = await supabase.from('subjects').insert(newSubjects);
    if (error) {
      showToast('error', `Failed to add coding language subjects: ${error.message}`);
      setAddingCodingSubjects(false);
      return;
    }

    showToast('success', `Added ${newSubjects.length} coding language subjects`);
    await fetchData();
    setAddingCodingSubjects(false);
  }

  async function handleDelete() {
    if (!deleteSubject) return;
    const { error } = await supabase.from('subjects').delete().eq('id', deleteSubject.id);
    if (error) { showToast('error', 'Failed to delete subject — it may be linked to tutors or sessions'); return; }
    showToast('success', 'Subject deleted successfully');
    setDeleteSubject(null);
    fetchData();
  }

  const filtered = subjects.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase());
    const matchesDept = filterDept === 'all' || s.department === filterDept;
    return matchesSearch && matchesDept;
  });

  const deptColors: Record<string, string> = {
    Mathematics: 'bg-sky-50 text-sky-700',
    English: 'bg-emerald-50 text-emerald-700',
    Science: 'bg-amber-50 text-amber-700',
    'Computer Science': 'bg-violet-50 text-violet-700',
    Filipino: 'bg-rose-50 text-rose-700',
    'Social Sciences': 'bg-cyan-50 text-cyan-700',
    Business: 'bg-indigo-50 text-indigo-700',
    Education: 'bg-teal-50 text-teal-700',
  };

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
          <h1 className="text-2xl font-bold text-slate-900">Subjects</h1>
          <p className="mt-1 text-sm text-slate-500">Manage academic subjects offered for tutoring</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={handleAddCodingSubjects}
            disabled={addingCodingSubjects}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-sm font-semibold text-sky-700 transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Code className="h-4 w-4" />
            {addingCodingSubjects ? 'Adding Languages...' : 'Add Coding Languages'}
          </button>
          <button
            onClick={openAdd}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
          >
            <Plus className="h-4 w-4" />
            Add Subject
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search subjects by name or code..."
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

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-16">
          <BookOpen className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-400">No subjects found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(subject => (
            <div key={subject.id} className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
                    <Code className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{subject.name}</h3>
                    <p className="text-xs font-medium text-slate-400">{subject.code}</p>
                  </div>
                </div>
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${deptColors[subject.department] ?? 'bg-slate-100 text-slate-600'}`}>
                  {subject.department}
                </span>
              </div>
              {subject.description && (
                <p className="mt-3 text-sm text-slate-500 line-clamp-2">{subject.description}</p>
              )}
              <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => openEdit(subject)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => setDeleteSubject(subject)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingSubject ? 'Edit Subject' : 'Add Subject'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Subject Code *">
              <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}
                className="form-input" placeholder="MATH101" />
            </Field>
            <Field label="Department *">
              <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="form-input">
                <option value="">Select department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Subject Name *">
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="form-input" placeholder="College Algebra" />
          </Field>
          <Field label="Description">
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="form-input" rows={3} placeholder="Brief description of the subject" />
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 transition-colors">
              {editingSubject ? 'Save Changes' : 'Add Subject'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteSubject}
        onClose={() => setDeleteSubject(null)}
        onConfirm={handleDelete}
        title="Delete Subject"
        message={<>Are you sure you want to delete <strong>{deleteSubject?.name}</strong> ({deleteSubject?.code})? This will also remove related tutor assignments. This action cannot be undone.</>}
        confirmLabel="Delete"
        variant="danger"
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
