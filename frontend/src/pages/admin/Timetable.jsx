import React, { useEffect, useState, useCallback } from 'react';
import { timetableAPI, classAPI, teacherAPI } from '../../api';
import api from '../../api';
import { PageHeader, Card, Button, Select, Input, Badge, Spinner } from '../../components/ui';
import { useSelector } from 'react-redux';
import { selectRole } from '../../store/slices/authSlice';
import toast from 'react-hot-toast';

const DAYS    = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
const PERIODS = [1,2,3,4,5,6,7];

// New period times: 55-min lessons + 5-min refresh
// Short break: 09:00-09:30 | Lunch: 12:15-13:00
const PERIOD_LABELS = {
  1: '08:00–08:55',
  2: '09:30–10:25',
  3: '10:30–11:25',
  4: '11:30–12:15',
  5: '13:00–13:55',
  6: '14:00–14:55',
  7: '15:00–15:55',
};

const BREAK_AFTER = {
  1: { label: '— Short break  09:00–09:30 —', duration: '30 min' },
  4: { label: '— Lunch break  12:15–13:00 —', duration: '45 min' },
};

const DAY_COLORS = {
  Monday:    'bg-blue-50 border-blue-200 text-blue-800',
  Tuesday:   'bg-teal-50 border-teal-200 text-teal-800',
  Wednesday: 'bg-purple-50 border-purple-200 text-purple-800',
  Thursday:  'bg-amber-50 border-amber-200 text-amber-800',
  Friday:    'bg-rose-50 border-rose-200 text-rose-800',
};

const CURRENT_YEAR = (() => {
  const y = new Date().getFullYear();
  return new Date().getMonth() >= 8 ? `${y}/${y+1}` : `${y-1}/${y}`;
})();

// Load settings from localStorage
function loadSettings() {
  try { return JSON.parse(localStorage.getItem('educlass_tt_settings') || '{}'); }
  catch { return {}; }
}
function saveSettings(s) {
  try { localStorage.setItem('educlass_tt_settings', JSON.stringify(s)); } catch {}
}

export default function Timetable() {
  const role    = useSelector(selectRole);
  const canEdit = role === 'admin' || role === 'headmaster';

  const [classes,    setClasses]    = useState([]);
  const [teachers,   setTeachers]   = useState([]);
  const [subjects,   setSubjects]   = useState([]);
  const [entries,    setEntries]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [generating, setGenerating] = useState(false);
  const [approving,  setApproving]  = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [genResult,  setGenResult]  = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // Settings (persisted in localStorage)
  const [settings, setSettings] = useState(loadSettings);

  function updateSetting(key, val) {
    const next = { ...settings, [key]: val };
    setSettings(next);
    saveSettings(next);
  }

  // Pinned subjects (PE on Friday, etc.)
  const pinned = settings.pinned || [];
  const [pinForm, setPinForm] = useState({ subject_id: '', day: 'Friday', period: 6 });

  function addPin() {
    if (!pinForm.subject_id) return toast.error('Select a subject to pin');
    const subj = subjects.find(s => String(s.id) === String(pinForm.subject_id));
    if (!subj) return;
    const exists = pinned.find(p => p.subject_id === parseInt(pinForm.subject_id));
    if (exists) return toast.error('This subject is already pinned');
    const next = [...pinned, {
      subject_id: parseInt(pinForm.subject_id),
      subject_name: subj.name,
      day: pinForm.day,
      period: parseInt(pinForm.period),
    }];
    updateSetting('pinned', next);
    toast.success(`${subj.name} pinned to ${pinForm.day} P${pinForm.period}`);
  }

  function removePin(idx) {
    const next = pinned.filter((_, i) => i !== idx);
    updateSetting('pinned', next);
  }

  const [filters, setFilters] = useState({
    class_id: '', term: 'Term 1', academic_year: CURRENT_YEAR,
  });
  const [form, setForm] = useState({
    class_id: '', subject_id: '', teacher_id: '',
    day_of_week: 'Monday', period_number: 1,
    start_time: '08:00', end_time: '08:55',
    term: 'Term 1', academic_year: CURRENT_YEAR,
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
        class_id: filters.class_id,
        term: filters.term,
        academic_year: filters.academic_year,
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

  const isApproved   = entries.length > 0 && entries.every(e => e.is_approved);
  const hasGenerated = entries.some(e => e.is_generated);
  const selectedClass = classes.find(c => c.id === parseInt(filters.class_id));

  // Build generate payload including settings
  function buildGeneratePayload() {
    return {
      class_id:         parseInt(filters.class_id),
      term:             filters.term,
      academic_year:    filters.academic_year,
      worship_wednesday: settings.worship_wednesday || 'none',
      free_period:       settings.free_period !== false,
      pinned:            (settings.pinned || []).map(p => ({
        subject_id: p.subject_id,
        day:        p.day,
        period:     p.period,
      })),
    };
  }

  async function handleGenerate() {
    if (!filters.class_id) return toast.error('Select a class first');
    if (!window.confirm('Generate timetable? Existing generated entries will be replaced.')) return;
    setGenerating(true); setGenResult(null);
    try {
      const { data } = await timetableAPI.generate(buildGeneratePayload());
      setGenResult(data.data);
      toast.success(data.message || 'Timetable generated');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to generate'); }
    finally { setGenerating(false); }
  }

  async function handleRegenerate() {
    if (!window.confirm('Regenerate timetable with current settings?')) return;
    setGenerating(true); setGenResult(null);
    try {
      const { data } = await timetableAPI.regenerate(buildGeneratePayload());
      setGenResult(data.data);
      toast.success('Timetable regenerated');
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
        term: filters.term,
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
    const pt = { start: '08:00', end: '08:55' };
    setForm({
      class_id:      filters.class_id,
      subject_id:    '',
      teacher_id:    '',
      day_of_week:   day,
      period_number: period,
      start_time:    pt.start,
      end_time:      pt.end,
      term:          filters.term,
      academic_year: filters.academic_year,
    });
    setShowForm(true);
  }

  function downloadCSV() {
    const rows = [['Period','Monday','Tuesday','Wednesday','Thursday','Friday']];
    PERIODS.forEach(p => {
      const row = [`P${p} (${PERIOD_LABELS[p]})`];
      DAYS.forEach(d => {
        const e = grid[d]?.[p];
        row.push(e ? (e.is_free ? 'FREE PERIOD' : `${e.subject_name} (${e.teacher_name || ''})`) : '');
      });
      rows.push(row);
    });
    const csv  = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
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
        subtitle="Weekly class schedule — 55-min periods, GES/NaCCA curriculum"
      />

      {/* Filters + Actions */}
      <div className="flex gap-3 mb-3 flex-wrap items-end">
        <Select value={filters.class_id}
          onChange={e => setFilters(p => ({ ...p, class_id: e.target.value }))} className="w-44">
          <option value="">Select class…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </Select>
        <Select value={filters.term}
          onChange={e => setFilters(p => ({ ...p, term: e.target.value }))} className="w-28">
          {['Term 1','Term 2','Term 3'].map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input value={filters.academic_year}
          onChange={e => setFilters(p => ({ ...p, academic_year: e.target.value }))}
          className="w-28" placeholder="2025/2026" />

        {canEdit && (
          <button
            onClick={() => setShowSettings(s => !s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
              ${showSettings
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}>
            ⚙ Settings
          </button>
        )}

        {canEdit && filters.class_id && (
          <div className="flex gap-2 ml-auto flex-wrap">
            {entries.length === 0 && (
              <Button variant="primary" loading={generating} onClick={handleGenerate}>
                ⚡ Auto-generate
              </Button>
            )}
            {hasGenerated && !isApproved && (
              <>
                <Button loading={generating} onClick={handleRegenerate}>🔄 Regenerate</Button>
                <Button variant="primary" loading={approving} onClick={handleApprove}>
                  ✓ Approve
                </Button>
              </>
            )}
            {isApproved && (
              <Button loading={generating} onClick={handleRegenerate}>🔄 New arrangement</Button>
            )}
            {entries.length > 0 && <Button onClick={downloadCSV}>↓ CSV</Button>}
            <Button onClick={() => openAddForSlot('Monday', 1)}>+ Add manually</Button>
          </div>
        )}
      </div>

      {/* ── Settings Panel ──────────────────────────────────────── */}
      {showSettings && canEdit && (
        <div className="mb-5 bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">⚙ Generator Settings</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Wednesday Worship */}
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-2">
                Wednesday Worship (7:00–9:00)
              </label>
              <Select
                value={settings.worship_wednesday || 'none'}
                onChange={e => updateSetting('worship_wednesday', e.target.value)}
                className="w-full">
                <option value="none">Off — no worship</option>
                <option value="all">All classes</option>
                <option value="primary">Primary &amp; below only</option>
                <option value="jhs">JHS 1–3 only</option>
              </Select>
              <p className="text-xs text-slate-400 mt-1">
                When on, Wednesday P1 (08:00–08:55) is blocked for affected classes.
                Teaching starts at P2 (09:30).
              </p>
            </div>

            {/* Free Period */}
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-2">
                Free Period (1 per class per week)
              </label>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={settings.free_period !== false}
                  onChange={e => updateSetting('free_period', e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded"
                />
                <span className="text-sm text-slate-700">Reserve one free slot</span>
              </label>
              <p className="text-xs text-slate-400 mt-2">
                One empty non-P1 slot per week will be labelled "Free Period" in the timetable.
              </p>
            </div>

            {/* Pin subject to day/period */}
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-2">
                Pin subject to specific slot (e.g. PE on Friday)
              </label>
              <div className="flex gap-1.5 flex-wrap mb-2">
                <Select
                  value={pinForm.subject_id}
                  onChange={e => setPinForm(p => ({ ...p, subject_id: e.target.value }))}
                  className="flex-1 min-w-[120px]">
                  <option value="">Subject…</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
                <Select
                  value={pinForm.day}
                  onChange={e => setPinForm(p => ({ ...p, day: e.target.value }))}
                  className="w-28">
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </Select>
                <Select
                  value={pinForm.period}
                  onChange={e => setPinForm(p => ({ ...p, period: parseInt(e.target.value) }))}
                  className="w-20">
                  {PERIODS.map(p => <option key={p} value={p}>P{p}</option>)}
                </Select>
                <button
                  onClick={addPin}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">
                  Pin
                </button>
              </div>

              {/* Pinned list */}
              {pinned.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {pinned.map((p, i) => (
                    <div key={i} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                      <span className="text-xs text-slate-700">
                        <span className="font-medium">{p.subject_name}</span>
                        <span className="text-slate-400 ml-1">→ {p.day} P{p.period}</span>
                      </span>
                      <button onClick={() => removePin(i)}
                        className="text-red-400 hover:text-red-600 text-xs ml-2">✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No pinned subjects yet.</p>
              )}
            </div>
          </div>

          {/* Period reference card */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-2">Period reference</p>
            <div className="flex flex-wrap gap-2">
              {PERIODS.map(p => (
                <span key={p} className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1">
                  <span className="font-semibold text-blue-600">P{p}</span>
                  <span className="text-slate-400 ml-1">{PERIOD_LABELS[p]}</span>
                </span>
              ))}
              <span className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 text-amber-700">
                Short break 09:00–09:30
              </span>
              <span className="text-xs bg-green-50 border border-green-200 rounded-lg px-2.5 py-1 text-green-700">
                Lunch 12:15–13:00
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Generation result banner */}
      {genResult && (
        <div className={`rounded-xl p-4 mb-5 border ${genResult.unassigned > 0
          ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <p className={`text-sm font-medium ${genResult.unassigned > 0 ? 'text-amber-700' : 'text-green-700'}`}>
            {genResult.message}
          </p>
          {genResult.worship_applied && (
            <p className="text-xs text-purple-600 mt-1">🙏 {genResult.worship_applied}</p>
          )}
          {genResult.unassigned > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              Tip: Assign teachers to all subjects, then regenerate.
            </p>
          )}
        </div>
      )}

      {!filters.class_id ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center">
          <p className="text-3xl mb-3">📅</p>
          <p className="text-gray-500 text-sm font-medium mb-2">Select a class to view its timetable</p>
          <p className="text-gray-400 text-xs">
            Make sure subjects are added and teachers assigned, then configure Settings before generating
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
              <span className="text-blue-500 text-xs">
                {entries.filter(e => !e.is_free).length} periods
              </span>
            </div>
            {isApproved && (
              <span className="bg-green-100 text-green-700 border border-green-200 text-xs font-medium px-3 py-2 rounded-xl">
                ✓ Approved &amp; locked
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
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 w-32">Period</th>
                    {DAYS.map(d => (
                      <th key={d} className="px-3 py-3 text-left text-xs font-semibold text-gray-600">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map(period => (
                    <React.Fragment key={period}>
                      {/* Teaching period row */}
                      <tr className="border-b border-gray-50 last:border-0">
                        <td className="px-3 py-2 text-xs text-gray-400">
                          <div className="font-semibold text-gray-600">P{period}</div>
                          <div className="text-gray-300 text-xs">{PERIOD_LABELS[period]}</div>
                        </td>
                        {DAYS.map(day => {
                          const entry = grid[day]?.[period];
                          return (
                            <td key={day} className="px-2 py-2 align-top">
                              {entry ? (
                                entry.is_free ? (
                                  <div className="rounded-lg px-2.5 py-2 text-xs border bg-gray-50 border-gray-200 border-dashed text-center">
                                    <p className="text-gray-400 font-medium">Free Period</p>
                                  </div>
                                ) : (
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
                                )
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
                        })}
                      </tr>
                      {/* Break row after P1 and P4 */}
                      {BREAK_AFTER[period] && (
                        <tr className="bg-gray-50">
                          <td className="px-3 py-1 text-xs text-gray-300 italic">
                            {BREAK_AFTER[period].duration}
                          </td>
                          <td colSpan={5} className="px-3 py-1 text-center text-xs text-gray-300 italic">
                            {BREAK_AFTER[period].label}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {entries.length === 0 && (
            <div className="text-center mt-8 p-8 bg-white border border-dashed border-gray-200 rounded-2xl">
              <p className="text-2xl mb-3">⚡</p>
              <p className="text-gray-600 text-sm font-medium mb-1">No timetable yet</p>
              <p className="text-gray-400 text-xs mb-4">
                Configure settings above, then click Auto-generate
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
                  setForm(p => ({ ...p, class_id: e.target.value }));
                  if (e.target.value)
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
                  onChange={e => {
                    const p = parseInt(e.target.value);
                    const labels = {1:'08:00',2:'09:30',3:'10:30',4:'11:30',5:'13:00',6:'14:00',7:'15:00'};
                    const ends   = {1:'08:55',2:'10:25',3:'11:25',4:'12:15',5:'13:55',6:'14:55',7:'15:55'};
                    setForm(prev => ({ ...prev, period_number: p, start_time: labels[p]||'08:00', end_time: ends[p]||'08:55' }));
                  }}>
                  {PERIODS.map(p => <option key={p} value={p}>P{p} ({PERIOD_LABELS[p]})</option>)}
                </Select>
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