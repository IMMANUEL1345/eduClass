import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import { studentAPI, commsAPI, analyticsAPI } from '../../api';
import { StatCard, Card, Badge, PageHeader, Spinner } from '../../components/ui';
import { gradeColor } from '../../utils/grades';
import toast from 'react-hot-toast';

export default function StudentDashboard() {
  const user = useSelector(selectUser);
  const [grades,         setGrades]         = useState([]);
  const [attSummary,     setAttSummary]     = useState(null);
  const [announcements,  setAnnouncements]  = useState([]);
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Student's own user.id maps to a student profile
        // In production, /students/me would return their own student record
        const [ann] = await Promise.all([
          commsAPI.announcements(),
        ]);
        setAnnouncements(ann.data.data.slice(0, 4));
      } catch { toast.error('Failed to load dashboard'); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const dayName = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div>
      <PageHeader
        title={`Good morning, ${user?.name?.split(' ')[0]}`}
        subtitle={`${dayName}, ${dateStr}`}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-5 w-1/2">
        <StatCard label="My attendance"  value={attSummary ? `${attSummary.summary.percentage}%` : '—'} color="green" sub="This term" />
        <StatCard label="Average score"  value="—" color="blue" sub="All subjects" />
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Announcements */}
        <Card title="Announcements">
          {announcements.length === 0
            ? <p className="text-sm text-gray-400 py-4 text-center">No announcements</p>
            : <div className="divide-y divide-gray-50">
                {announcements.map(a => (
                  <div key={a.id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium text-gray-700">{a.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{a.body}</p>
                    <p className="text-xs text-gray-300 mt-1">
                      {new Date(a.created_at).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                ))}
              </div>
          }
        </Card>

        {/* Recent grades placeholder */}
        <Card title="My recent grades">
          <p className="text-sm text-gray-400 py-4 text-center">
            View your grades in the Grades section
          </p>
        </Card>
      </div>
    </div>
  );
}
