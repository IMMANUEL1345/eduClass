import React, { useEffect, useState, useCallback } from 'react';
import { timetableAPI, classAPI, teacherAPI } from '../../api';
import api from '../../api';
import { PageHeader, Card, Button, Select, Input, Badge, Spinner } from '../../components/ui';
import { useSelector } from 'react-redux';
import { selectRole } from '../../store/slices/authSlice';
import toast from 'react-hot-toast';

const DAYS    = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
const PERIODS = [1,2,3,4,5,6,7,8];
const TIMES   = ['07:30','08:15','09:00','09:45','10:30','11:15','12:00','13:00'];
const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear()+1}`;

const DAY_COLOR = { Monday:'blue', Tuesday:'teal', Wednesday:'purple', Thursday:'amber', Friday:'rose' };

export default function Timetable() {
  const role      = useSelector(selectRole);
  const canEdit   = role === 'admin' || role === 'headmaster';

  const [classes,   setClasses]   = useState([]);
  const [teachers,  setTeachers]  = useState([]);
  const [subjects,  setSubjects]  = useState([]);
  const [entries,   setEntries]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);

  const [filters, setFilters] = useState({
    class_id: '', term: 'Term 1', academic_year: CURRENT_YEAR,
  });

  const [form, setForm] = useState({
    class_id:'', subject_id:'', teacher_id:'',
    day_of_week:'Monday', period_number:1,
    start_time:'07:30', end_time:'08:15',
    term:'Term 1', academic_year: CURRENT_YEAR,
  });

  useEffect(() => {
    classAPI.list({}).then(({ data }) => setClasses(data.data)).catch(() => {});
    teacherAPI.list({}).then(({ data }) => setTeachers(data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!filters.class_id) return;
    api.get(`/classes/${filters.class_id}/subjects`)
      .then(({ data }) => setSubjects(data.data))
      .catch(() => {});
  }, [filters.class_id]);

  const load = useCallback(async () => {
    if (!filters.class_id) return;
    setLoading(true);
    try {
      const { data } = await timetableAPI.getClass({
        class_id:      filters.class_id,
        term:          filters.term,
        academic_year: filters.academic_year,
      });
      setEntries(data.data);
    } catch { toast.error('Failed to load timetable'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.class_id || !form.subject_id || !form.teacher_id)
      return toast.error('Class, subject and teacher are required');
    setSaving(true);
    try {
      await timetableAPI.addEntry(form);
      toast.success('Entry added');
      setShowForm(false);
      resetForm();
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add entry'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this timetable entry?')) return;
    try {
      await timetableAPI.removeEntry(id);
      toast.success('Entry removed');
      load();
    } catch { toast.error('Failed to remove entry'); }
  }

  function resetForm() {
    setForm({
      class_id: filters.class_id, subject_id:'', teacher_id:'',
      day_of_week:'Monday', period_number:1,
      start_time:'07:30', end_time:'08:15',
      term: filters.term, academic_year: filters.academic_year,
    });
  }

  function openAdd() {
    resetForm();
    setShowForm(true);
  }

  // Build grid: day → period → entry
  const grid = {};
  DAYS.forEach(d => { grid[d] = {}; });
  entries.forEach(e => {
    if (!grid[e.day_of_week]) grid[e.day_of_week] = {};
    grid[e.day_of_week][e.period_number] = e;
  });

  const selectedClass = classes.find(c => c.id === parseInt(filters.class_id));

  return (
    <div>
      <PageHeader
        title="Timetable"
        subtitle="Weekly class schedule"
        action={
          canEdit && filters.class_id && (
            <Button variant="primary" onClick={openAdd}>+ Add entry</Button>
          )
        }
      />

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <Select value={filters.class_id}
          onChange={e => setFilters(p => ({ ...p, class_id: e.target.value }))}
          className="w-44">
          <option value="">Select class…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </Select>
        <Select value={filters.term}
          onChange={e => setFilters(p => ({ ...p, term: e.target.value }))}
          className="w-28">
          {['Term 1','Term 2','Term 3'].map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input value={filters.academic_year}
          onChange={e => setFilters(p => ({ ...p, academic_year: e.target.value }))}
          className="w-28" placeholder="2025/2026" />
      </div>

      {!filters.class_id ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center">
          <p className="text-2xl mb-3">📅</p>
          <p className="text-gray-500 text-sm">Select a class to view its timetable</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* Class header */}
          {selectedClass && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
              <span className="text-blue-600 font-semibold text-sm">
                {selectedClass.name} {selectedClass.section}
              </span>
              <span className="text-blue-400 text-xs">·</span>
              <span className="text-blue-500 text-xs">{filters.term} · {filters.academic_year}</span>
              <span className="text-blue-400 text-xs ml-auto">{entries.length} periods scheduled</span>
            </div>
          )}

          {/* Timetable grid */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 w-20">Period</th>
                    {DAYS.map(d => (
                      <th key={d} className="px-3 py-3 text-left text-xs font-medium text-gray-500">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map((period, idx) => (
                    <tr key={period} className="border-b border-gray-50 last:border-0">
                      <td className="px-3 py-2 text-xs text-gray-400 font-medium">
                        <div>{period}</div>
                        <div className="text-gray-300">{TIMES[idx]}</div>
                      </td>
                      {DAYS.map(day => {
                        const entry = grid[day]?.[period];
                        return (
                          <td key={day} className="px-2 py-2 align-top">
                            {entry ? (
                              <div className={`rounded-lg px-2.5 py-2 text-xs group relative
                                ${day === 'Monday'    ? 'bg-blue-50 border border-blue-100' :
                                  day === 'Tuesday'   ? 'bg-teal-50 border border-teal-100' :
                                  day === 'Wednesday' ? 'bg-purple-50 border border-purple-100' :
                                  day === 'Thursday'  ? 'bg-amber-50 border border-amber-100' :
                                  'bg-rose-50 border border-rose-100'}`}>
                                <p className="font-medium text-gray-700 truncate">{entry.subject_name}</p>
                                <p className="text-gray-400 truncate">{entry.teacher_name}</p>
                                {entry.start_time && (
                                  <p className="text-gray-300 text-xs">
                                    {entry.start_time?.slice(0,5)}–{entry.end_time?.slice(0,5)}
                                  </p>
                                )}
                                {canEdit && (
                                  <button
                                    onClick={() => handleDelete(entry.id)}
                                    className="absolute top-1 right-1 w-4 h-4 bg-red-400 text-white rounded-full
                                               text-xs items-center justify-center hidden group-hover:flex">
                                    ×
                                  </button>
                                )}
                              </div>
                            ) : (
                              canEdit ? (
                                <button
                                  onClick={() => {
                                    setForm(p => ({
                                      ...p,
                                      class_id:      filters.class_id,
                                      day_of_week:   day,
                                      period_number: period,
                                      start_time:    TIMES[idx] || '07:30',
                                      end_time:      TIMES[idx+1] || '08:15',
                                      term:          filters.term,
                                      academic_year: filters.academic_year,
                                    }));
                                    setShowForm(true);
                                  }}
                                  className="w-full h-10 border border-dashed border-gray-200 rounded-lg
                                             text-gray-200 hover:border-blue-300 hover:text-blue-300
                                             text-lg transition-colors flex items-center justify-center">
                                  +
                                </button>
                              ) : (
                                <div className="w-full h-10 rounded-lg bg-gray-50" />
                              )
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {entries.length === 0 && (
            <p className="text-center text-sm text-gray-400 mt-6">
              No entries yet — click any + cell or use the button above to add periods
            </p>
          )}
        </>
      )}

      {/* Add entry modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-base font-medium text-gray-800 mb-5">Add timetable entry</h2>
            <form onSubmit={handleAdd} className="flex flex-col gap-3">
              <Select label="Class *" value={form.class_id}
                onChange={e => {
                  setForm(p => ({ ...p, class_id: e.target.value }));
                  api.get(`/classes/${e.target.value}/subjects`)
                    .then(({ data }) => setSubjects(data.data)).catch(() => {});
                }}>
                <option value="">Select class…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
              </Select>
              <Select label="Subject *" value={form.subject_id}
                onChange={e => setForm(p => ({ ...p, subject_id: e.target.value }))}>
                <option value="">Select subject…</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Select label="Teacher *" value={form.teacher_id}
                onChange={e => setForm(p => ({ ...p, teacher_id: e.target.value }))}>
                <option value="">Select teacher…</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Day *" value={form.day_of_week}
                  onChange={e => setForm(p => ({ ...p, day_of_week: e.target.value }))}>
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </Select>
                <Select label="Period *" value={form.period_number}
                  onChange={e => setForm(p => ({ ...p, period_number: parseInt(e.target.value) }))}>
                  {PERIODS.map(p => <option key={p} value={p}>Period {p}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Start time" type="time" value={form.start_time}
                  onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} />
                <Input label="End time" type="time" value={form.end_time}
                  onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Term *" value={form.term}
                  onChange={e => setForm(p => ({ ...p, term: e.target.value }))}>
                  {['Term 1','Term 2','Term 3'].map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
                <Input label="Year" value={form.academic_year}
                  onChange={e => setForm(p => ({ ...p, academic_year: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-3 mt-2">
                <Button type="button" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" variant="primary" loading={saving}>Add entry</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}