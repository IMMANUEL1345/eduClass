import React, { useEffect, useState, useCallback } from 'react';
import { timetableAPI, classAPI, teacherAPI } from '../../api';
import api from '../../api';
import { PageHeader, Card, Button, Select, Input, Badge, Spinner, StatCard } from '../../components/ui';
import { useSelector } from 'react-redux';
import { selectRole } from '../../store/slices/authSlice';
import toast from 'react-hot-toast';

const DAYS    = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
const PERIODS = [1,2,3,4,5,6,7,8];
const BREAK_PERIODS = [4, 8]; // break and lunch
const PERIOD_TIMES = [
  '07:30–08:15', '08:15–09:00', '09:00–09:45',
  '09:45–10:15 (Break)',
  '10:15–11:00', '11:00–11:45', '11:45–12:30',
  '12:30–13:30 (Lunch)',
];
const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear()+1}`;

const DAY_COLORS = {
  Monday:    'bg-blue-50 border-blue-200 text-blue-800',
  Tuesday:   'bg-teal-50 border-teal-200 text-teal-800',
  Wednesday: 'bg-purple-50 border-purple-200 text-purple-800',
  Thursday:  'bg-amber-50 border-amber-200 text-amber-800',
  Friday:    'bg-rose-50 border-rose-200 text-rose-800',
};

export default function Timetable() {
  const role     = useSelector(selectRole);
  const canEdit  = role === 'admin' || role === 'headmaster';

  const [classes,   setClasses]   = useState([]);
  const [teachers,  setTeachers]  = useState([]);
  const [subjects,  setSubjects]  = useState([]);
  const [entries,   setEntries]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [generating,setGenerating]= useState(false);
  const [approving, setApproving] = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [genResult, setGenResult] = useState(null);

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
      .then(({ data }) => setSubjects(data.data)).catch(() => {});
  }, [filters.class_id]);

  const load = useCallback(async () => {
    if (!filters.class_id) return;
    setLoading(true);
    try {
      const { data } = await timetableAPI.getClass({
        class_id: filters.class_id, term: filters.term, academic_year: filters.academic_year,
      });
      setEntries(data.data);
    } catch { toast.error('Failed to load timetable'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  // Build grid
  const grid = {};
  DAYS.forEach(d => { grid[d] = {}; });
  entries.forEach(e => {
    if (!grid[e.day_of_week]) grid[e.day_of_week] = {};
    grid[e.day_of_week][e.period_number] = e;
  });

  const isApproved  = entries.length > 0 && entries.every(e => e.is_approved);
  const hasGenerated = entries.some(e => e.is_generated);
  const selectedClass = classes.find(c => c.id === parseInt(filters.class_id));

  async function handleGenerate() {
    if (!filters.class_id) return toast.error('Select a class first');
    if (!window.confirm('Generate timetable for this class? Existing generated entries will be replaced.')) return;
    setGenerating(true); setGenResult(null);
    try {
      const { data } = await timetableAPI.generate({
        class_id: parseInt(filters.class_id),
        term:     filters.term,
        academic_year: filters.academic_year,
      });
      setGenResult(data.data);
      toast.success(data.message || 'Timetable generated');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to generate'); }
    finally { setGenerating(false); }
  }

  async function handleRegenerate() {
    if (!window.confirm('Regenerate? This will create a different arrangement.')) return;
    setGenerating(true); setGenResult(null);
    try {
      const { data } = await timetableAPI.regenerate({
        class_id: parseInt(filters.class_id),
        term:     filters.term,
        academic_year: filters.academic_year,
      });
      setGenResult(data.data);
      toast.success('Timetable regenerated with new arrangement');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to regenerate'); }
    finally { setGenerating(false); }
  }

  async function handleApprove() {
    if (!window.confirm('Approve this timetable? It will be locked for this term.')) return;
    setApproving(true);
    try {
      await timetableAPI.approve({
        class_id: parseInt(filters.class_id),
        term:     filters.term,
        academic_year: filters.academic_year,
      });
      toast.success('Timetable approved and locked');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to approve'); }
    finally { setApproving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this entry?')) return;
    try {
      await timetableAPI.removeEntry(id);
      toast.success('Entry removed');
      load();
    } catch { toast.error('Failed to remove'); }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.class_id || !form.subject_id || !form.teacher_id)
      return toast.error('Class, subject and teacher required');
    setSaving(true);
    try {
      await timetableAPI.addEntry(form);
      toast.success('Entry added');
      setShowForm(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add entry'); }
    finally { setSaving(false); }
  }

  function openAddForSlot(day, period) {
    setForm({
      class_id:      filters.class_id,
      subject_id:    '',
      teacher_id:    '',
      day_of_week:   day,
      period_number: period,
      start_time:    '07:30',
      end_time:      '08:15',
      term:          filters.term,
      academic_year: filters.academic_year,
    });
    setShowForm(true);
  }

  function downloadCSV() {
    const rows = [['Period','Monday','Tuesday','Wednesday','Thursday','Friday']];
    PERIODS.forEach(period => {
      if (BREAK_PERIODS.includes(period)) return;
      const row = [`Period ${period}`];
      DAYS.forEach(day => {
        const e = grid[day]?.[period];
        row.push(e ? `${e.subject_name} (${e.teacher_name})` : '');
      });
      rows.push(row);
    });
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `timetable_${selectedClass?.name}_${filters.term}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Timetable"
        subtitle="Weekly class schedule — GES/NaCCA curriculum"
      />

      {/* Filters + Actions */}
      <div className="flex gap-3 mb-5 flex-wrap items-end">
        <Select value={filters.class_id}
          onChange={e => setFilters(p=>({...p, class_id:e.target.value}))} className="w-44">
          <option value="">Select class…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </Select>
        <Select value={filters.term}
          onChange={e => setFilters(p=>({...p, term:e.target.value}))} className="w-28">
          {['Term 1','Term 2','Term 3'].map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input value={filters.academic_year}
          onChange={e => setFilters(p=>({...p, academic_year:e.target.value}))}
          className="w-28" placeholder="2025/2026" />

        {canEdit && filters.class_id && (
          <div className="flex gap-2 ml-auto flex-wrap">
            {entries.length === 0 && (
              <Button variant="primary" loading={generating} onClick={handleGenerate}>
                ⚡ Auto-generate
              </Button>
            )}
            {hasGenerated && !isApproved && (
              <>
                <Button loading={generating} onClick={handleRegenerate}>
                  🔄 Regenerate
                </Button>
                <Button variant="primary" loading={approving} onClick={handleApprove}>
                  ✓ Approve timetable
                </Button>
              </>
            )}
            {isApproved && (
              <Button loading={generating} onClick={handleRegenerate}>
                🔄 New arrangement
              </Button>
            )}
            {entries.length > 0 && (
              <Button onClick={downloadCSV}>↓ Export CSV</Button>
            )}
            <Button onClick={() => openAddForSlot('Monday', 1)}>+ Add manually</Button>
          </div>
        )}
      </div>

      {/* Generation result banner */}
      {genResult && (
        <div className={`rounded-xl p-4 mb-5 border ${genResult.unassigned > 0
          ? 'bg-amber-50 border-amber-200'
          : 'bg-green-50 border-green-200'}`}>
          <p className={`text-sm font-medium ${genResult.unassigned > 0 ? 'text-amber-700' : 'text-green-700'}`}>
            {genResult.message}
          </p>
          {genResult.unassigned > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              Tip: Assign more teachers to subjects or check for teacher conflicts across classes.
            </p>
          )}
        </div>
      )}

      {!filters.class_id ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center">
          <p className="text-3xl mb-3">📅</p>
          <p className="text-gray-500 text-sm font-medium mb-2">Select a class to view its timetable</p>
          <p className="text-gray-400 text-xs">
            Make sure subjects are added to the class and teachers are assigned to subjects first
          </p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* Class info + status */}
          <div className="flex items-center gap-4 mb-5">
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 flex items-center gap-3 flex-1">
              <span className="text-blue-700 font-semibold text-sm">
                {selectedClass?.name} {selectedClass?.section}
              </span>
              <span className="text-blue-300">·</span>
              <span className="text-blue-500 text-xs">{filters.term} · {filters.academic_year}</span>
              <span className="text-blue-300 ml-auto">·</span>
              <span className="text-blue-500 text-xs">{entries.length} periods</span>
            </div>
            {isApproved && (
              <span className="bg-green-100 text-green-700 border border-green-200 text-xs font-medium px-3 py-2 rounded-xl">
                ✓ Approved & locked
              </span>
            )}
            {hasGenerated && !isApproved && (
              <span className="bg-amber-100 text-amber-700 border border-amber-200 text-xs font-medium px-3 py-2 rounded-xl">
                ⚡ Auto-generated — pending approval
              </span>
            )}
          </div>

          {/* Timetable grid */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 w-24">Period</th>
                    {DAYS.map(d => (
                      <th key={d} className="px-3 py-3 text-left text-xs font-semibold text-gray-600">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map((period, idx) => {
                    const isBreak = BREAK_PERIODS.includes(period);
                    return (
                      <tr key={period} className={`border-b border-gray-50 last:border-0 ${isBreak ? 'bg-gray-50' : ''}`}>
                        <td className="px-3 py-2 text-xs text-gray-400">
                          <div className="font-medium">{isBreak ? '' : `P${period}`}</div>
                          <div className="text-gray-300 text-xs">{PERIOD_TIMES[idx]}</div>
                        </td>
                        {isBreak ? (
                          <td colSpan={5} className="px-3 py-2 text-center text-xs text-gray-300 italic">
                            {period === 4 ? '— Break —' : '— Lunch Break —'}
                          </td>
                        ) : (
                          DAYS.map(day => {
                            const entry = grid[day]?.[period];
                            return (
                              <td key={day} className="px-2 py-2 align-top">
                                {entry ? (
                                  <div className={`rounded-lg px-2.5 py-2 text-xs border group relative ${DAY_COLORS[day]}`}>
                                    <p className="font-semibold truncate">{entry.subject_name}</p>
                                    <p className="opacity-70 truncate text-xs">{entry.teacher_name}</p>
                                    {entry.is_approved && <span className="text-xs opacity-50">✓</span>}
                                    {canEdit && !entry.is_approved && (
                                      <button
                                        onClick={() => handleDelete(entry.id)}
                                        className="absolute top-1 right-1 w-4 h-4 bg-red-400 text-white
                                                   rounded-full text-xs hidden group-hover:flex
                                                   items-center justify-center">
                                        ×
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  canEdit && !isApproved ? (
                                    <button
                                      onClick={() => openAddForSlot(day, period)}
                                      className="w-full h-12 border border-dashed border-gray-200
                                                 rounded-lg text-gray-200 hover:border-blue-300
                                                 hover:text-blue-300 text-lg transition-colors
                                                 flex items-center justify-center">
                                      +
                                    </button>
                                  ) : (
                                    <div className="w-full h-12 rounded-lg bg-gray-50" />
                                  )
                                )}
                              </td>
                            );
                          })
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {entries.length === 0 && (
            <div className="text-center mt-8 p-8 bg-white border border-dashed border-gray-200 rounded-2xl">
              <p className="text-2xl mb-3">⚡</p>
              <p className="text-gray-600 text-sm font-medium mb-1">No timetable yet</p>
              <p className="text-gray-400 text-xs mb-4">
                Make sure each subject has an assigned teacher, then click Auto-generate
              </p>
              {canEdit && (
                <Button variant="primary" loading={generating} onClick={handleGenerate}>
                  ⚡ Auto-generate timetable
                </Button>
              )}
            </div>
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
                  setForm(p=>({...p, class_id:e.target.value}));
                  if (e.target.value) {
                    api.get(`/classes/${e.target.value}/subjects`)
                      .then(({ data }) => setSubjects(data.data)).catch(() => {});
                  }
                }}>
                <option value="">Select class…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
              </Select>
              <Select label="Subject *" value={form.subject_id}
                onChange={e => setForm(p=>({...p, subject_id:e.target.value}))}>
                <option value="">Select subject…</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Select label="Teacher *" value={form.teacher_id}
                onChange={e => setForm(p=>({...p, teacher_id:e.target.value}))}>
                <option value="">Select teacher…</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Day *" value={form.day_of_week}
                  onChange={e => setForm(p=>({...p, day_of_week:e.target.value}))}>
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </Select>
                <Select label="Period *" value={form.period_number}
                  onChange={e => setForm(p=>({...p, period_number:parseInt(e.target.value)}))}>
                  {PERIODS.filter(p => !BREAK_PERIODS.includes(p)).map(p =>
                    <option key={p} value={p}>Period {p}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Start time" type="time" value={form.start_time}
                  onChange={e => setForm(p=>({...p, start_time:e.target.value}))} />
                <Input label="End time" type="time" value={form.end_time}
                  onChange={e => setForm(p=>({...p, end_time:e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Term *" value={form.term}
                  onChange={e => setForm(p=>({...p, term:e.target.value}))}>
                  {['Term 1','Term 2','Term 3'].map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
                <Input label="Year" value={form.academic_year}
                  onChange={e => setForm(p=>({...p, academic_year:e.target.value}))} />
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