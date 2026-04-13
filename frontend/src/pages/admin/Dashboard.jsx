import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsAPI, commsAPI } from '../../api';
import { StatCard, Card, PageHeader, Badge, Spinner } from '../../components/ui';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [overview,       setOverview]       = useState(null);
  const [trend,          setTrend]          = useState([]);
  const [announcements,  setAnnouncements]  = useState([]);
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [ov, tr, ann] = await Promise.all([
          analyticsAPI.overview(),
          analyticsAPI.attendanceTrend({}),
          commsAPI.announcements(),
        ]);
        setOverview(ov.data.data);
        setTrend(tr.data.data.slice(-7));        // last 7 days
        setAnnouncements(ann.data.data.slice(0, 5));
      } catch {
        toast.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const barColor = (pct) => {
    if (pct >= 85) return 'bg-green-400';
    if (pct >= 70) return 'bg-amber-400';
    return 'bg-red-400';
  };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="School overview"
        action={
          <button
            onClick={() => navigate('/announcements/new')}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            + Announcement
          </button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total students"   value={overview?.students ?? '—'}          sub="Active enrolments"      color="blue"   />
        <StatCard label="Teachers"         value={overview?.teachers ?? '—'}          sub="Active staff"           color="green"  />
        <StatCard label="Classes"          value={overview?.classes  ?? '—'}          sub="This academic year"     color="purple" />
        <StatCard label="Attendance today" value={`${overview?.attendance_today ?? 0}%`} sub="School-wide average"  color={overview?.attendance_today >= 80 ? 'green' : 'amber'} />
      </div>

      <div className="grid grid-cols-2 gap-5">

        {/* Attendance trend — last 7 days */}
        <Card title="Attendance — last 7 days">
          {trend.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No data yet</p>
          ) : (
            <div className="space-y-2.5 mt-1">
              {trend.map((d) => (
                <div key={d.date} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-20 flex-shrink-0">
                    {new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${barColor(d.pct)}`}
                      style={{ width: `${d.pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-500 w-8 text-right">{d.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent announcements */}
        <Card
          title="Recent announcements"
          action={
            <button onClick={() => navigate('/announcements')} className="text-xs text-blue-600 hover:underline">
              View all
            </button>
          }
        >
          {announcements.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No announcements yet</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {announcements.map((a) => (
                <div key={a.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-700 leading-tight">{a.title}</p>
                    <Badge color={a.target_role === 'all' ? 'gray' : 'blue'}>
                      {a.target_role}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {a.author_name} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>

      {/* Quick actions */}
      <div className="mt-5">
        <p className="text-xs font-medium text-gray-400 mb-3">Quick actions</p>
        <div className="flex gap-3">
          {[
            { label: 'Add student',    path: '/students/new'  },
            { label: 'Add teacher',    path: '/teachers/new'  },
            { label: 'Add class',      path: '/classes/new'   },
            { label: 'Generate reports', path: '/reports/generate' },
            { label: 'View absentees', path: '/attendance/absentees' },
          ].map((a) => (
            <button
              key={a.path}
              onClick={() => navigate(a.path)}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg bg-white
                         text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}