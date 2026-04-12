import React, { useEffect, useState } from 'react';
import { analyticsAPI, classAPI } from '../../api';
import { PageHeader, Card, Select, StatCard, Spinner } from '../../components/ui';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import toast from 'react-hot-toast';

const GRADE_COLORS = { A: '#22c55e', 'B+': '#3b82f6', B: '#60a5fa', 'C+': '#f59e0b', C: '#fbbf24', 'D+': '#f97316', D: '#fb923c', F: '#ef4444' };

export default function Analytics() {
  const [classes,    setClasses]    = useState([]);
  const [classId,    setClassId]    = useState('');
  const [overview,   setOverview]   = useState(null);
  const [trend,      setTrend]      = useState([]);
  const [distrib,    setDistrib]    = useState([]);
  const [perf,       setPerf]       = useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    classAPI.list({}).then(({ data }) => setClasses(data.data)).catch(() => {});
    analyticsAPI.overview().then(({ data }) => setOverview(data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    async function loadCharts() {
      setLoading(true);
      try {
        const [t, d, p] = await Promise.all([
          analyticsAPI.attendanceTrend({ class_id: classId || undefined }),
          analyticsAPI.gradeDistrib({ class_id: classId || undefined }),
          analyticsAPI.classPerformance({ class_id: classId || undefined }),
        ]);
        setTrend(t.data.data.map(r => ({
          date: new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          pct: parseFloat(r.pct),
        })));
        setDistrib(d.data.data.map(r => ({ grade: r.grade, count: parseInt(r.count) })));
        setPerf(p.data.data.map(r => ({ subject: r.subject, avg: parseFloat(r.avg_score) })));
      } catch { toast.error('Failed to load charts'); }
      finally { setLoading(false); }
    }
    loadCharts();
  }, [classId]);

  return (
    <div>
      <PageHeader title="Analytics" subtitle="School performance overview" />

      {/* KPI row */}
      {overview && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="Students"        value={overview.students}          color="blue"   />
          <StatCard label="Teachers"        value={overview.teachers}          color="green"  />
          <StatCard label="Classes"         value={overview.classes}           color="purple" />
          <StatCard label="Today's attendance" value={`${overview.attendance_today}%`}
                    color={overview.attendance_today >= 80 ? 'green' : 'amber'} />
        </div>
      )}

      {/* Class filter */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-sm text-gray-500">Filter by class:</span>
        <Select value={classId} onChange={e => setClassId(e.target.value)} className="w-44">
          <option value="">All classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-5">

          {/* Attendance trend */}
          <Card title="Attendance trend (%)">
            {trend.length === 0
              ? <p className="text-sm text-gray-400 py-8 text-center">No attendance data yet</p>
              : <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ef" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      formatter={v => [`${v}%`, 'Attendance']}
                    />
                    <Line type="monotone" dataKey="pct" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
            }
          </Card>

          {/* Grade distribution */}
          <Card title="Grade distribution">
            {distrib.length === 0
              ? <p className="text-sm text-gray-400 py-8 text-center">No grade data yet</p>
              : <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={distrib} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ef" />
                    <XAxis dataKey="grade" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {distrib.map(entry => (
                        <Cell key={entry.grade} fill={GRADE_COLORS[entry.grade] || '#6b7280'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
            }
          </Card>

          {/* Class performance by subject */}
          <Card title="Average score by subject" className="col-span-2">
            {perf.length === 0
              ? <p className="text-sm text-gray-400 py-8 text-center">No performance data yet</p>
              : <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={perf} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ef" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis type="category" dataKey="subject" tick={{ fontSize: 11, fill: '#6b7280' }} width={56} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      formatter={v => [`${v}%`, 'Average score']}
                    />
                    <Bar dataKey="avg" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                      {perf.map(entry => (
                        <Cell key={entry.subject}
                          fill={entry.avg >= 70 ? '#22c55e' : entry.avg >= 55 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
            }
          </Card>

        </div>
      )}
    </div>
  );
}
