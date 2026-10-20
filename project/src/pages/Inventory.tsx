import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CATEGORIES, CONDITIONS } from '@/lib/constants';
import { useToast } from '@/lib/toast-context';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Plus, Search, Pencil, Trash2, Package, ArrowDownToLine, ArrowUpFromLine, History, MapPin } from 'lucide-react';
import type { InventoryItem, InventoryTransaction } from '@/types';

export default function InventoryPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [stockModal, setStockModal] = useState<{ item: InventoryItem; type: 'stock_in' | 'stock_out' } | null>(null);
  const [historyModal, setHistoryModal] = useState<InventoryItem | null>(null);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);

  const [form, setForm] = useState({
    name: '', category: 'Textbook', quantity: '0', unit: 'pcs', condition_status: 'good', location: '',
  });
  const [stockForm, setStockForm] = useState({ quantity: '1', reason: '' });

  useEffect(() => { fetchItems(); }, []);

  async function fetchItems() {
    setLoading(true);
    const { data } = await supabase.from('inventory_items').select('*').order('name');
    setItems(data as InventoryItem[] ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditingItem(null);
    setForm({ name: '', category: 'Textbook', quantity: '0', unit: 'pcs', condition_status: 'good', location: '' });
    setModalOpen(true);
  }

  function openEdit(item: InventoryItem) {
    setEditingItem(item);
    setForm({
      name: item.name, category: item.category, quantity: String(item.quantity),
      unit: item.unit, condition_status: item.condition_status, location: item.location ?? '',
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.category) {
      showToast('error', 'Name and category are required');
      return;
    }

    const itemData = {
      name: form.name.trim(),
      category: form.category,
      quantity: parseInt(form.quantity) || 0,
      unit: form.unit,
      condition_status: form.condition_status,
      location: form.location.trim() || null,
    };

    if (editingItem) {
      const { error } = await supabase.from('inventory_items').update(itemData).eq('id', editingItem.id);
      if (error) { showToast('error', 'Failed to update item'); return; }
      showToast('success', 'Item updated successfully');
    } else {
      const { error } = await supabase.from('inventory_items').insert(itemData);
      if (error) { showToast('error', 'Failed to create item'); return; }
      showToast('success', 'Item added successfully');
    }

    setModalOpen(false);
    fetchItems();
  }

  async function handleDelete() {
    if (!deleteItem) return;
    const { error } = await supabase.from('inventory_items').delete().eq('id', deleteItem.id);
    if (error) { showToast('error', 'Failed to delete item'); return; }
    showToast('success', 'Item deleted successfully');
    setDeleteItem(null);
    fetchItems();
  }

  async function openStockModal(item: InventoryItem, type: 'stock_in' | 'stock_out') {
    setStockForm({ quantity: '1', reason: '' });
    setStockModal({ item, type });
  }

  async function handleStockAdjust() {
    if (!stockModal) return;
    const qty = parseInt(stockForm.quantity);
    if (!qty || qty <= 0) {
      showToast('error', 'Quantity must be a positive number');
      return;
    }

    const { item, type } = stockModal;

    if (type === 'stock_out' && qty > item.quantity) {
      showToast('error', `Insufficient stock. Only ${item.quantity} ${item.unit} available`);
      return;
    }

    const newQty = type === 'stock_in' ? item.quantity + qty : item.quantity - qty;

    const { error: updateError } = await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', item.id);
    if (updateError) { showToast('error', 'Failed to update stock'); return; }

    await supabase.from('inventory_transactions').insert({
      item_id: item.id,
      transaction_type: type,
      quantity: qty,
      reason: stockForm.reason.trim() || null,
    });

    showToast('success', `Stock ${type === 'stock_in' ? 'added' : 'removed'} successfully. New quantity: ${newQty} ${item.unit}`);
    setStockModal(null);
    fetchItems();
  }

  async function openHistory(item: InventoryItem) {
    setHistoryModal(item);
    const { data } = await supabase
      .from('inventory_transactions')
      .select('*, item:inventory_items(*)')
      .eq('item_id', item.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setTransactions(data as InventoryTransaction[] ?? []);
  }

  const filtered = items.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = filterCategory === 'all' || i.category === filterCategory;
    return matchesSearch && matchesCat;
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
          <h1 className="text-2xl font-bold text-slate-900">Inventory Management</h1>
          <p className="mt-1 text-sm text-slate-500">Track learning materials, equipment, and supplies</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search inventory items..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </div>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-16">
          <Package className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-400">No inventory items found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Condition</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                          <Package className="h-4 w-4 text-slate-500" />
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{item.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-bold ${item.quantity < 5 ? 'text-rose-600' : item.quantity < 10 ? 'text-amber-600' : 'text-slate-900'}`}>
                        {item.quantity}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={item.condition_status} /></td>
                    <td className="px-4 py-3">
                      {item.location ? (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="h-3 w-3" /> {item.location}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openStockModal(item, 'stock_in')}
                          title="Stock In"
                          className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                          <ArrowDownToLine className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openStockModal(item, 'stock_out')}
                          title="Stock Out"
                          className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 transition-colors"
                        >
                          <ArrowUpFromLine className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openHistory(item)}
                          title="History"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteItem(item)}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 transition-colors"
                        >
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

      {/* Add/Edit modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingItem ? 'Edit Item' : 'Add Item'}>
        <div className="space-y-4">
          <Field label="Item Name *">
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="form-input" placeholder="College Algebra Textbook" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category *">
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="form-input">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Unit">
              <input type="text" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                className="form-input" placeholder="pcs, sets, boxes" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">
              <input type="number" min="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })}
                className="form-input" />
            </Field>
            <Field label="Condition">
              <select value={form.condition_status} onChange={e => setForm({ ...form, condition_status: e.target.value })} className="form-input">
                {CONDITIONS.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Storage Location">
            <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
              className="form-input" placeholder="Library Shelf A1" />
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 transition-colors">
              {editingItem ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Stock adjust modal */}
      <Modal
        isOpen={!!stockModal}
        onClose={() => setStockModal(null)}
        title={stockModal?.type === 'stock_in' ? 'Stock In' : 'Stock Out'}
      >
        {stockModal && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">{stockModal.item.name}</p>
              <p className="text-xs text-slate-500">
                Current stock: <span className="font-bold text-slate-700">{stockModal.item.quantity} {stockModal.item.unit}</span>
              </p>
            </div>
            <Field label={`Quantity to ${stockModal.type === 'stock_in' ? 'add' : 'remove'} *`}>
              <input
                type="number"
                min="1"
                value={stockForm.quantity}
                onChange={e => setStockForm({ ...stockForm, quantity: e.target.value })}
                className="form-input"
                autoFocus
              />
            </Field>
            <Field label="Reason / Note">
              <textarea
                value={stockForm.reason}
                onChange={e => setStockForm({ ...stockForm, reason: e.target.value })}
                className="form-input"
                rows={2}
                placeholder={stockModal.type === 'stock_in' ? 'New delivery, donation, etc.' : 'Distributed to students, damaged, etc.'}
              />
            </Field>
            {stockModal.type === 'stock_out' && parseInt(stockForm.quantity) > stockModal.item.quantity && (
              <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                Insufficient stock. Only {stockModal.item.quantity} {stockModal.item.unit} available.
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setStockModal(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleStockAdjust}
                disabled={stockModal.type === 'stock_out' && parseInt(stockForm.quantity) > stockModal.item.quantity}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
                  stockModal.type === 'stock_in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Confirm {stockModal.type === 'stock_in' ? 'Stock In' : 'Stock Out'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* History modal */}
      <Modal isOpen={!!historyModal} onClose={() => setHistoryModal(null)} title="Transaction History" maxWidth="max-w-2xl">
        {historyModal && (
          <div className="space-y-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">{historyModal.name}</p>
              <p className="text-xs text-slate-500">Current stock: {historyModal.quantity} {historyModal.unit}</p>
            </div>
            {transactions.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No transactions recorded yet</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {transactions.map(t => (
                  <div key={t.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center gap-3">
                      {t.transaction_type === 'stock_in' ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                          <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                          <ArrowUpFromLine className="h-4 w-4 text-amber-600" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-slate-900 capitalize">
                          {t.transaction_type.replace('_', ' ')}: {t.quantity} {historyModal.unit}
                        </p>
                        {t.reason && <p className="text-xs text-slate-500">{t.reason}</p>}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">{new Date(t.created_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDelete}
        title="Delete Item"
        message={<>Are you sure you want to delete <strong>{deleteItem?.name}</strong>? This will also remove all transaction history. This action cannot be undone.</>}
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
