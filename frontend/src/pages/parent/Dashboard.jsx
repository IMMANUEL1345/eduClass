import React, { useEffect, useState } from 'react';
import { studentAPI, analyticsAPI } from '../../api';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import { StatCard, Card, Badge, PageHeader, Spinner } from '../../components/ui';
import { gradeColor } from '../../utils/grades';
import toast from 'react-hot-toast';

export default function ParentDashboard() {
  const user = useSelector(selectUser);
  const [children,   setChildren]   = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [grades,     setGrades]     = useState([]);
  const [attSummary, setAttSummary] = useState(null);
  const [reports,    setReports]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [childLoad,  setChildLoad]  = useState(false);

  useEffect(() => {
    studentAPI.myChildren()
      .then(({ data }) => {
        setChildren(data.data);
        // Auto-select first child
        if (data.data.length > 0) loadChild(data.data[0]);
      })
      .catch(() => toast.error('Failed to load children'))
      .finally(() => setLoading(false));
  }, []);

  async function loadChild(child) {
    setSelected(child);
    setChildLoad(true);
    try {
      const [g, a, r] = await Promise.all([
        studentAPI.grades(child.id, {}),
        studentAPI.attendance(child.id, {}),
        studentAPI.reports(child.id),
      ]);
      setGrades(g.data.data.slice(0, 8));
      setAttSummary(a.data.data);
      setReports(r.data.data.slice(0, 3));
    } catch { toast.error('Failed to load child data'); }
    finally { setChildLoad(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div>
      <PageHeader title="Parent portal" subtitle={`Welcome, ${user?.name}`} />

      {children.length === 0 ? (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-8 text-center">
          <p className="text-2xl mb-3">👶</p>
          <p className="text-base font-medium text-amber-700 mb-2">No children linked to your account</p>
          <p className="text-sm text-amber-600">
            Contact your school administrator to link your account to your child's record.
          </p>
        </div>
      ) : (
        <>
          {/* Child selector */}
          {children.length > 1 && (
            <div className="flex gap-2 mb-5 flex-wrap">
              {children.map(c => (
                <button key={c.id} onClick={() => loadChild(c)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border
                    ${selected?.id === c.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="mb-5 bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-base font-bold flex-shrink-0">
                {selected.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-base font-semibold text-gray-800">{selected.name}</p>
                <p className="text-sm text-gray-400">{selected.class_name} {selected.section} · {selected.student_number}</p>
              </div>
            </div>
          )}

          {childLoad ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 mb-5">
                <StatCard label="Attendance rate"
                  value={`${attSummary?.summary?.percentage ?? 0}%`}
                  color={attSummary?.summary?.percentage >= 80 ? 'green' : 'amber'} />
                <StatCard label="Subjects with grades"
                  value={grades.length}
                  color="blue" />
                <StatCard label="Reports available"
                  value={reports.length}
                  color="purple" />
              </div>

              <div className="grid grid-cols-2 gap-5">
                {/* Recent grades */}
                <Card title="Recent grades">
                  {grades.length === 0
                    ? <p className="text-sm text-gray-400 py-4 text-center">No grades yet</p>
                    : grades.map(g => (
                        <div key={g.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                          <div>
                            <p className="text-sm text-gray-700">{g.subject_name}</p>
                            <p className="text-xs text-gray-400 capitalize">{g.assessment_type} · {g.term}</p>
                          </div>
                          <div className="text-right">
                            <Badge color={gradeColor(g.letter_grade)}>{g.letter_grade}</Badge>
                            <p className="text-xs text-gray-400 mt-0.5">{g.score}%</p>
                          </div>
                        </div>
                      ))
                  }
                </Card>

                {/* Attendance summary */}
                <Card title="Attendance summary">
                  {!attSummary?.summary?.total
                    ? <p className="text-sm text-gray-400 py-4 text-center">No attendance data</p>
                    : (
                      <>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          {[
                            ['Total',   attSummary.summary.total,   'bg-gray-50'],
                            ['Present', attSummary.summary.present, 'bg-green-50'],
                            ['Absent',  attSummary.summary.absent,  'bg-red-50'],
                            ['Late',    attSummary.summary.late,    'bg-amber-50'],
                          ].map(([l,v,bg]) => (
                            <div key={l} className={`${bg} rounded-xl p-3 text-center`}>
                              <p className="text-lg font-bold text-gray-700">{v}</p>
                              <p className="text-xs text-gray-400">{l}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-2 rounded-full ${attSummary.summary.percentage>=80?'bg-green-400':attSummary.summary.percentage>=60?'bg-amber-400':'bg-red-400'}`}
                              style={{ width:`${attSummary.summary.percentage}%` }} />
                          </div>
                          <span className="text-sm font-medium text-gray-600">{attSummary.summary.percentage}%</span>
                        </div>
                      </>
                    )
                  }
                </Card>
              </div>

              {/* Term reports */}
              {reports.length > 0 && (
                <Card title="Term reports" className="mt-5">
                  {reports.map(r => (
                    <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-700">{r.term} · {r.academic_year}</p>
                        <p className="text-xs text-gray-400">{r.remarks}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-700">{parseFloat(r.average_score||0).toFixed(1)}% avg</p>
                        <p className="text-xs text-gray-400">Position: {r.class_position}/{r.class_size}</p>
                      </div>
                    </div>
                  ))}
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}