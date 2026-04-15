import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectRole } from '../../store/slices/authSlice';
import api from '../../api';
import { PageHeader, Card, Table, Button, Input, Select, Badge, StatCard, Spinner } from '../../components/ui';
import toast from 'react-hot-toast';

const CATEGORIES = ['Salary','Utilities','Maintenance','Supplies','Other'];
const STATUS_COLOR = { recorded:'amber', approved:'green', rejected:'red' };

export default function Expenses() {
  const role     = useSelector(selectRole);
  const isAdmin  = role === 'admin';
  const [expenses, setExpenses] = useState([]);
  const [summary,  setSummary]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [filters,  setFilters]  = useState({ category:'', status:'' });
  const [form, setForm] = useState({ title:'', category:'Salary', amount:'', paid_to:'', paid_on: new Date().toISOString().split('T')[0], notes:'' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, s] = await Promise.all([
        api.get('/expenses', { params: filters }),
        api.get('/expenses/summary', { params: { year: new Date().getFullYear() } }),
      ]);
      setExpenses(e.data.data);
      setSummary(s.data.data);
    } catch { toast.error('Failed to load expenses'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.title || !form.amount) return toast.error('Title and amount required');
    setSaving(true);
    try {
      await api.post('/expenses', form);
      toast.success('Expense recorded');
      setShowForm(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  }

  async function handleApprove(id) {
    try { await api.post(`/expenses/${id}/approve`); toast.success('Approved'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  }

  async function handleReject(id) {
    try { await api.post(`/expenses/${id}/reject`); toast.success('Rejected'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this expense?')) return;
    try { await api.delete(`/expenses/${id}`); toast.success('Deleted'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  }

  const totalApproved = expenses.filter(e => e.status === 'approved').reduce((s, e) => s + parseFloat(e.amount), 0);
  const totalPending  = expenses.filter(e => e.status === 'recorded').reduce((s, e) => s + parseFloat(e.amount), 0);

  const columns = [
    { key: 'paid_on',          label: 'Date',      width:'100px', render: v => new Date(v).toLocaleDateString('en-GB') },
    { key: 'title',            label: 'Title',     render: (v, row) => (
        <div><p className="text-sm font-medium text-gray-700">{v}</p>
        {row.paid_to && <p className="text-xs text-gray-400">Paid to: {row.paid_to}</p>}</div>
      )},
    { key: 'category',         label: 'Category',  width:'110px', render: v => <Badge color="gray">{v}</Badge> },
    { key: 'amount',           label: 'Amount',    width:'110px', render: v => <span className="font-medium">GH₵{parseFloat(v).toFixed(2)}</span> },
    { key: 'status',           label: 'Status',    width:'100px', render: v => <Badge color={STATUS_COLOR[v]}>{v}</Badge> },
    { key: 'recorded_by_name', label: 'By',        width:'120px', render: v => <span className="text-xs text-gray-400">{v}</span> },
    { key: 'actions',          label: '',          width:'150px',
      render: (_, row) => (
        <div className="flex gap-2">
          {isAdmin && row.status === 'recorded' && (
            <>
              <button onClick={() => handleApprove(row.id)} className="text-xs text-green-600 hover:underline">Approve</button>
              <button onClick={() => handleReject(row.id)} className="text-xs text-red-500 hover:underline">Reject</button>
            </>
          )}
          {!isAdmin && row.status === 'recorded' && (
            <button onClick={() => handleDelete(row.id)} className="text-xs text-red-500 hover:underline">Delete</button>
          )}
        </div>
      )},
  ];

  return (
    <div>
      <PageHeader title="Expenses"
        action={
          <div className="flex gap-2">
            {!isAdmin && <Button variant="primary" onClick={() => setShowForm(true)}>+ Record expense</Button>}
            <Button onClick={load}>Refresh</Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard label="Approved this year" value={`GH₵${totalApproved.toFixed(2)}`} color="green" />
        <StatCard label="Pending approval"   value={`GH₵${totalPending.toFixed(2)}`}  color="amber" />
        <StatCard label="Total records"      value={expenses.length}                   color="blue"  />
      </div>

      <div className="flex gap-3 mb-5">
        <Select value={filters.category} onChange={e => setFilters(p => ({ ...p, category: e.target.value }))} className="w-36">
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))} className="w-36">
          <option value="">All statuses</option>
          <option value="recorded">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </Select>
        <Button onClick={load}>Apply</Button>
      </div>

      <Card>
        {loading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          : <Table columns={columns} data={expenses} emptyText="No expenses recorded" />}
      </Card>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-base font-medium text-gray-800 mb-5">Record expense</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <Input label="Title *" value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))} placeholder="e.g. Electricity bill" />
              <Select label="Category *" value={form.category} onChange={e => setForm(p=>({...p,category:e.target.value}))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Input label="Amount (GH₵) *" type="number" step="0.01" value={form.amount} onChange={e => setForm(p=>({...p,amount:e.target.value}))} placeholder="0.00" />
              <Input label="Paid to" value={form.paid_to} onChange={e => setForm(p=>({...p,paid_to:e.target.value}))} placeholder="Vendor / person name" />
              <Input label="Date" type="date" value={form.paid_on} onChange={e => setForm(p=>({...p,paid_on:e.target.value}))} />
              <textarea rows={2} value={form.notes} onChange={e => setForm(p=>({...p,notes:e.target.value}))}
                placeholder="Notes (optional)"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex justify-end gap-3 mt-2">
                <Button type="button" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" variant="primary" loading={saving}>Record</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}