import React, { useEffect, useState, useCallback } from 'react';
import { classAPI, gradeAPI } from '../../api';
import { PageHeader, Card, Button, Select, Input, Badge, Spinner } from '../../components/ui';
import { toLetterGrade } from '../../utils/grades';
import toast from 'react-hot-toast';

const TERMS        = ['Term 1', 'Term 2', 'Term 3'];
const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
const DEFAULT_WEIGHTS = {
  classwork_weight: 10, homework_weight: 10,
  midterm_weight: 20, project_weight: 0, exam_weight: 60,
};
const COMPONENTS = [
  { key: 'classwork', label: 'Classwork', weightKey: 'classwork_weight', color: 'text-blue-600',   multi: true  },
  { key: 'homework',  label: 'Homework',  weightKey: 'homework_weight',  color: 'text-teal-600',   multi: true  },
  { key: 'midterm',   label: 'Midterm',   weightKey: 'midterm_weight',   color: 'text-purple-600', multi: false },
  { key: 'project',   label: 'Project',   weightKey: 'project_weight',   color: 'text-orange-600', multi: false },
  { key: 'exam',      label: 'Exam',      weightKey: 'exam_weight',      color: 'text-red-600',    multi: false },
];

function gradeColor(g) {
  if (!g) return 'gray';
  if (g === 'A') return 'green';
  if (g.startsWith('B')) return 'blue';
  if (g.startsWith('C')) return 'amber';
  return 'red';
}

function calcFinal(scores, weights) {
  const active = COMPONENTS.filter(c => parseFloat(weights[c.weightKey] || 0) > 0);
  const allFilled = active.every(c => scores[c.key] !== '' && scores[c.key] !== null && scores[c.key] !== undefined);
  if (!allFilled) return null;
  return Math.round(active.reduce((s, c) =>
    s + parseFloat(scores[c.key]) * parseFloat(weights[c.weightKey]) / 100, 0) * 10) / 10;
}

// ── Weights Modal ─────────────────────────────────────────
function WeightsModal({ weights, onSave, onClose }) {
  const [w, setW] = useState({ ...weights });
  const [saving, setSaving] = useState(false);
  const total = COMPONENTS.reduce((s, c) => s + parseFloat(w[c.weightKey] || 0), 0);
  const valid = Math.abs(total - 100) < 0.1;

  async function handleSave() {
    if (!valid) return toast.error(`Weights must sum to 100 (currently ${total})`);
    setSaving(true);
    try { await onSave(w); onClose(); }
    catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">Assessment weights</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-400">Weights must sum to 100%. Set to 0 to disable.</p>
          {COMPONENTS.map(c => (
            <div key={c.key} className="flex items-center gap-3">
              <span className={`text-sm font-medium ${c.color} w-24`}>{c.label}</span>
              <input type="number" min="0" max="100" step="5"
                value={w[c.weightKey]}
                onChange={e => setW(p => ({ ...p, [c.weightKey]: parseFloat(e.target.value) || 0 }))}
                className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center
                           focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-xs text-gray-400">%</span>
            </div>
          ))}
          <div className={`flex justify-between text-sm font-bold pt-2 border-t border-gray-100
            ${valid ? 'text-green-600' : 'text-red-500'}`}>
            <span>Total</span><span>{total}% {valid ? '✓' : '✗'}</span>
          </div>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!valid || saving}
            className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg
                       hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Entry Log Panel (Classwork / Homework per student) ────
function EntryPanel({ student, subjectId, type, term, year, weights, onClose, onUpdated }) {
  const [entries,  setEntries]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [newEntry, setNewEntry] = useState({
    score: '', max_score: '10',
    entry_date: new Date().toISOString().split('T')[0],
    title: '',
  });

  const label = type === 'classwork' ? 'Classwork' : 'Homework';
  const color = type === 'classwork' ? 'text-blue-600 bg-blue-50' : 'text-teal-600 bg-teal-50';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await gradeAPI.getEntries({
        student_id: student.student_id, subject_id: subjectId,
        type, term, academic_year: year,
      });
      setEntries(data.data || []);
    } catch {}
    setLoading(false);
  }, [student.student_id, subjectId, type, term, year]);

  useEffect(() => { load(); }, [load]);

  // Average scaled to 100
  const avg = entries.length
    ? Math.round(entries.reduce((s, e) => s + (parseFloat(e.score) / parseFloat(e.max_score) * 100), 0) / entries.length * 10) / 10
    : null;

  async function handleAdd() {
    if (!newEntry.score) return toast.error('Enter a score');
    setSaving(true);
    try {
      await gradeAPI.addEntries({
        subject_id: parseInt(subjectId), type, term, academic_year: year,
        entry_date: newEntry.entry_date,
        title: newEntry.title || undefined,
        max_score: parseFloat(newEntry.max_score) || 10,
        scores: [{ student_id: student.student_id, score: parseFloat(newEntry.score) }],
      });
      toast.success('Entry saved');
      setNewEntry({ score: '', max_score: '10', entry_date: new Date().toISOString().split('T')[0], title: '' });
      await load();
      onUpdated();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await gradeAPI.deleteEntry(id);
      await load();
      onUpdated();
      toast.success('Entry deleted');
    } catch { toast.error('Failed to delete'); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-sm font-semibold text-gray-800">{label} entries</p>
            <p className="text-xs text-gray-400 mt-0.5">{student.student_name} · {term} · {year}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        {/* Average badge */}
        {avg !== null && (
          <div className={`mx-5 mt-4 px-4 py-2.5 rounded-xl flex items-center justify-between ${color}`}>
            <span className="text-sm font-medium">Average ({entries.length} entries)</span>
            <span className="text-lg font-bold">{avg.toFixed(1)}/100</span>
          </div>
        )}

        {/* Add new entry */}
        <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Add entry
          </p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Date</label>
              <input type="date" value={newEntry.entry_date}
                onChange={e => setNewEntry(p => ({ ...p, entry_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Title (optional)</label>
              <input value={newEntry.title}
                onChange={e => setNewEntry(p => ({ ...p, title: e.target.value }))}
                placeholder={`e.g. ${label} 3`}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Score</label>
              <input type="number" min="0" step="0.5" value={newEntry.score}
                onChange={e => setNewEntry(p => ({ ...p, score: e.target.value }))}
                placeholder="e.g. 8"
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="w-24">
              <label className="block text-xs text-gray-400 mb-1">Out of</label>
              <input type="number" min="1" value={newEntry.max_score}
                onChange={e => setNewEntry(p => ({ ...p, max_score: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={handleAdd} disabled={saving}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg
                         hover:bg-blue-700 disabled:opacity-50 flex-shrink-0">
              {saving ? '…' : '+ Add'}
            </button>
          </div>
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No entries yet — add one above</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-4 text-xs text-gray-400 font-medium uppercase tracking-wide pb-1 border-b border-gray-100">
                <span>Date</span><span>Title</span>
                <span className="text-right">Score</span><span className="text-right">%</span>
              </div>
              {entries.map(e => {
                const pct = Math.round(parseFloat(e.score) / parseFloat(e.max_score) * 100);
                return (
                  <div key={e.id}
                    className="grid grid-cols-4 items-center py-2 border-b border-gray-50 last:border-0 group">
                    <span className="text-xs text-gray-500">
                      {new Date(e.entry_date).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
                    </span>
                    <span className="text-xs text-gray-700 truncate">{e.title || '—'}</span>
                    <span className="text-xs font-medium text-gray-800 text-right">
                      {parseFloat(e.score)}/{parseFloat(e.max_score)}
                    </span>
                    <div className="flex items-center justify-end gap-2">
                      <span className={`text-xs font-bold ${pct >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                        {pct}%
                      </span>
                      <button onClick={() => handleDelete(e.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600
                                   text-xs transition-opacity">
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Student Record Modal ──────────────────────────────────
function StudentRecordModal({ student, subjectId, subjectName, term, year, onClose }) {
  const [record,  setRecord]  = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await gradeAPI.studentRecord({
        student_id: student.student_id, subject_id: subjectId, term, academic_year: year,
      });
      setRecord(data.data);
    } catch {}
    setLoading(false);
  }, [student.student_id, subjectId, term, year]);

  useEffect(() => { load(); }, [load]);

  const w    = record?.weights || DEFAULT_WEIGHTS;
  const gs   = record?.scores || {};
  const cwEntries = record?.entries?.filter(e => e.type === 'classwork') || [];
  const hwEntries = record?.entries?.filter(e => e.type === 'homework')  || [];

  function EntryList({ entries, color }) {
    if (!entries.length) return <p className="text-xs text-gray-400 italic py-1">No entries yet</p>;
    return (
      <div className="space-y-1 mt-1">
        {entries.map(e => {
          const pct = Math.round(parseFloat(e.score) / parseFloat(e.max_score) * 100);
          return (
            <div key={e.id} className="flex justify-between items-center text-xs py-1
                                       border-b border-gray-50 last:border-0">
              <span className="text-gray-400">
                {new Date(e.entry_date).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
              </span>
              <span className="text-gray-600 flex-1 px-2 truncate">{e.title || '—'}</span>
              <span className="text-gray-700 font-medium">{parseFloat(e.score)}/{parseFloat(e.max_score)}</span>
              <span className={`ml-2 font-bold ${color} w-10 text-right`}>{pct}%</span>
            </div>
          );
        })}
      </div>
    );
  }

  function ScoreRow({ label, score, weight, color }) {
    if (!parseFloat(weight)) return null;
    return (
      <div className="flex items-center justify-between py-2 border-b border-gray-50">
        <span className={`text-sm font-medium ${color}`}>{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{weight}%</span>
          <span className="text-sm font-bold text-gray-800 w-16 text-right">
            {score != null ? `${parseFloat(score).toFixed(1)}/100` : <span className="text-gray-300">—</span>}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {student.student_name} — {subjectName}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{student.student_number} · {term} · {year}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 grid grid-cols-2 gap-5">

            {/* Classwork entries */}
            {parseFloat(w.classwork_weight) > 0 && (
              <div className="col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                    Classwork ({w.classwork_weight}%)
                  </p>
                  {gs.classwork_score != null && (
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                      Avg: {parseFloat(gs.classwork_score).toFixed(1)}/100
                    </span>
                  )}
                </div>
                <EntryList entries={cwEntries} color="text-blue-600" />
              </div>
            )}

            {/* Homework entries */}
            {parseFloat(w.homework_weight) > 0 && (
              <div className="col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide">
                    Homework ({w.homework_weight}%)
                  </p>
                  {gs.homework_score != null && (
                    <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                      Avg: {parseFloat(gs.homework_score).toFixed(1)}/100
                    </span>
                  )}
                </div>
                <EntryList entries={hwEntries} color="text-teal-600" />
              </div>
            )}

            {/* Score summary */}
            <div className="col-span-2 bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Score Summary
              </p>
              <ScoreRow label="Classwork" score={gs.classwork_score} weight={w.classwork_weight} color="text-blue-600" />
              <ScoreRow label="Homework"  score={gs.homework_score}  weight={w.homework_weight}  color="text-teal-600" />
              <ScoreRow label="Midterm"   score={gs.midterm_score}   weight={w.midterm_weight}   color="text-purple-600" />
              <ScoreRow label="Project"   score={gs.project_score}   weight={w.project_weight}   color="text-orange-600" />
              <ScoreRow label="Exam"      score={gs.exam_score}      weight={w.exam_weight}      color="text-red-600" />

              {gs.final_score != null && (
                <div className="mt-3 pt-3 border-t-2 border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-800">Final Score</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black text-gray-800">
                      {parseFloat(gs.final_score).toFixed(1)}
                    </span>
                    <Badge color={gradeColor(gs.letter_grade)}>{gs.letter_grade}</Badge>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Grades Page ──────────────────────────────────────
export default function Grades() {
  const [classes,       setClasses]       = useState([]);
  const [subjects,      setSubjects]      = useState([]);
  const [students,      setStudents]      = useState([]);
  const [classId,       setClassId]       = useState('');
  const [subjectId,     setSubjectId]     = useState('');
  const [term,          setTerm]          = useState('Term 1');
  const [year,          setYear]          = useState(CURRENT_YEAR);
  const [weights,       setWeights]       = useState(DEFAULT_WEIGHTS);
  const [scores,        setScores]        = useState({});
  const [saving,        setSaving]        = useState(false);
  const [loadingScores, setLoadingScores] = useState(false);
  const [showWeights,   setShowWeights]   = useState(false);
  const [entryPanel,    setEntryPanel]    = useState(null);  // { student, type }
  const [recordPanel,   setRecordPanel]   = useState(null);  // student

  const activeComponents = COMPONENTS.filter(c => parseFloat(weights[c.weightKey] || 0) > 0);
  const subjectName = subjects.find(s => String(s.id) === String(subjectId))?.name || '';

  useEffect(() => {
    classAPI.list({}).then(({ data }) => setClasses(data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!classId) { setSubjects([]); setStudents([]); setScores({}); return; }
    classAPI.subjects(classId).then(({ data }) => setSubjects(data.data)).catch(() => {});
    classAPI.students(classId).then(({ data }) => {
      setStudents(data.data);
      const init = {};
      data.data.forEach(s => { init[s.id] = { classwork:'', homework:'', midterm:'', project:'', exam:'' }; });
      setScores(init);
    }).catch(() => {});
  }, [classId]);

  const loadScores = useCallback(async () => {
    if (!subjectId || !classId || !students.length) return;
    setLoadingScores(true);
    try {
      const wRes = await gradeAPI.getWeights(subjectId);
      const w    = wRes.data?.data || DEFAULT_WEIGHTS;
      setWeights(w);

      const sRes = await gradeAPI.getClassScores({ subject_id: subjectId, class_id: classId, term, academic_year: year });
      const rows = sRes.data?.data || [];

      const newScores = {};
      students.forEach(st => {
        const ex = rows.find(r => r.student_id === st.id);
        newScores[st.id] = {
          classwork: ex?.classwork_score ?? '',
          homework:  ex?.homework_score  ?? '',
          midterm:   ex?.midterm_score   ?? '',
          project:   ex?.project_score   ?? '',
          exam:      ex?.exam_score      ?? '',
        };
      });
      setScores(newScores);
    } catch {}
    setLoadingScores(false);
  }, [subjectId, classId, term, year, students]);

  useEffect(() => { loadScores(); }, [loadScores]);

  function handleScore(studentId, component, value) {
    if (value !== '' && (parseFloat(value) < 0 || parseFloat(value) > 100)) return;
    setScores(prev => ({ ...prev, [studentId]: { ...prev[studentId], [component]: value } }));
  }

  async function handleSaveWeights(newW) {
    await gradeAPI.setWeights({ subject_id: parseInt(subjectId), ...newW });
    setWeights(newW);
    toast.success('Weights saved');
  }

  async function handleSubmit() {
    if (!subjectId) return toast.error('Select a subject');
    const payload = students
      .filter(s => scores[s.id] && Object.values(scores[s.id]).some(v => v !== '' && v !== null))
      .map(s => ({ student_id: s.id, ...scores[s.id] }));
    if (!payload.length) return toast.error('Enter at least one score');
    setSaving(true);
    try {
      const { data } = await gradeAPI.bulkUpsert({
        subject_id: parseInt(subjectId), term, academic_year: year, scores: payload,
      });
      toast.success(`${data.data?.count || payload.length} records saved`);
      await loadScores();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setSaving(false);
  }

  const filledStudents = students.filter(s => scores[s.id] && Object.values(scores[s.id]).some(v => v !== '' && v !== null));
  const finals = filledStudents.map(s => calcFinal(scores[s.id] || {}, weights)).filter(f => f !== null);
  const classAvg = finals.length ? Math.round(finals.reduce((a, v) => a + v, 0) / finals.length * 10) / 10 : null;

  return (
    <div>
      <PageHeader title="Grades" subtitle="Record assessment scores per subject" />

      {/* Controls */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <Select value={classId} onChange={e => setClassId(e.target.value)} className="w-40">
          <option value="">Select class…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </Select>
        <Select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="w-44" disabled={!classId}>
          <option value="">Select subject…</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select value={term} onChange={e => setTerm(e.target.value)} className="w-28">
          {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input value={year} onChange={e => setYear(e.target.value)} placeholder="2025/2026" className="w-28" />
        {subjectId && (
          <button onClick={() => setShowWeights(true)}
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg
                       text-gray-600 hover:bg-gray-50 flex items-center gap-1">
            ⚙️ Weights
          </button>
        )}
      </div>

      {/* Weight badges */}
      {subjectId && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {activeComponents.map(c => (
            <span key={c.key} className={`px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 ${c.color}`}>
              {c.label}: {weights[c.weightKey]}%
              {c.multi && <span className="ml-1 opacity-60">(avg)</span>}
            </span>
          ))}
        </div>
      )}

      {!classId || !subjectId ? (
        <Card><p className="text-sm text-gray-400 py-8 text-center">Select a class and subject to enter scores</p></Card>
      ) : loadingScores ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-500 flex items-center gap-3">
              <span><span className="font-medium text-gray-700">{filledStudents.length}</span>/{students.length} with scores</span>
              {classAvg !== null && (
                <span className="flex items-center gap-1.5">
                  Avg: <span className="font-semibold">{classAvg}%</span>
                  <Badge color={gradeColor(toLetterGrade(classAvg))}>{toLetterGrade(classAvg)}</Badge>
                </span>
              )}
            </div>
            <Button size="sm" onClick={() => {
              const r = {};
              students.forEach(s => { r[s.id] = { classwork:'', homework:'', midterm:'', project:'', exam:'' }; });
              setScores(r);
            }}>Clear all</Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-2 py-2 text-xs text-gray-400 font-medium w-44">Student</th>
                  <th className="text-left px-2 py-2 text-xs text-gray-400 font-medium w-24">ID</th>
                  {activeComponents.map(c => (
                    <th key={c.key} className="px-2 py-2 text-xs font-medium text-center w-32">
                      <span className={c.color}>{c.label}</span>
                      <span className="text-gray-300 ml-1">({weights[c.weightKey]}%)</span>
                      {c.multi && <span className="text-gray-300 block text-[10px]">avg of entries</span>}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-xs text-gray-600 font-medium text-center w-20">Final</th>
                  <th className="px-2 py-2 text-xs text-gray-400 font-medium text-center w-16">Grade</th>
                  <th className="px-2 py-2 text-xs text-gray-400 font-medium text-center w-16">Record</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {students.map(student => {
                  const sc    = scores[student.id] || {};
                  const final = calcFinal(sc, weights);
                  const grade = final !== null ? toLetterGrade(final) : null;

                  return (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-2 py-2.5 font-medium text-gray-800 whitespace-nowrap">{student.name}</td>
                      <td className="px-2 py-2.5 text-xs text-gray-400">{student.student_number}</td>

                      {activeComponents.map(c => (
                        <td key={c.key} className="px-2 py-2.5 text-center">
                          {c.multi ? (
                            // Classwork / Homework → show avg + click to open entry log
                            <button
                              onClick={() => setEntryPanel({ student: { student_id: student.id, student_name: student.name, student_number: student.student_number }, type: c.key })}
                              className={`w-full px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors
                                ${sc[c.key] !== '' && sc[c.key] !== null
                                  ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                  : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                              {sc[c.key] !== '' && sc[c.key] !== null
                                ? <>{parseFloat(sc[c.key]).toFixed(1)}<span className="opacity-60 ml-0.5">/100</span></>
                                : '+ entries'}
                            </button>
                          ) : (
                            // Midterm / Project / Exam → direct input
                            <input type="number" min="0" max="100" step="0.5"
                              value={sc[c.key] ?? ''}
                              onChange={e => handleScore(student.id, c.key, e.target.value)}
                              placeholder="—"
                              className="w-20 px-2 py-1.5 text-sm text-center border border-gray-200 rounded-lg
                                         focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                          )}
                        </td>
                      ))}

                      <td className="px-2 py-2.5 text-center">
                        {final !== null
                          ? <span className={`text-sm font-bold ${final>=80?'text-green-600':final>=60?'text-blue-600':final>=50?'text-amber-600':'text-red-500'}`}>
                              {final.toFixed(1)}
                            </span>
                          : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        {grade ? <Badge color={gradeColor(grade)}>{grade}</Badge>
                               : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          onClick={() => setRecordPanel({ student_id: student.id, student_name: student.name, student_number: student.student_number })}
                          className="text-xs text-gray-400 hover:text-blue-600 hover:underline whitespace-nowrap">
                          📋 View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex justify-end">
            <Button variant="primary" loading={saving} onClick={handleSubmit}
              disabled={!subjectId || !filledStudents.length}>
              💾 Save {filledStudents.length > 0 ? `${filledStudents.length} records` : 'grades'}
            </Button>
          </div>
        </Card>
      )}

      {/* Weights modal */}
      {showWeights && subjectId && (
        <WeightsModal weights={weights} onSave={handleSaveWeights} onClose={() => setShowWeights(false)} />
      )}

      {/* Entry panel (classwork/homework) */}
      {entryPanel && subjectId && (
        <EntryPanel
          student={entryPanel.student}
          subjectId={subjectId}
          type={entryPanel.type}
          term={term}
          year={year}
          weights={weights}
          onClose={() => setEntryPanel(null)}
          onUpdated={loadScores}
        />
      )}

      {/* Student full record modal */}
      {recordPanel && subjectId && (
        <StudentRecordModal
          student={recordPanel}
          subjectId={subjectId}
          subjectName={subjectName}
          term={term}
          year={year}
          onClose={() => setRecordPanel(null)}
        />
      )}
    </div>
  );
}