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

// Components config
const COMPONENTS = [
  { key: 'classwork', label: 'Classwork', weightKey: 'classwork_weight', color: 'text-blue-600'  },
  { key: 'homework',  label: 'Homework',  weightKey: 'homework_weight',  color: 'text-teal-600'  },
  { key: 'midterm',   label: 'Midterm',   weightKey: 'midterm_weight',   color: 'text-purple-600'},
  { key: 'project',   label: 'Project',   weightKey: 'project_weight',   color: 'text-orange-600'},
  { key: 'exam',      label: 'Exam',      weightKey: 'exam_weight',      color: 'text-red-600'   },
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
  return Math.round(
    active.reduce((sum, c) => sum + parseFloat(scores[c.key]) * parseFloat(weights[c.weightKey]) / 100, 0) * 10
  ) / 10;
}

// ── Weights Config Modal ──────────────────────────────────
function WeightsModal({ weights, onSave, onClose }) {
  const [w, setW] = useState({ ...weights });
  const [saving, setSaving] = useState(false);

  const total = COMPONENTS.reduce((s, c) => s + parseFloat(w[c.weightKey] || 0), 0);
  const valid = Math.abs(total - 100) < 0.1;

  async function handleSave() {
    if (!valid) return toast.error(`Weights must sum to 100 (currently ${total})`);
    setSaving(true);
    try { await onSave(w); onClose(); }
    catch (err) { toast.error(err?.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">Configure assessment weights</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-500">Weights must sum to 100%. Set to 0 to disable a component.</p>
          {COMPONENTS.map(c => (
            <div key={c.key} className="flex items-center justify-between gap-3">
              <span className={`text-sm font-medium ${c.color} w-24`}>{c.label}</span>
              <div className="flex items-center gap-2 flex-1">
                <input type="number" min="0" max="100" step="5"
                  value={w[c.weightKey]}
                  onChange={e => setW(p => ({ ...p, [c.weightKey]: parseFloat(e.target.value) || 0 }))}
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center
                             focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-xs text-gray-400">%</span>
              </div>
            </div>
          ))}
          <div className={`flex justify-between text-sm font-semibold pt-2 border-t border-gray-100
            ${valid ? 'text-green-600' : 'text-red-500'}`}>
            <span>Total</span>
            <span>{total}% {valid ? '✓' : '✗'}</span>
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
            {saving ? 'Saving…' : 'Save weights'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
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

  // Active components (weight > 0)
  const activeComponents = COMPONENTS.filter(c => parseFloat(weights[c.weightKey] || 0) > 0);

  useEffect(() => {
    classAPI.list({}).then(({ data }) => setClasses(data.data)).catch(() => {});
  }, []);

  // Load students + subjects when class changes
  useEffect(() => {
    if (!classId) { setSubjects([]); setStudents([]); setScores({}); return; }
    classAPI.subjects(classId).then(({ data }) => setSubjects(data.data)).catch(() => {});
    classAPI.students(classId).then(({ data }) => {
      setStudents(data.data);
      const init = {};
      data.data.forEach(s => {
        init[s.id] = { classwork:'', homework:'', midterm:'', project:'', exam:'' };
      });
      setScores(init);
    }).catch(() => {});
  }, [classId]);

  // Load weights + existing scores when subject/term/year changes
  const loadScores = useCallback(async () => {
    if (!subjectId || !classId) return;
    setLoadingScores(true);
    try {
      // Load weights
      const wRes = await gradeAPI.getWeights(subjectId);
      const w    = wRes.data?.data || DEFAULT_WEIGHTS;
      setWeights(w);

      // Load existing scores
      const sRes = await gradeAPI.getClassScores({ subject_id: subjectId, class_id: classId, term, academic_year: year });
      const rows = sRes.data?.data || [];

      const newScores = {};
      students.forEach(st => {
        const existing = rows.find(r => r.student_id === st.id);
        newScores[st.id] = {
          classwork: existing?.classwork_score ?? '',
          homework:  existing?.homework_score  ?? '',
          midterm:   existing?.midterm_score   ?? '',
          project:   existing?.project_score   ?? '',
          exam:      existing?.exam_score       ?? '',
        };
      });
      setScores(newScores);
    } catch {}
    setLoadingScores(false);
  }, [subjectId, classId, term, year, students]);

  useEffect(() => { loadScores(); }, [loadScores]);

  function handleScore(studentId, component, value) {
    if (value !== '' && (parseFloat(value) < 0 || parseFloat(value) > 100)) return;
    setScores(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [component]: value },
    }));
  }

  async function handleSaveWeights(newWeights) {
    await gradeAPI.setWeights({ subject_id: parseInt(subjectId), ...newWeights });
    setWeights(newWeights);
    toast.success('Weights saved');
    // Recalculate finals with new weights
    setScores(prev => ({ ...prev })); // trigger re-render
  }

  async function handleSubmit() {
    if (!subjectId) return toast.error('Select a subject');
    const payload = students
      .filter(s => {
        const sc = scores[s.id];
        return sc && Object.values(sc).some(v => v !== '' && v !== null);
      })
      .map(s => ({ student_id: s.id, ...scores[s.id] }));

    if (!payload.length) return toast.error('Enter at least one score');
    setSaving(true);
    try {
      const { data } = await gradeAPI.bulkUpsert({
        subject_id:    parseInt(subjectId),
        term, academic_year: year, scores: payload,
      });
      toast.success(`${data.data?.count || payload.length} grade records saved`);
      await loadScores(); // reload to get computed finals
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save grades');
    } finally { setSaving(false); }
  }

  // Stats
  const filledStudents = students.filter(s => {
    const sc = scores[s.id];
    return sc && Object.values(sc).some(v => v !== '' && v !== null);
  });
  const finals = filledStudents
    .map(s => calcFinal(scores[s.id] || {}, weights))
    .filter(f => f !== null);
  const classAvg = finals.length
    ? Math.round(finals.reduce((a, v) => a + v, 0) / finals.length * 10) / 10
    : null;

  return (
    <div>
      <PageHeader title="Grades" subtitle="Record assessment scores per subject" />

      {/* Controls */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <Select value={classId} onChange={e => setClassId(e.target.value)} className="w-40">
          <option value="">Select class…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </Select>
        <Select value={subjectId} onChange={e => setSubjectId(e.target.value)}
          className="w-44" disabled={!classId}>
          <option value="">Select subject…</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select value={term} onChange={e => setTerm(e.target.value)} className="w-28">
          {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input value={year} onChange={e => setYear(e.target.value)}
          placeholder="2025/2026" className="w-28" />
        {subjectId && (
          <button onClick={() => setShowWeights(true)}
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg
                       text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
            ⚙️ Weights
          </button>
        )}
      </div>

      {/* Weight badges */}
      {subjectId && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {activeComponents.map(c => (
            <span key={c.key}
              className={`px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 ${c.color}`}>
              {c.label}: {weights[c.weightKey]}%
            </span>
          ))}
        </div>
      )}

      {!classId || !subjectId ? (
        <Card>
          <p className="text-sm text-gray-400 py-8 text-center">
            Select a class and subject to enter scores
          </p>
        </Card>
      ) : loadingScores ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <Card>
          {/* Summary bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-500 flex items-center gap-3">
              <span>
                <span className="font-medium text-gray-700">{filledStudents.length}</span>
                / {students.length} students with scores
              </span>
              {classAvg !== null && (
                <span className="flex items-center gap-1.5">
                  Class avg:
                  <span className="font-semibold text-gray-700">{classAvg}%</span>
                  <Badge color={gradeColor(toLetterGrade(classAvg))}>
                    {toLetterGrade(classAvg)}
                  </Badge>
                </span>
              )}
            </div>
            <Button size="sm" onClick={() => {
              const r = {};
              students.forEach(s => { r[s.id] = { classwork:'', homework:'', midterm:'', project:'', exam:'' }; });
              setScores(r);
            }}>
              Clear all
            </Button>
          </div>

          {/* Grade table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-2 py-2 text-xs font-medium text-gray-400 w-44">Student</th>
                  <th className="text-left px-2 py-2 text-xs font-medium text-gray-400 w-24">ID</th>
                  {activeComponents.map(c => (
                    <th key={c.key} className="px-2 py-2 text-xs font-medium text-center w-28">
                      <span className={c.color}>{c.label}</span>
                      <span className="text-gray-300 ml-1">({weights[c.weightKey]}%)</span>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-xs font-medium text-center text-gray-600 w-20">Final</th>
                  <th className="px-2 py-2 text-xs font-medium text-center text-gray-400 w-16">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {students.map(student => {
                  const sc    = scores[student.id] || {};
                  const final = calcFinal(sc, weights);
                  const grade = final !== null ? toLetterGrade(final) : null;
                  const hasAny = Object.values(sc).some(v => v !== '' && v !== null);

                  return (
                    <tr key={student.id}
                      className={`hover:bg-gray-50 transition-colors ${hasAny ? '' : 'opacity-70'}`}>
                      <td className="px-2 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                        {student.name}
                      </td>
                      <td className="px-2 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                        {student.student_number}
                      </td>

                      {activeComponents.map(c => (
                        <td key={c.key} className="px-2 py-2.5 text-center">
                          <input
                            type="number" min="0" max="100" step="0.5"
                            value={sc[c.key] ?? ''}
                            onChange={e => handleScore(student.id, c.key, e.target.value)}
                            placeholder="—"
                            className="w-20 px-2 py-1.5 text-sm text-center border border-gray-200
                                       rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
                                       focus:border-transparent bg-white"
                          />
                        </td>
                      ))}

                      {/* Final */}
                      <td className="px-2 py-2.5 text-center">
                        {final !== null ? (
                          <span className={`text-sm font-bold ${
                            final >= 80 ? 'text-green-600' :
                            final >= 60 ? 'text-blue-600' :
                            final >= 50 ? 'text-amber-600' : 'text-red-500'
                          }`}>
                            {final.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Grade */}
                      <td className="px-2 py-2.5 text-center">
                        {grade
                          ? <Badge color={gradeColor(grade)}>{grade}</Badge>
                          : <span className="text-xs text-gray-300">—</span>
                        }
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

      {showWeights && subjectId && (
        <WeightsModal
          weights={weights}
          onSave={handleSaveWeights}
          onClose={() => setShowWeights(false)}
        />
      )}
    </div>
  );
}