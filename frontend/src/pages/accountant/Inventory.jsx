import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader, Card, Table, Button, Input, Select, Badge, Spinner } from '../../components/ui';
import toast from 'react-hot-toast';

const CATEGORIES = ['Books','Uniforms','Stationery','Other'];
const CAT_COLOR  = { Books:'blue', Uniforms:'purple', Stationery:'teal', Other:'gray' };

export default function Inventory() {
  const navigate = useNavigate();
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [search,   setSearch]   = useState('');
  const [catFilter,setCatFilter]= useState('');
  const [form, setForm] = useState({ name:'', category:'Books', price:'', stock_qty:'', reorder_level:'5', description:'' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/inventory/items', { params: { search, category: catFilter } });
      setItems(data.data);
    } catch { toast.error('Failed to load inventory'); }
    finally { setLoading(false); }
  }, [search, catFilter]);

  useEffect(() => { load(); }, []);

  function openAdd() { setEditItem(null); setForm({ name:'', category:'Books', price:'', stock_qty:'', reorder_level:'5', description:'' }); setShowForm(true); }
  function openEdit(item) { setEditItem(item); setForm({ name:item.name, category:item.category, price:item.price, stock_qty:item.stock_qty, reorder_level:item.reorder_level, description:item.description||'' }); setShowForm(true); }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name || !form.price) return toast.error('Name and price required');
    setSaving(true);
    try {
      if (editItem) {
        await api.put(`/inventory/items/${editItem.id}`, form);
        toast.success('Item updated');
      } else {
        await api.post('/inventory/items', form);
        toast.success('Item added');
      }
      setShowForm(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  }

  const lowStockItems = items.filter(i => i.stock_qty <= i.reorder_level);

  const columns = [
    { key: 'name',        label: 'Item',      render: (v, row) => (
        <div>
          <p className="text-sm font-medium text-gray-700">{v}</p>
          {row.description && <p className="text-xs text-gray-400">{row.description}</p>}
        </div>
      )},
    { key: 'category',    label: 'Category',  width:'110px', render: v => <Badge color={CAT_COLOR[v] || 'gray'}>{v}</Badge> },
    { key: 'price',       label: 'Price',     width:'100px', render: v => `GH₵${parseFloat(v).toFixed(2)}` },
    { key: 'stock_qty',   label: 'Stock',     width:'80px',
      render: (v, row) => <span className={v <= row.reorder_level ? 'text-red-500 font-medium' : 'text-gray-700'}>{v}</span> },
    { key: 'reorder_level', label: 'Reorder', width:'80px', render: v => <span className="text-gray-400 text-xs">{v}</span> },
    { key: 'actions',     label: '',          width:'120px',
      render: (_, row) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(row)} className="text-xs text-blue-600 hover:underline">Edit</button>
          <button onClick={() => navigate('/inventory/pos')} className="text-xs text-green-600 hover:underline">Sell</button>
        </div>
      )},
  ];

  return (
    <div>
      <PageHeader title="Inventory" subtitle={`${items.length} items`}
        action={
          <div className="flex gap-2">
            <Button onClick={() => navigate('/inventory/pos')} variant="primary">POS Terminal</Button>
            <Button onClick={openAdd}>+ Add item</Button>
          </div>
        }
      />

      {lowStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-5 flex items-center gap-2">
          <span className="text-red-500">⚠️</span>
          <p className="text-sm text-red-600 font-medium">
            {lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} low on stock:
            {' '}{lowStockItems.map(i => i.name).join(', ')}
          </p>
        </div>
      )}

      <div className="flex gap-3 mb-5">
        <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="w-48" />
        <Select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="w-36">
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Button onClick={load}>Search</Button>
      </div>

      <Card>
        {loading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          : <Table columns={columns} data={items} emptyText="No items in inventory" />}
      </Card>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-base font-medium text-gray-800 mb-5">{editItem ? 'Edit item' : 'Add item'}</h2>
            <form onSubmit={handleSave} className="flex flex-col gap-3">
              <Input label="Item name *" value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Exercise book" />
              <Select label="Category *" value={form.category} onChange={e => setForm(p=>({...p,category:e.target.value}))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Input label="Price (GH₵) *" type="number" step="0.01" value={form.price} onChange={e => setForm(p=>({...p,price:e.target.value}))} placeholder="0.00" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Stock qty" type="number" value={form.stock_qty} onChange={e => setForm(p=>({...p,stock_qty:e.target.value}))} placeholder="0" />
                <Input label="Reorder level" type="number" value={form.reorder_level} onChange={e => setForm(p=>({...p,reorder_level:e.target.value}))} placeholder="5" />
              </div>
              <Input label="Description" value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))} placeholder="Optional" />
              <div className="flex justify-end gap-3 mt-2">
                <Button type="button" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" variant="primary" loading={saving}>{editItem ? 'Update' : 'Add item'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}