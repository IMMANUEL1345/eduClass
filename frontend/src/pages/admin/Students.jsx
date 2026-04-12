import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentAPI, classAPI } from '../../api';
import { PageHeader, Table, Badge, Button, Input, Select, Spinner, Card } from '../../components/ui';
import toast from 'react-hot-toast';

function gradeColor(g) {
  if (!g) return 'gray';
  if (g.startsWith('A')) return 'green';
  if (g.startsWith('B')) return 'blue';
  if (g.startsWith('C')) return 'amber';
  return 'red';
}

export default function Students() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [classes,  setClasses]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filters,  setFilters]  = useState({ class_id: '', search: '' });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', class_id: '', dob: '', gender: '' });
  const [saving, setSaving] = useState(false);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await studentAPI.list(filters);
      setStudents(data.data);
    } catch { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  useEffect(() => {
    classAPI.list({}).then(({ data }) => setClasses(data.data)).catch(() => {});
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.class_id) return toast.error('Name, email and class are required');
    setSaving(true);
    try {
      await studentAPI.create(form);
      toast.success('Student enrolled');
      setShowForm(false);
      setForm({ name: '', email: '', class_id: '', dob: '', gender: '' });
      loadStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to enrol student');
    } finally { setSaving(false); }
  }

  const columns = [
    { key: 'student_number', label: 'ID',      width: '120px' },
    { key: 'name',           label: 'Name',     width: '200px' },
    { key: 'class_name',     label: 'Class',    width: '120px',
      render: (v, row) => `${v} ${row.section}` },
    { key: 'gender',         label: 'Gender',   width: '90px',
      render: v => v ? <span className="capitalize">{v}</span> : '—' },
    { key: 'academic_year',  label: 'Year',     width: '110px' },
    { key: 'enrolled_at',    label: 'Enrolled', width: '120px',
      render: v => v ? new Date(v).toLocaleDateString('en-GB') : '—' },
    { key: 'actions',        label: '',         width: '80px',
      render: (_, row) => (
        <button
          onClick={e => { e.stopPropagation(); navigate(`/students/${row.id}`); }}
          className="text-xs text-blue-600 hover:underline"
        >
          View
        </button>
      )},
  ];

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={`${students.length} enrolled`}
        action={
          <Button variant="primary" onClick={() => setShowForm(true)}>+ Enrol student</Button>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <Input
          placeholder="Search name or ID…"
          value={filters.search}
          onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
          className="w-56"
        />
        <Select
          value={filters.class_id}
          onChange={e => setFilters(p => ({ ...p, class_id: e.target.value }))}
          className="w-44"
        >
          <option value="">All classes</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name} {c.section}</option>
          ))}
        </Select>
        <Button onClick={loadStudents}>Apply</Button>
      </div>

      {/* Table */}
      <Card>
        {loading
          ? <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          : <Table columns={columns} data={students} onRowClick={row => navigate(`/students/${row.id}`)} />
        }
      </Card>

      {/* Add student modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-base font-medium text-gray-800 mb-5">Enrol new student</h2>
            <form onSubmit={handleAdd} className="flex flex-col gap-3">
              <Input label="Full name *"     name="name"     value={form.name}     onChange={e => setForm(p=>({...p,name:e.target.value}))}  placeholder="Ama Asante" />
              <Input label="Email address *" name="email"    value={form.email}    onChange={e => setForm(p=>({...p,email:e.target.value}))} placeholder="ama@school.edu" type="email" />
              <Select label="Class *" value={form.class_id} onChange={e => setForm(p=>({...p,class_id:e.target.value}))}>
                <option value="">Select class…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
              </Select>
              <Input label="Date of birth" name="dob" value={form.dob} onChange={e => setForm(p=>({...p,dob:e.target.value}))} type="date" />
              <Select label="Gender" value={form.gender} onChange={e => setForm(p=>({...p,gender:e.target.value}))}>
                <option value="">Select…</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </Select>
              <p className="text-xs text-gray-400">Default password: <code>Student@123</code> — student should change on first login.</p>
              <div className="flex justify-end gap-3 mt-2">
                <Button type="button" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" variant="primary" loading={saving}>Enrol</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
