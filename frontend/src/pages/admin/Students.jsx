import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentAPI, classAPI } from '../../api';
import { PageHeader, Table, Badge, Button, Input, Select, Spinner, Card } from '../../components/ui';
import toast from 'react-hot-toast';

export default function Students() {
  const navigate  = useNavigate();
  const fileRef   = useRef();
  const [students,  setStudents]  = useState([]);
  const [classes,   setClasses]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [importing, setImporting] = useState(false);
  const [filters,   setFilters]   = useState({ class_id:'', search:'' });
  const [showForm,  setShowForm]  = useState(false);
  const [form, setForm] = useState({ name:'', email:'', class_id:'', dob:'', gender:'', academic_year:'' });
  const [saving, setSaving] = useState(false);

  const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear()+1}`;

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await studentAPI.list(filters);
      setStudents(data.data);
    } catch { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { loadStudents(); }, [loadStudents]);
  useEffect(() => { classAPI.list({}).then(({ data }) => setClasses(data.data)).catch(() => {}); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.class_id) return toast.error('Name, email and class required');
    setSaving(true);
    try {
      await studentAPI.create({ ...form, academic_year: form.academic_year || CURRENT_YEAR });
      toast.success('Student enrolled');
      setShowForm(false);
      setForm({ name:'', email:'', class_id:'', dob:'', gender:'', academic_year:'' });
      loadStudents();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to enrol'); }
    finally { setSaving(false); }
  }

  function downloadTemplate() {
    const csv = [
      'name,email,class_name,gender,dob,academic_year,student_number',
      'Ama Mensah,ama.mensah@example.com,JHS 1,female,2010-05-15,2025/2026,',
      'Kofi Boateng,kofi.boateng@example.com,JHS 2,male,2009-08-20,2025/2026,',
    ].join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href=url; a.download='students_bulk_template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    fileRef.current.value = '';
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const lines  = ev.target.result.split('\n').filter(l => l.trim());
        const header = lines[0].toLowerCase().split(',').map(h => h.trim());
        const students = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim());
          const row  = {};
          header.forEach((h, idx) => row[h] = cols[idx] || '');
          if (!row.name || !row.email || !row.class_name) continue;
          students.push({
            name:           row.name,
            email:          row.email,
            class_name:     row.class_name,
            gender:         row.gender || null,
            dob:            row.dob    || null,
            academic_year:  row.academic_year || CURRENT_YEAR,
            student_number: row.student_number || null,
          });
        }
        if (!students.length) { toast.error('No valid rows found'); setImporting(false); return; }

        const { data } = await studentAPI.bulkCreate(students);
        toast.success(`${data.data.created} enrolled, ${data.data.failed} failed`);
        if (data.data.errors?.length) {
          console.warn('Bulk import errors:', data.data.errors);
        }
        loadStudents();
      } catch { toast.error('Failed to parse CSV'); }
      finally { setImporting(false); }
    };
    reader.readAsText(file);
  }

  // Need to add bulkCreate to studentAPI
  if (!studentAPI.bulkCreate) {
    studentAPI.bulkCreate = (students) => {
      const api = require('../../api').default;
      return api.post('/students/bulk', { students });
    };
  }

  const columns = [
    { key: 'student_number', label: 'ID',      width:'120px' },
    { key: 'name',           label: 'Name',    width:'200px' },
    { key: 'class_name',     label: 'Class',   width:'120px', render:(v,row) => `${v} ${row.section}` },
    { key: 'gender',         label: 'Gender',  width:'90px',  render: v => v ? <span className="capitalize">{v}</span> : '—' },
    { key: 'academic_year',  label: 'Year',    width:'110px' },
    { key: 'enrolled_at',    label: 'Enrolled',width:'120px', render: v => v ? new Date(v).toLocaleDateString('en-GB') : '—' },
    { key: 'actions',        label: '',        width:'80px',
      render:(_, row) => (
        <button onClick={e => { e.stopPropagation(); navigate(`/students/${row.id}`); }}
          className="text-xs text-blue-600 hover:underline">View</button>
      )},
  ];

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={`${students.length} enrolled`}
        action={
          <div className="flex gap-2 flex-wrap">
            <Button onClick={downloadTemplate}>↓ CSV Template</Button>
            <Button onClick={() => fileRef.current.click()} loading={importing}>↑ Bulk Import</Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
            <Button variant="primary" onClick={() => setShowForm(true)}>+ Enrol student</Button>
          </div>
        }
      />

      <div className="flex gap-3 mb-5">
        <Input placeholder="Search name or ID…" value={filters.search}
          onChange={e => setFilters(p=>({...p,search:e.target.value}))} className="w-56" />
        <Select value={filters.class_id} onChange={e => setFilters(p=>({...p,class_id:e.target.value}))} className="w-44">
          <option value="">All classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </Select>
        <Button onClick={loadStudents}>Apply</Button>
      </div>

      <Card>
        {loading
          ? <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          : <Table columns={columns} data={students} emptyText="No students enrolled yet"
              onRowClick={row => navigate(`/students/${row.id}`)} />
        }
      </Card>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-base font-medium text-gray-800 mb-5">Enrol new student</h2>
            <form onSubmit={handleAdd} className="flex flex-col gap-3">
              <Input label="Full name *"     value={form.name}     onChange={e=>setForm(p=>({...p,name:e.target.value}))}    placeholder="Ama Asante" />
              <Input label="Email address *" value={form.email}    onChange={e=>setForm(p=>({...p,email:e.target.value}))}   placeholder="ama@school.edu" type="email" />
              <Select label="Class *" value={form.class_id} onChange={e=>setForm(p=>({...p,class_id:e.target.value}))}>
                <option value="">Select class…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
              </Select>
              <Input label="Academic year" value={form.academic_year} onChange={e=>setForm(p=>({...p,academic_year:e.target.value}))} placeholder={CURRENT_YEAR} />
              <Input label="Date of birth"  value={form.dob}     onChange={e=>setForm(p=>({...p,dob:e.target.value}))}      type="date" />
              <Select label="Gender" value={form.gender} onChange={e=>setForm(p=>({...p,gender:e.target.value}))}>
                <option value="">Select…</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </Select>
              <p className="text-xs text-gray-400">A welcome email with login details will be sent automatically.</p>
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