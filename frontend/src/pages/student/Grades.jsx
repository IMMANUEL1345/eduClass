// pages/student/Grades.jsx
import React, { useEffect, useState } from 'react';
import { gradeAPI } from '../../api';
import { PageHeader, Card, Badge, Select, Input, Spinner } from '../../components/ui';
import { toLetterGrade } from '../../utils/grades';

const TERMS        = ['Term 1', 'Term 2', 'Term 3'];
// Ghana school year: Sep–Aug. In Jan–Aug we're still in the PREVIOUS year's cycle.
function getCurrentAcademicYear() {
  const now = new Date();
  const y   = now.getFullYear();
  return now.getMonth() >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}
const CURRENT_YEAR = getCurrentAcademicYear();

function gradeColor(g) {
  if (!g) return 'gray';
  if (g === 'A')          return 'green';
  if (g.startsWith('B')) return 'blue';
  if (g.startsWith('C')) return 'amber';
  return 'red';
}

function ScoreCell({ value }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-xs text-gray-300">—</span>;
  }
  const num = parseFloat(value);
  const color =
    num >= 80 ? 'text-green-600' :
    num >= 60 ? 'text-blue-600'  :
    num >= 50 ? 'text-amber-600' : 'text-red-500';
  return <span className={`text-sm font-medium ${color}`}>{num.toFixed(1)}</span>;
}

export default function StudentGrades() {
  const [grades,  setGrades]  = useState([]);
  const [term,    setTerm]    = useState('Term 1');
  const [year,    setYear]    = useState(CURRENT_YEAR);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    gradeAPI
      .myGrades({ term, academic_year: year })
      .then(({ data }) => setGrades(data.data || []))
      .catch(() => setGrades([]))
      .finally(() => setLoading(false));
  }, [term, year]);

  // Group grades by subject
  const bySubject = grades.reduce((acc, row) => {
    const key = row.subject_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  // For each subject, collapse into one summary row
  // (latest entry per assessment_type, or use the multi-component structure)
  const summaryRows = Object.entries(bySubject).map(([subject, rows]) => {
    const get = (type) => rows.find(r => r.assessment_type === type)?.score ?? null;
    const classwork = get('classwork');
    const homework  = get('homework');
    const midterm   = get('midterm');
    const project   = get('project');
    const exam      = get('exam');
    // Use pre-computed final from DB if available, else pick the latest
    const finalRow  = rows.find(r => r.final_score !== null && r.final_score !== undefined)
                   || rows[rows.length - 1];
    const final     = finalRow?.final_score ?? null;
    const grade     = finalRow?.letter_grade ?? (final !== null ? toLetterGrade(final) : null);
    return { subject, classwork, homework, midterm, project, exam, final, grade };
  });

  // Overall average
  const validFinals = summaryRows.map(r => parseFloat(r.final)).filter(n => !isNaN(n));
  const overallAvg  = validFinals.length
    ? Math.round(validFinals.reduce((a, v) => a + v, 0) / validFinals.length * 10) / 10
    : null;

  return (
    <div>
      <PageHeader
        title="My Grades"
        subtitle="Your assessment scores and final grades by subject"
      />

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <Select value={term} onChange={e => setTerm(e.target.value)} className="w-28">
          {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input
          value={year}
          onChange={e => setYear(e.target.value)}
          placeholder="2025/2026"
          className="w-28"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : summaryRows.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-400 py-10 text-center">
            No grades recorded for {term}, {year}
          </p>
        </Card>
      ) : (
        <Card>
          {/* Overall summary banner */}
          {overallAvg !== null && (
            <div className="flex items-center justify-between mb-5 p-3 bg-blue-50 rounded-xl border border-blue-100">
              <span className="text-sm text-blue-700 font-medium">
                Overall average — {term} {year}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-blue-700">{overallAvg}%</span>
                <Badge color={gradeColor(toLetterGrade(overallAvg))}>
                  {toLetterGrade(overallAvg)}
                </Badge>
              </div>
            </div>
          )}

          {/* Grades table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-400">
                    Subject
                  </th>
                  {[
                    { label: 'Classwork', color: 'text-blue-500'   },
                    { label: 'Homework',  color: 'text-teal-500'   },
                    { label: 'Midterm',   color: 'text-purple-500' },
                    { label: 'Project',   color: 'text-orange-500' },
                    { label: 'Exam',      color: 'text-red-500'    },
                  ].map(({ label, color }) => (
                    <th key={label}
                      className={`text-center px-3 py-2.5 text-xs font-medium ${color}`}>
                      {label}
                    </th>
                  ))}
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-600">
                    Final
                  </th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-400">
                    Grade
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {summaryRows.map(row => (
                  <tr key={row.subject} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3 font-medium text-gray-800 whitespace-nowrap">
                      {row.subject}
                    </td>
                    <td className="px-3 py-3 text-center"><ScoreCell value={row.classwork} /></td>
                    <td className="px-3 py-3 text-center"><ScoreCell value={row.homework}  /></td>
                    <td className="px-3 py-3 text-center"><ScoreCell value={row.midterm}   /></td>
                    <td className="px-3 py-3 text-center"><ScoreCell value={row.project}   /></td>
                    <td className="px-3 py-3 text-center"><ScoreCell value={row.exam}      /></td>

                    {/* Final score */}
                    <td className="px-3 py-3 text-center">
                      {row.final !== null ? (
                        <span className={`text-sm font-bold ${
                          parseFloat(row.final) >= 80 ? 'text-green-600' :
                          parseFloat(row.final) >= 60 ? 'text-blue-600'  :
                          parseFloat(row.final) >= 50 ? 'text-amber-600' : 'text-red-500'
                        }`}>
                          {parseFloat(row.final).toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>

                    {/* Letter grade */}
                    <td className="px-3 py-3 text-center">
                      {row.grade
                        ? <Badge color={gradeColor(row.grade)}>{row.grade}</Badge>
                        : <span className="text-xs text-gray-300">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 mt-4 text-right">
            Showing {summaryRows.length} subject{summaryRows.length !== 1 ? 's' : ''} • {term} {year}
          </p>
        </Card>
      )}
    </div>
  );
}