import React, { useEffect, useState } from 'react';
import { studentAPI, analyticsAPI } from '../../api';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import { StatCard, Card, Badge, PageHeader, Spinner } from '../../components/ui';
import { gradeColor } from '../../utils/grades';
import toast from 'react-hot-toast';

export default function ParentDashboard() {
  const user      = useSelector(selectUser);
  const [children,    setChildren]    = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [grades,      setGrades]      = useState([]);
  const [attSummary,  setAttSummary]  = useState(null);
  const [reports,     setReports]     = useState([]);
  const [progress,    setProgress]    = useState([]);
  const [loading,     setLoading]     = useState(true);

  // Load this parent's children
  useEffect(() => {
    // In a real app this endpoint would return children linked to the logged-in parent
    // Using the students list filtered would require a dedicated /parents/me/children endpoint
    // For now we stub — replace with actual API call
    setLoading(false);
    toast('Select a child from the dropdown to view their data.', { icon: 'ℹ️' });
  }, []);

  async function loadChild(studentId) {
    if (!studentId) return;
    setLoading(true);
    try {
      const [g, a, r, p] = await Promise.all([
        studentAPI.grades(studentId, { term: 'Term 1' }),
        studentAPI.attendance(studentId, {}),
        studentAPI.reports(studentId),
        analyticsAPI.studentProgress(studentId),
      ]);
      setGrades(g.data.data.slice(0, 6));
      setAttSummary(a.data.data);
      setReports(r.data.data.slice(0, 3));
      setProgress(p.data.data);
      setSelected(studentId);
    } catch { toast.error('Failed to load child data'); }
    finally { setLoading(false); }
  }

  const latestReport = reports[0];
  const avgScore     = progress.length
    ? Math.round(progress[progress.length - 1].avg_score)
    : null;

  return (
    <div>
      <PageHeader title="Parent portal" subtitle={`Welcome, ${user?.name}`} />

      {/* Child selector */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-gray-500">Viewing child:</span>
        <input
          type="number"
          placeholder="Enter student ID"
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={e => e.key === 'Enter' && loadChild(e.target.value)}
        />
        <span className="text-xs text-gray-400">Press Enter to load</span>
      </div>

      {loading && <div className="flex justify-center py-20"><Spinner size="lg" /></div>}

      {!loading && selected && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            <StatCard label="Attendance rate"  value={`${attSummary?.summary?.percentage ?? 0}%`}    color={attSummary?.summary?.percentage >= 80 ? 'green' : 'amber'} />
            <StatCard label="Latest avg score" value={avgScore !== null ? `${avgScore}%` : '—'}       color="blue" />
            <StatCard label="Class position"   value={latestReport ? `${latestReport.class_position}${ordinal(latestReport.class_position)}` : '—'} color="purple" sub={latestReport ? `of ${latestReport.class_size}` : ''} />
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Recent grades */}
            <Card title="Recent grades">
              {grades.length === 0
                ? <p className="text-sm text-gray-400 py-4 text-center">No grades yet</p>
                : <div className="divide-y divide-gray-50">
                    {grades.map(g => (
                      <div key={g.id} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-sm text-gray-700">{g.subject_name}</p>
                          <p className="text-xs text-gray-400 capitalize">{g.assessment_type} · {g.term}</p>
                        </div>
                        <div className="text-right">
                          <Badge color={gradeColor(g.letter_grade)}>{g.letter_grade}</Badge>
                          <p className="text-xs text-gray-400 mt-0.5">{g.score}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </Card>

            {/* Attendance by subject */}
            <Card title="Attendance by subject">
              {!attSummary?.by_subject?.length
                ? <p className="text-sm text-gray-400 py-4 text-center">No attendance data</p>
                : <div className="space-y-2.5 mt-1">
                    {attSummary.by_subject.map(s => (
                      <div key={s.subject} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-28 truncate flex-shrink-0">{s.subject}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${s.pct >= 85 ? 'bg-green-400' : s.pct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${s.pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right">{s.pct}%</span>
                      </div>
                    ))}
                  </div>
              }
            </Card>
          </div>

          {/* Term reports */}
          {reports.length > 0 && (
            <Card title="Term reports" className="mt-5">
              <div className="divide-y divide-gray-50">
                {reports.map(r => (
                  <div key={r.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{r.term} · {r.academic_year}</p>
                      <p className="text-xs text-gray-400">{r.remarks}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-700">{r.average_score}% avg</p>
                      <p className="text-xs text-gray-400">Position: {r.class_position} / {r.class_size}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ordinal(n) {
  if (!n) return '';
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
