import React, { useEffect, useState, useCallback } from 'react';
import { feeAPI, classAPI } from '../../api';
import {
  PageHeader, Card, Table, Button, Input, Select, Badge, Spinner, Empty,
} from '../../components/ui';
import toast from 'react-hot-toast';

const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
const TERMS = ['Term 1', 'Term 2', 'Term 3'];

export default function FeeStructures() {
  const [classes,    setClasses]    = useState([]);
  const [structures, setStructures] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [form, setForm] = useState({
    class_id: '', term: 'Term 1', academic_year: CURRENT_YEAR,
    amount: '', description: 'School fees',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await feeAPI.listStructures({});
      setStructures(data.data);
    } catch { toast.error('Failed to load fee structures'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    classAPI.list({}).then(({ data }) => setClasses(data.data)).catch(() => {});
  }, []);

  function openAdd() {
    setEditId(null);
    setForm({ class_id: '', term: 'Term 1', academic_year: CURRENT_YEAR, amount: '', description: 'School fees' });
    setShowForm(true);
  }

  function openEdit(row) {
    setEditId(row.id);
    setForm({ class_id: '', term: row.term, academic_year: row.academic_year, amount: row.amount, description: row.description });
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.amount) return toast.error('Amount is required');
    setSaving(true);
    try {
      if (editId) {
        await feeAPI.updateStructure(editId, { amount: parseFloat(form.amount), description: form.description });
        toast.success('Fee structure updated');
      } else {
        if (!form.class_id) return toast.error('Class is required');
        await feeAPI.createStructure({
          class_id:     parseInt(form.class_id),
          term:         form.term,
          academic_year: form.academic_year,
          amount:       parseFloat(form.amount),
          description:  form.description,
        });
        toast.success('Fee structure created');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  }

  const columns = [
    { key: 'class_name',    label: 'Class',       width: '120px', render: (v, row) => `${v} ${row.section}` },
    { key: 'term',          label: 'Term',         width: '90px'  },
    { key: 'academic_year', label: 'Year',         width: '110px' },
    { key: 'description',   label: 'Description',  width: '160px' },
    { key: 'amount',        label: 'Amount',       width: '120px',
      render: v => <span className="font-medium text-gray-800">GH₵{parseFloat(v).toFixed(2)}</span> },
    { key: 'created_by',    label: 'Created by',   width: '130px', render: v => <span className="text-gray-400 text-xs">{v}</span> },
    { key: 'actions',       label: '',             width: '60px',
      render: (_, row) => (
        <button onClick={() => openEdit(row)} className="text-xs text-blue-600 hover:underline">Edit</button>
      )},
  ];

  return (
    <div>
      <PageHeader
        title="Fee structures"
        subtitle="Set fee amounts per class per term"
        action={<Button variant="primary" onClick={openAdd}>+ Add structure</Button>}
      />

      <Card>
        {loading
          ? <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          : structures.length === 0
            ? <Empty message="No fee structures yet — add one to get started" />
            : <Table columns={columns} data={structures} />
        }
      </Card>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-base font-medium text-gray-800 mb-5">
              {editId ? 'Edit fee structure' : 'Add fee structure'}
            </h2>
            <form onSubmit={handleSave} className="flex flex-col gap-3">
              {!editId && (
                <>
                  <Select label="Class *" value={form.class_id} onChange={e => setForm(p => ({ ...p, class_id: e.target.value }))}>
                    <option value="">Select class…</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                  </Select>
                  <Select label="Term *" value={form.term} onChange={e => setForm(p => ({ ...p, term: e.target.value }))}>
                    {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                  <Input label="Academic year *" value={form.academic_year}
                    onChange={e => setForm(p => ({ ...p, academic_year: e.target.value }))} placeholder="2025/2026" />
                </>
              )}
              <Input
                label="Amount (GH₵) *" type="number" min="0.01" step="0.01"
                value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="e.g. 350.00"
              />
              <Input
                label="Description"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="School fees"
              />
              <div className="flex justify-end gap-3 mt-2">
                <Button type="button" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" variant="primary" loading={saving}>
                  {editId ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}