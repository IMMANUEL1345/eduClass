import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsAPI, commsAPI } from '../../api';
import { StatCard, Card, PageHeader, Badge, Spinner } from '../../components/ui';
import { formatDistanceToNow } from 'date-fns';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [overview,      setOverview]      = useState(null);
  const [trend,         setTrend]         = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const ov = await analyticsAPI.overview();
        setOverview(ov.data.data);
      } catch {}
      try {
        const tr = await analyticsAPI.attendanceTrend({});
        setTrend(tr.data.data.slice(-7));
      } catch {}
      try {
        const ann = await commsAPI.announcements();
        setAnnouncements(ann.data.data.slice(0, 5));
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const barColor = (pct) => pct >= 85 ? 'bg-green-400' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="School overview"
        action={
          <button onClick={() => navigate('/announcements')}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            + Announcement
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard label="Total students"   value={overview?.students ?? 0}               color="blue"   sub="Active enrolments"  />
            <StatCard label="Teachers"         value={overview?.teachers ?? 0}               color="green"  sub="Active staff"       />
            <StatCard label="Classes"          value={overview?.classes  ?? 0}               color="purple" sub="This academic year"  />
            <StatCard label="Attendance today" value={`${overview?.attendance_today ?? 0}%`} color={overview?.attendance_today >= 80 ? 'green' : 'amber'} sub="School-wide" />
          </div>

          <div className="grid grid-cols-2 gap-5 mb-5">
            <Card title="Attendance — last 7 days">
              {trend.length === 0
                ? <p className="text-sm text-gray-400 py-4 text-center">No attendance data yet</p>
                : <div className="space-y-2.5 mt-1">
                    {trend.map((d) => (
                      <div key={d.date} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-20 flex-shrink-0">
                          {new Date(d.date).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' })}
                        </span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-2 rounded-full ${barColor(d.pct)}`} style={{ width:`${d.pct}%` }} />
                        </div>
                        <span className="text-xs font-medium text-gray-500 w-8 text-right">{d.pct}%</span>
                      </div>
                    ))}
                  </div>
              }
            </Card>

            <Card title="Recent announcements"
              action={<button onClick={() => navigate('/announcements')} className="text-xs text-blue-600 hover:underline">View all</button>}>
              {announcements.length === 0
                ? <p className="text-sm text-gray-400 py-4 text-center">No announcements yet</p>
                : <div className="divide-y divide-gray-50">
                    {announcements.map((a) => (
                      <div key={a.id} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-700 leading-tight">{a.title}</p>
                          <Badge color={a.target_role === 'all' ? 'gray' : 'blue'}>{a.target_role}</Badge>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {a.author_name} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    ))}
                  </div>
              }
            </Card>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-400 mb-3">Quick actions</p>
            <div className="flex gap-3 flex-wrap">
              {[
                { label: '+ Add student',      path: '/students'      },
                { label: '+ Add teacher',      path: '/teachers'      },
                { label: '+ Add class',        path: '/classes'       },
                { label: 'Attendance',         path: '/attendance'    },
                { label: 'Grades',             path: '/grades'        },
                { label: 'Generate reports',   path: '/reports'       },
                { label: 'Analytics',          path: '/analytics'     },
              ].map((a) => (
                <button key={a.path} onClick={() => navigate(a.path)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 transition-colors">
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}