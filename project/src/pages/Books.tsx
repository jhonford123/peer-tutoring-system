import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BOOK_CATEGORIES } from '@/lib/constants';
import { useToast } from '@/lib/toast-context';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Download, Gift, BookOpen, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Book } from '@/types';

interface BookForm {
  title: string;
  author: string;
  description: string;
  category: string;
  stock: string;
}

const emptyForm: BookForm = {
  title: '',
  author: '',
  description: '',
  category: 'Textbook',
  stock: '0',
};

export default function BooksPage() {
  const { showToast } = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [deleteBook, setDeleteBook] = useState<Book | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [form, setForm] = useState<BookForm>(emptyForm);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('books').select('*').order('created_at', { ascending: false });
    if (error) showToast('error', 'Failed to load books');
    setBooks(data as Book[] ?? []);
    setLoading(false);
  }, [showToast]);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  function openAdd() {
    setEditingBook(null);
    setSelectedFile(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  }

  function openEdit(book: Book) {
    setEditingBook(book);
    setSelectedFile(null);
    setForm({
      title: book.title,
      author: book.author,
      description: book.description ?? '',
      category: book.category,
      stock: String(book.stock),
    });
    setModalOpen(true);
  }

  async function uploadBookFile(file: File): Promise<string | null> {
    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    const { data, error } = await supabase.storage.from('book-uploads').upload(fileName, file, {
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    });
    if (error) {
      showToast('error', `Failed to upload the book file: ${error.message}`);
      return null;
    }
    return supabase.storage.from('book-uploads').getPublicUrl(data.path).data.publicUrl || null;
  }

  async function handleSave() {
    if (!form.title.trim() || !form.author.trim()) {
      showToast('error', 'Title and author are required');
      return;
    }
    if (!editingBook && !selectedFile) {
      showToast('error', 'Please upload the book file before submitting a publish request');
      return;
    }

    setUploadingFile(true);
    let fileUrl = editingBook?.cover_image_url ?? null;
    if (selectedFile) {
      fileUrl = await uploadBookFile(selectedFile);
      if (!fileUrl) {
        setUploadingFile(false);
        return;
      }
    }

    const bookData = {
      title: form.title.trim(),
      author: form.author.trim(),
      description: form.description.trim() || null,
      category: form.category,
      stock: Math.max(0, parseInt(form.stock, 10) || 0),
      cover_image_url: fileUrl,
      status: editingBook ? editingBook.status : 'pending_review',
    };

    const result = editingBook
      ? await supabase.from('books').update(bookData).eq('id', editingBook.id)
      : await supabase.from('books').insert(bookData);
    if (result.error) {
      showToast('error', editingBook ? 'Failed to update book' : `Failed to submit publish request: ${result.error.message}`);
      setUploadingFile(false);
      return;
    }

    showToast('success', editingBook ? 'Book updated successfully' : 'Book publish request sent to admin for review');
    setUploadingFile(false);
    setModalOpen(false);
    setSelectedFile(null);
    fetchBooks();
  }

  async function downloadBookFile(book: Book) {
    if (!book.cover_image_url) {
      showToast('error', 'This book does not have a downloadable file');
      return;
    }
    try {
      const response = await fetch(book.cover_image_url);
      if (!response.ok) throw new Error(`Download failed with status ${response.status}`);
      const fileUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      const path = new URL(book.cover_image_url).pathname;
      const fileName = decodeURIComponent(path.split('/').pop() || '') || `${book.title}.pdf`;
      anchor.href = fileUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
    } catch {
      showToast('error', 'Could not download the book file');
    }
  }

  async function handleDelete() {
    if (!deleteBook) return;
    const { error } = await supabase.from('books').delete().eq('id', deleteBook.id);
    if (error) {
      showToast('error', 'Failed to delete book');
      return;
    }
    showToast('success', 'Book deleted successfully');
    setDeleteBook(null);
    fetchBooks();
  }

  const filtered = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(search.toLowerCase()) ||
      book.author.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (filterCategory === 'all' || book.category === filterCategory);
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Book Library</h1>
          <p className="mt-1 text-sm text-slate-500">Publish and download approved books for free</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700">
          <Plus className="h-4 w-4" /> Publish Book
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title or author..."
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </div>
        <select
          value={filterCategory}
          onChange={event => setFilterCategory(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
        >
          <option value="all">All Categories</option>
          {BOOK_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-16">
          <BookOpen className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-400">No books found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(book => (
            <div key={book.id} className="rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                  <BookOpen className="h-5 w-5 text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-1 font-bold text-slate-900">{book.title}</h3>
                  <p className="text-xs text-slate-500">by {book.author}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <Gift className="h-3 w-3" /> Free
                </span>
              </div>
              {book.description && <p className="mt-3 line-clamp-2 text-sm text-slate-500">{book.description}</p>}
              <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{book.category}</span>
                <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {book.stock} in stock</span>
                <StatusBadge status={book.status} />
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => downloadBookFile(book)}
                  disabled={!book.cover_image_url || !['approved', 'published'].includes(book.status)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </button>
                <button onClick={() => openEdit(book)} aria-label={`Edit ${book.title}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setDeleteBook(book)} aria-label={`Delete ${book.title}`} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingBook ? 'Edit Book' : 'Publish Book'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title *">
              <input type="text" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className="form-input" placeholder="Book title" />
            </Field>
            <Field label="Author *">
              <input type="text" value={form.author} onChange={event => setForm({ ...form, author: event.target.value })} className="form-input" placeholder="Author name" />
            </Field>
          </div>
          <Field label="Description">
            <textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className="form-input" rows={3} placeholder="Brief description of the book" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} className="form-input">
                {BOOK_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
              </select>
            </Field>
            <Field label="Stock">
              <input type="number" min="0" step="1" value={form.stock} onChange={event => setForm({ ...form, stock: event.target.value })} className="form-input" />
            </Field>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">All books in the library are free.</div>
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Book File *</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.epub,.ppt,.pptx,.png,.jpg,.jpeg"
              onChange={event => setSelectedFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-sky-700"
            />
            {selectedFile && <p className="mt-2 text-xs text-slate-500">Selected file: {selectedFile.name}</p>}
            {!selectedFile && editingBook?.cover_image_url && <p className="mt-2 text-xs text-slate-500">Current file: attached</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={uploadingFile} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70">
              {uploadingFile ? 'Submitting...' : editingBook ? 'Save Changes' : 'Send Publish Request'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteBook}
        onClose={() => setDeleteBook(null)}
        onConfirm={handleDelete}
        title="Delete Book"
        message={<>Are you sure you want to delete <strong>{deleteBook?.title}</strong>? This action cannot be undone.</>}
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
