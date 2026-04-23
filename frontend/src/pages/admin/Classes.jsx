import React, { useEffect, useState, useCallback } from 'react';
import { classAPI, teacherAPI } from '../../api';
import {
  PageHeader, Table, Badge, Button, Input, Select, Card, Spinner,
} from '../../components/ui';
import toast from 'react-hot-toast';

export default function Classes() {
  const [classes,   setClasses]   = useState([]);
  const [teachers,  setTeachers]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState(null);
  const [subjects,  setSubjects]  = useState([]);
  const [students,  setStudents]  = useState([]);
  const [tab,       setTab]       = useState('subjects'); // 'subjects' | 'students'
  const [showClass, setShowClass] = useState(false);
  const [showSubj,  setShowSubj]  = useState(false);
  const [saving,    setSaving]    = useState(false);

  const [classForm, setClassForm] = useState({ name: '', section: 'A', academic_year: '2025/2026', homeroom_teacher_id: '' });
  const [subjForm,  setSubjForm]  = useState({ name: '', code: '', teacher_id: '', periods_per_week: 5 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await classAPI.list({});
      setClasses(data.data);
    } catch { toast.error('Failed to load classes'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    teacherAPI.list({}).then(({ data }) => setTeachers(data.data)).catch(() => {});
  }, []);

  async function openClass(cls) {
    setSelected(cls);
    setTab('subjects');
    loadClassDetail(cls.id, 'subjects');
  }

  async function loadClassDetail(id, t) {
    setSubjects([]); setStudents([]);
    try {
      if (t === 'subjects') {
        const { data } = await classAPI.subjects(id);
        setSubjects(data.data);
      } else {
        const { data } = await classAPI.students(id);
        setStudents(data.data);
      }
    } catch { toast.error('Failed to load details'); }
  }

  function switchTab(t) {
    setTab(t);
    if (selected) loadClassDetail(selected.id, t);
  }

  async function handleAddClass(e) {
    e.preventDefault();
    if (!classForm.name || !classForm.academic_year) return toast.error('Name and year required');
    setSaving(true);
    try {
      await classAPI.create(classForm);
      toast.success('Class created');
      setShowClass(false);
      setClassForm({ name: '', section: 'A', academic_year: '2025/2026', homeroom_teacher_id: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create class');
    } finally { setSaving(false); }
  }

  async function handleAddSubject(e) {
    e.preventDefault();
    if (!subjForm.name) return toast.error('Subject name required');
    setSaving(true);
    try {
      await classAPI.createSubject({ ...subjForm, class_id: selected.id });
      toast.success('Subject added');
      setShowSubj(false);
      setSubjForm({ name: '', code: '', teacher_id: '', periods_per_week: 5 });
      loadClassDetail(selected.id, 'subjects');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add subject');
    } finally { setSaving(false); }
  }

  async function deleteClass(cls) {
    if (!window.confirm(`Delete ${cls.name} ${cls.section}? This cannot be undone.`)) return;
    try {
      await classAPI.remove(cls.id);
      toast.success('Class deleted');
      if (selected?.id === cls.id) setSelected(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete class'); }
  }

  async function removeSubject(subjectId) {
    if (!window.confirm('Remove this subject?')) return;
    try {
      await classAPI.removeSubject(subjectId);
      toast.success('Subject removed');
      loadClassDetail(selected.id, 'subjects');
    } catch { toast.error('Failed to remove subject'); }
  }

  const classCols = [
    { key: 'name',             label: 'Class',    width: '100px' },
    { key: 'section',          label: 'Section',  width: '80px'  },
    { key: 'academic_year',    label: 'Year',     width: '110px' },
    { key: 'homeroom_teacher', label: 'Teacher',  width: '160px', render: v => v || '—' },
    { key: 'student_count',    label: 'Students', width: '90px',
      render: v => <Badge color="purple">{v ?? 0}</Badge> },
    { key: 'actions', label: '', width: '60px',
      render: (_, row) => (
        <button
          onClick={e => { e.stopPropagation(); deleteClass(row); }}
          className="text-xs text-red-400 hover:text-red-600 hover:underline">
          Delete
        </button>
      )},
  ];

  return (
    <div className="flex gap-5">

      {/* Left — class list */}
      <div className="flex-1 min-w-0">
        <PageHeader
          title="Classes"
          subtitle={`${classes.length} classes this year`}
          action={<Button variant="primary" onClick={() => setShowClass(true)}>+ Add class</Button>}
        />
        <Card>
          {loading
            ? <div className="flex justify-center py-16"><Spinner size="lg" /></div>
            : <Table
                columns={classCols}
                data={classes}
                onRowClick={openClass}
                emptyText="No classes yet — add one to get started"
              />
          }
        </Card>
      </div>

      {/* Right — class detail */}
      {selected && (
        <div className="w-80 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-700">
              {selected.name} {selected.section} · {selected.academic_year}
            </h2>
            <button onClick={() => setSelected(null)} className="text-xs text-gray-400 hover:text-gray-600">
              Close
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-3 border-b border-gray-100">
            {['subjects', 'students'].map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`px-3 py-1.5 text-xs rounded-t capitalize transition-colors
                  ${tab === t
                    ? 'bg-white border border-b-white border-gray-100 font-medium text-gray-800 -mb-px'
                    : 'text-gray-400 hover:text-gray-600'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'subjects' && (
            <Card
              action={
                <Button size="sm" onClick={() => setShowSubj(true)}>+ Add subject</Button>
              }
            >
              {subjects.length === 0
                ? <p className="text-xs text-gray-400 py-4 text-center">No subjects yet</p>
                : subjects.map(s => (
                    <div key={s.id} className="flex items-center justify-between py-2
                                                border-b border-gray-50 last:border-0 group">
                      <div>
                        <p className="text-sm text-gray-700">{s.name}
                          {s.code && <span className="text-xs text-gray-400 ml-1.5">({s.code})</span>}
                        </p>
                        <p className="text-xs text-gray-400">
                          {s.teacher_name || 'No teacher'} · {s.periods_per_week}×/wk
                        </p>
                      </div>
                      <button
                        onClick={() => removeSubject(s.id)}
                        className="text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Remove
                      </button>
                    </div>
                  ))
              }
            </Card>
          )}

          {tab === 'students' && (
            <Card>
              {students.length === 0
                ? <p className="text-xs text-gray-400 py-4 text-center">No students enrolled</p>
                : students.map(s => (
                    <div key={s.id} className="flex items-center gap-3 py-2
                                                border-b border-gray-50 last:border-0">
                      <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center
                                      justify-center text-xs font-medium flex-shrink-0">
                        {s.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm text-gray-700">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.student_number}</p>
                      </div>
                    </div>
                  ))
              }
            </Card>
          )}
        </div>
      )}

      {/* Add class modal */}
      {showClass && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-base font-medium text-gray-800 mb-5">Create class</h2>
            <form onSubmit={handleAddClass} className="flex flex-col gap-3">
              <Input label="Class name *"    value={classForm.name}          onChange={e => setClassForm(p => ({ ...p, name: e.target.value }))}          placeholder="JHS 1" />
              <Input label="Section"         value={classForm.section}       onChange={e => setClassForm(p => ({ ...p, section: e.target.value }))}       placeholder="A" />
              <Input label="Academic year *" value={classForm.academic_year} onChange={e => setClassForm(p => ({ ...p, academic_year: e.target.value }))} placeholder="2025/2026" />
              <Select label="Homeroom teacher" value={classForm.homeroom_teacher_id} onChange={e => setClassForm(p => ({ ...p, homeroom_teacher_id: e.target.value }))}>
                <option value="">None</option>
                {teachers.map(t => <option key={t.id} value={t.user_id || t.id}>{t.name}</option>)}
              </Select>
              <div className="flex justify-end gap-3 mt-2">
                <Button type="button" onClick={() => setShowClass(false)}>Cancel</Button>
                <Button type="submit" variant="primary" loading={saving}>Create</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add subject modal */}
      {showSubj && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-base font-medium text-gray-800 mb-1">Add subject</h2>
            <p className="text-xs text-gray-400 mb-5">{selected?.name} {selected?.section}</p>
            <form onSubmit={handleAddSubject} className="flex flex-col gap-3">
              <Input label="Subject name *" value={subjForm.name} onChange={e => setSubjForm(p => ({ ...p, name: e.target.value }))} placeholder="Mathematics" />
              <Input label="Code"           value={subjForm.code} onChange={e => setSubjForm(p => ({ ...p, code: e.target.value }))} placeholder="MATH101" />
              <Select label="Assign teacher" value={subjForm.teacher_id} onChange={e => setSubjForm(p => ({ ...p, teacher_id: e.target.value }))}>
                <option value="">No teacher yet</option>
                {teachers.map(t => <option key={t.id} value={t.user_id || t.id}>{t.name}</option>)}
              </Select>
              <Input label="Periods per week" type="number" min="1" max="10"
                value={subjForm.periods_per_week}
                onChange={e => setSubjForm(p => ({ ...p, periods_per_week: parseInt(e.target.value) }))} />
              <div className="flex justify-end gap-3 mt-2">
                <Button type="button" onClick={() => setShowSubj(false)}>Cancel</Button>
                <Button type="submit" variant="primary" loading={saving}>Add subject</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}