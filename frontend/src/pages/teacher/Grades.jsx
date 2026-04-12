import React, { useEffect, useState } from 'react';
import { classAPI, gradeAPI } from '../../api';
import { PageHeader, Card, Button, Select, Input, Badge, Spinner } from '../../components/ui';
import { toLetterGrade } from '../../utils/grades';
import toast from 'react-hot-toast';

const TERMS        = ['Term 1', 'Term 2', 'Term 3'];
const TYPES        = ['classwork', 'homework', 'midterm', 'exam', 'project'];
const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;

export default function Grades() {
  const [classes,      setClasses]      = useState([]);
  const [subjects,     setSubjects]     = useState([]);
  const [students,     setStudents]     = useState([]);
  const [scores,       setScores]       = useState({});  // { studentId: score }
  const [classId,      setClassId]      = useState('');
  const [subjectId,    setSubjectId]    = useState('');
  const [term,         setTerm]         = useState('Term 1');
  const [type,         setType]         = useState('classwork');
  const [year,         setYear]         = useState(CURRENT_YEAR);
  const [saving,       setSaving]       = useState(false);

  useEffect(() => {
    classAPI.list({}).then(({ data }) => setClasses(data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!classId) { setSubjects([]); setStudents([]); return; }
    classAPI.subjects(classId).then(({ data }) => setSubjects(data.data)).catch(() => {});
    classAPI.students(classId).then(({ data }) => {
      setStudents(data.data);
      const init = {};
      data.data.forEach(s => { init[s.id] = ''; });
      setScores(init);
    }).catch(() => {});
  }, [classId]);

  function handleScore(studentId, value) {
    const n = parseFloat(value);
    if (value !== '' && (n < 0 || n > 100)) return;
    setScores(prev => ({ ...prev, [studentId]: value }));
  }

  async function handleSubmit() {
    if (!subjectId) return toast.error('Select a subject');
    const payload = students
      .filter(s => scores[s.id] !== '' && scores[s.id] !== undefined)
      .map(s => ({ student_id: s.id, score: parseFloat(scores[s.id]) }));

    if (payload.length === 0) return toast.error('Enter at least one score');

    setSaving(true);
    try {
      await gradeAPI.submit({
        subject_id: parseInt(subjectId),
        assessment_type: type,
        term,
        academic_year: year,
        scores: payload,
      });
      toast.success(`${payload.length} grades submitted`);
      // Clear scores
      const reset = {};
      students.forEach(s => { reset[s.id] = ''; });
      setScores(reset);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit grades');
    } finally { setSaving(false); }
  }

  const filled  = Object.values(scores).filter(v => v !== '').length;
  const average = filled > 0
    ? Math.round(Object.values(scores).filter(v => v !== '').reduce((a, v) => a + parseFloat(v), 0) / filled)
    : null;

  return (
    <div>
      <PageHeader title="Grades" subtitle="Submit assessment scores" />

      {/* Controls row */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <Select value={classId}   onChange={e => setClassId(e.target.value)}   className="w-40">
          <option value="">Select class…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </Select>
        <Select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="w-44" disabled={!classId}>
          <option value="">Select subject…</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select value={type}      onChange={e => setType(e.target.value)}       className="w-36">
          {TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
        </Select>
        <Select value={term}      onChange={e => setTerm(e.target.value)}       className="w-28">
          {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input
          value={year}
          onChange={e => setYear(e.target.value)}
          placeholder="2025/2026"
          className="w-28"
        />
      </div>

      {students.length === 0 && (
        <Card>
          <p className="text-sm text-gray-400 py-8 text-center">Select a class to enter scores</p>
        </Card>
      )}

      {students.length > 0 && (
        <Card>
          {/* Summary bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-500">
              <span className="font-medium text-gray-700">{filled}</span> / {students.length} scores entered
              {average !== null && (
                <span className="ml-3">
                  Class average: <span className="font-medium">{average}%</span>
                  <span className={`ml-1.5`}>
                    <Badge color={average >= 70 ? 'green' : average >= 50 ? 'amber' : 'red'}>
                      {toLetterGrade(average)}
                    </Badge>
                  </span>
                </span>
              )}
            </div>
            <Button size="sm" onClick={() => { const r = {}; students.forEach(s => { r[s.id] = ''; }); setScores(r); }}>
              Clear all
            </Button>
          </div>

          {/* Score entry table */}
          <div className="divide-y divide-gray-50">
            {/* Header */}
            <div className="grid grid-cols-4 py-1.5 text-xs font-medium text-gray-400 px-1">
              <span>Student</span>
              <span>ID</span>
              <span>Score (/100)</span>
              <span>Grade</span>
            </div>
            {students.map(student => {
              const val    = scores[student.id] ?? '';
              const num    = parseFloat(val);
              const grade  = val !== '' && !isNaN(num) ? toLetterGrade(num) : null;
              const gColor = grade === 'A' ? 'green' : grade?.startsWith('B') ? 'blue' : grade?.startsWith('C') ? 'amber' : grade ? 'red' : 'gray';
              return (
                <div key={student.id} className="grid grid-cols-4 py-2 items-center px-1">
                  <span className="text-sm text-gray-700">{student.name}</span>
                  <span className="text-xs text-gray-400">{student.student_number}</span>
                  <input
                    type="number" min="0" max="100" step="0.5"
                    value={val}
                    onChange={e => handleScore(student.id, e.target.value)}
                    placeholder="—"
                    className="w-24 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none
                               focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <span>{grade ? <Badge color={gColor}>{grade}</Badge> : <span className="text-gray-300 text-xs">—</span>}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex justify-end">
            <Button variant="primary" loading={saving} onClick={handleSubmit} disabled={!subjectId || filled === 0}>
              Submit {filled > 0 ? `${filled} grades` : 'grades'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
