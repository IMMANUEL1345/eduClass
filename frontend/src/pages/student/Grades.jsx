import React, { useEffect, useState, useCallback } from 'react';
import { gradeAPI, studentAPI } from '../../api';
import { PageHeader, Card, Badge, Select, Input, Spinner } from '../../components/ui';
import { toLetterGrade } from '../../utils/grades';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];

function getCurrentAcademicYear() {
  const now = new Date();
  const y   = now.getFullYear();
  return now.getMonth() >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

function gradeColorClass(g) {
  if (!g) return 'text-gray-400';
  if (g === 'A')         return 'text-green-600';
  if (g.startsWith('B')) return 'text-blue-600';
  if (g.startsWith('C')) return 'text-amber-600';
  return 'text-red-500';
}

function ScoreCell({ value }) {
  if (value === null || value === undefined || value === '')
    return <span className="text-xs text-gray-300">—</span>;
  const num = parseFloat(value);
  const color =
    num >= 80 ? 'text-green-600' :
    num >= 60 ? 'text-blue-600'  :
    num >= 50 ? 'text-amber-600' : 'text-red-500';
  return <span className={`text-sm font-medium ${color}`}>{num.toFixed(1)}</span>;
}

export default function StudentGrades() {
  const [history,  setHistory]  = useState([]);
  const [classId,  setClassId]  = useState('');
  const [year,     setYear]     = useState(getCurrentAcademicYear());
  const [term,     setTerm]     = useState('Term 1');
  const [grades,   setGrades]   = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [histLoad, setHistLoad] = useState(true);

  const classOptions = Array.from(new Map(history.map(h => [h.class_id, h])).values());
  const yearOptions  = [...new Set(history.map(h => h.academic_year))].sort().reverse();

  useEffect(() => {
    studentAPI.myHistory()
      .then(({ data }) => {
        const rows = data.data || [];
        setHistory(rows);
        if (rows.length > 0) {
          setClassId(String(rows[0].class_id));
          setYear(rows[0].academic_year);
        }
      })
      .catch(() => {})
      .finally(() => setHistLoad(false));
  }, []);

  const fetchGrades = useCallback(() => {
    if (!classId) return;
    setLoading(true);
    gradeAPI
      .myGrades({ term, academic_year: year, class_id: classId })
      .then(({ data }) => setGrades(data.data || []))
      .catch(() => setGrades([]))
      .finally(() => setLoading(false));
  }, [classId, term, year]);

  useEffect(() => { fetchGrades(); }, [fetchGrades]);

  const validFinals = grades.map(g => parseFloat(g.final_score)).filter(n => !isNaN(n));
  const overallAvg  = validFinals.length
    ? Math.round(validFinals.reduce((a, v) => a + v, 0) / validFinals.length * 10) / 10
    : null;

  const selectedClass = classOptions.find(c => String(c.class_id) === String(classId));
  const classLabel    = selectedClass ? `${selectedClass.class_name} ${selectedClass.section}` : '';

  if (histLoad) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div>
      <PageHeader title="My Grades" subtitle="Your assessment scores and final grades by subject" />

      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <Select value={classId} onChange={e => setClassId(e.target.value)} className="w-36">
          <option value="">Select class…</option>
          {classOptions.map(c => (
            <option key={c.class_id} value={c.class_id}>
              {c.class_name} {c.section}
            </option>
          ))}
        </Select>

        <Select value={term} onChange={e => setTerm(e.target.value)} className="w-28">
          {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>

        {yearOptions.length > 0 ? (
          <Select value={year} onChange={e => setYear(e.target.value)} className="w-32">
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </Select>
        ) : (
          <Input value={year} onChange={e => setYear(e.target.value)} placeholder="2025/2026" className="w-28" />
        )}
      </div>

      {!classId ? (
        <Card><p className="text-sm text-gray-400 py-10 text-center">Select a class to view grades</p></Card>
      ) : loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : grades.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-400 py-10 text-center">
            No grades recorded for {classLabel} · {term} · {year}
          </p>
        </Card>
      ) : (
        <Card>
          {overallAvg !== null && (
            <div className="flex items-center justify-between mb-5 p-3 bg-blue-50 rounded-xl border border-blue-100">
              <span className="text-sm text-blue-700 font-medium">{classLabel} — {term} {year}</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-blue-700">{overallAvg}%</span>
                <Badge color={overallAvg >= 80 ? 'green' : overallAvg >= 60 ? 'blue' : overallAvg >= 50 ? 'amber' : 'red'}>
                  {toLetterGrade(overallAvg)}
                </Badge>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-400">Subject</th>
                  {[{l:'Classwork',c:'text-blue-500'},{l:'Homework',c:'text-teal-500'},{l:'Midterm',c:'text-purple-500'},{l:'Project',c:'text-orange-500'},{l:'Exam',c:'text-red-500'}].map(({l,c}) => (
                    <th key={l} className={`text-center px-3 py-2.5 text-xs font-medium ${c}`}>{l}</th>
                  ))}
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-600">Final</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-400">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {grades.map(g => (
                  <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3 font-medium text-gray-800 whitespace-nowrap">{g.subject_name}</td>
                    <td className="px-3 py-3 text-center"><ScoreCell value={g.classwork_score} /></td>
                    <td className="px-3 py-3 text-center"><ScoreCell value={g.homework_score}  /></td>
                    <td className="px-3 py-3 text-center"><ScoreCell value={g.midterm_score}   /></td>
                    <td className="px-3 py-3 text-center"><ScoreCell value={g.project_score}   /></td>
                    <td className="px-3 py-3 text-center"><ScoreCell value={g.exam_score}      /></td>
                    <td className="px-3 py-3 text-center">
                      {g.final_score != null
                        ? <span className={`text-sm font-bold ${gradeColorClass(g.letter_grade)}`}>{parseFloat(g.final_score).toFixed(1)}%</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {g.letter_grade
                        ? <Badge color={g.letter_grade==='A'?'green':g.letter_grade.startsWith('B')?'blue':g.letter_grade.startsWith('C')?'amber':'red'}>{g.letter_grade}</Badge>
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-4 text-right">{grades.length} subject{grades.length!==1?'s':''} · {classLabel} · {term} {year}</p>
        </Card>
      )}
    </div>
  );
}