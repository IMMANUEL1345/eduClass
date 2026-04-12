import React, { useEffect, useState, useCallback } from 'react';
import { teacherAPI } from '../../api';
import {
  PageHeader, Table, Badge, Button, Input, Card, Spinner, StatCard,
} from '../../components/ui';
import toast from 'react-hot-toast';

export default function Teachers() {
  const [teachers,   setTeachers]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState(null);
  const [detail,     setDetail]     = useState(null);
  const [detailLoad, setDetailLoad] = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [search,     setSearch]     = useState('');
  const [saving,     setSaving]     = useState(false);
  const [form, setForm] = useState({ name: '', email: '', specialization: '', phone: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await teacherAPI.list({});
      setTeachers(data.data);
    } catch { toast.error('Failed to load teachers'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openDetail(teacher) {
    setSelected(teacher);
    setDetailLoad(true);
    try {
      const [cls, subs] = await Promise.all([
        teacherAPI.classes(teacher.id),
        teacherAPI.subjects(teacher.id),
      ]);
      setDetail({ classes: cls.data.data, subjects: subs.data.data });
    } catch { toast.error('Failed to load teacher details'); }
    finally { setDetailLoad(false); }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name || !form.email) return toast.error('Name and email required');
    setSaving(true);
    try {
      await teacherAPI.create(form);
      toast.success('Teacher account created');
      setShowForm(false);
      setForm({ name: '', email: '', specialization: '', phone: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create teacher');
    } finally { setSaving(false); }
  }

  const filtered = teachers.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.staff_number?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'staff_number',    label: 'Staff ID',       width: '110px' },
    { key: 'name',            label: 'Name',           width: '180px' },
    { key: 'specialization',  label: 'Specialization', width: '160px', render: v => v || '—' },
    { key: 'phone',           label: 'Phone',          width: '130px', render: v => v || '—' },
    { key: 'subject_count',   label: 'Subjects',       width: '90px',
      render: v => <Badge color="blue">{v ?? 0}</Badge> },
    { key: 'is_active',       label: 'Status',         width: '90px',
      render: v => <Badge color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Badge> },
  ];

  return (
    <div className="flex gap-5">

      {/* Left — list */}
      <div className="flex-1 min-w-0">
        <PageHeader
          title="Teachers"
          subtitle={`${teachers.length} staff members`}
          action={<Button variant="primary" onClick={() => setShowForm(true)}>+ Add teacher</Button>}
        />

        <div className="mb-4">
          <Input
            placeholder="Search by name or staff ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-64"
          />
        </div>

        <Card>
          {loading
            ? <div className="flex justify-center py-16"><Spinner size="lg" /></div>
            : <Table
                columns={columns}
                data={filtered}
                onRowClick={openDetail}
                emptyText="No teachers found"
              />
          }
        </Card>
      </div>

      {/* Right — detail panel */}
      {selected && (
        <div className="w-72 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-700">Teacher profile</h2>
            <button onClick={() => { setSelected(null); setDetail(null); }}
              className="text-xs text-gray-400 hover:text-gray-600">Close</button>
          </div>

          {/* Avatar + name */}
          <Card className="mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center
                              justify-center text-sm font-medium flex-shrink-0">
                {selected.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{selected.name}</p>
                <p className="text-xs text-gray-400">{selected.email}</p>
              </div>
            </div>
            <table className="w-full text-xs">
              {[
                ['Staff ID',       selected.staff_number || '—'],
                ['Specialization', selected.specialization || '—'],
                ['Phone',          selected.phone || '—'],
                ['Status',         selected.is_active ? 'Active' : 'Inactive'],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-gray-50 last:border-0">
                  <td className="py-1.5 text-gray-400 w-28">{k}</td>
                  <td className="py-1.5 text-gray-700 font-medium">{v}</td>
                </tr>
              ))}
            </table>
          </Card>

          {detailLoad
            ? <div className="flex justify-center py-8"><Spinner /></div>
            : detail && (
              <>
                <Card title={`Classes (${detail.classes.length})`} className="mb-4">
                  {detail.classes.length === 0
                    ? <p className="text-xs text-gray-400 py-2">No homeroom classes</p>
                    : detail.classes.map(c => (
                        <div key={c.id} className="flex items-center justify-between py-1.5
                                                    border-b border-gray-50 last:border-0">
                          <span className="text-sm text-gray-700">{c.name} {c.section}</span>
                          <Badge color="gray">{c.student_count} students</Badge>
                        </div>
                      ))
                  }
                </Card>

                <Card title={`Subjects (${detail.subjects.length})`}>
                  {detail.subjects.length === 0
                    ? <p className="text-xs text-gray-400 py-2">No subjects assigned</p>
                    : detail.subjects.map(s => (
                        <div key={s.id} className="flex items-center justify-between py-1.5
                                                    border-b border-gray-50 last:border-0">
                          <div>
                            <p className="text-sm text-gray-700">{s.name}</p>
                            <p className="text-xs text-gray-400">{s.class_name} {s.section}</p>
                          </div>
                          <span className="text-xs text-gray-400">{s.periods_per_week}×/wk</span>
                        </div>
                      ))
                  }
                </Card>
              </>
            )
          }
        </div>
      )}

      {/* Add teacher modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-base font-medium text-gray-800 mb-5">Add teacher</h2>
            <form onSubmit={handleAdd} className="flex flex-col gap-3">
              <Input label="Full name *"       value={form.name}           onChange={e => setForm(p => ({ ...p, name: e.target.value }))}           placeholder="Kwame Osei" />
              <Input label="Email *"           value={form.email}          onChange={e => setForm(p => ({ ...p, email: e.target.value }))}          placeholder="k.osei@school.edu" type="email" />
              <Input label="Specialization"    value={form.specialization} onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))} placeholder="Mathematics" />
              <Input label="Phone"             value={form.phone}          onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}          placeholder="+233 24 000 0000" />
              <p className="text-xs text-gray-400">Default password: <code>Teacher@123</code></p>
              <div className="flex justify-end gap-3 mt-2">
                <Button type="button" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" variant="primary" loading={saving}>Create account</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
