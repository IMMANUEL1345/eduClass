import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import { teacherAPI, commsAPI } from '../../api';
import { StatCard, Card, Badge, PageHeader, Spinner } from '../../components/ui';
import toast from 'react-hot-toast';

export default function TeacherDashboard() {
  const user     = useSelector(selectUser);
  const navigate = useNavigate();

  const [classes,       setClasses]       = useState([]);
  const [subjects,      setSubjects]      = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [messages,      setMessages]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [teacherId,     setTeacherId]     = useState(null);

  useEffect(() => {
    async function load() {
      try {
        // Get teacher record by matching logged-in user
        const { data: tList } = await teacherAPI.list({});
        const myRecord = tList.data.find(t => t.email === user.email);

        if (myRecord) {
          setTeacherId(myRecord.id);
          const [cls, subs, ann, msgs] = await Promise.all([
            teacherAPI.classes(myRecord.id),
            teacherAPI.subjects(myRecord.id),
            commsAPI.announcements(),
            commsAPI.inbox(),
          ]);
          setClasses(cls.data.data);
          setSubjects(subs.data.data);
          setAnnouncements(ann.data.data.slice(0, 4));
          setMessages(msgs.data.data.messages.filter(m => !m.is_read).slice(0, 5));
        }
      } catch { toast.error('Failed to load dashboard'); }
      finally { setLoading(false); }
    }
    load();
  }, [user.email]);

  const totalStudents = classes.reduce((sum, c) => sum + parseInt(c.student_count || 0), 0);
  const unread        = messages.length;

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div>
      <PageHeader
        title={`Good morning, ${user.name.split(' ')[0]}`}
        subtitle={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="My classes"     value={classes.length}   color="blue"   sub="Assigned this year"    />
        <StatCard label="My subjects"    value={subjects.length}  color="teal"   sub="Across all classes"    />
        <StatCard label="My students"    value={totalStudents}    color="purple" sub="Total enrolled"        />
        <StatCard label="Unread messages" value={unread}          color={unread > 0 ? 'amber' : 'green'} sub={unread > 0 ? 'Needs attention' : 'All caught up'} />
      </div>

      <div className="grid grid-cols-2 gap-5">

        {/* My classes */}
        <Card title="My classes"
          action={<button onClick={() => navigate('/attendance')} className="text-xs text-blue-600 hover:underline">Mark attendance</button>}>
          {classes.length === 0
            ? <p className="text-sm text-gray-400 py-4 text-center">No classes assigned yet</p>
            : classes.map(c => (
                <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{c.name} {c.section}</p>
                    <p className="text-xs text-gray-400">{c.academic_year}</p>
                  </div>
                  <Badge color="purple">{c.student_count} students</Badge>
                </div>
              ))
          }
        </Card>

        {/* My subjects */}
        <Card title="My subjects"
          action={<button onClick={() => navigate('/grades')} className="text-xs text-blue-600 hover:underline">Enter grades</button>}>
          {subjects.length === 0
            ? <p className="text-sm text-gray-400 py-4 text-center">No subjects assigned yet</p>
            : subjects.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.class_name} {s.section}</p>
                  </div>
                  <span className="text-xs text-gray-400">{s.periods_per_week}×/week</span>
                </div>
              ))
          }
        </Card>

        {/* Unread messages */}
        <Card title="Unread messages"
          action={<button onClick={() => navigate('/messages')} className="text-xs text-blue-600 hover:underline">View all</button>}>
          {messages.length === 0
            ? <p className="text-sm text-gray-400 py-4 text-center">No unread messages</p>
            : messages.map(m => (
                <div key={m.id}
                  onClick={() => navigate('/messages')}
                  className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 -mx-1 px-1 rounded">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center
                                  text-xs font-medium flex-shrink-0 mt-0.5">
                    {m.sender_name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{m.sender_name}</p>
                    <p className="text-xs text-gray-400 truncate">{m.subject}</p>
                  </div>
                </div>
              ))
          }
        </Card>

        {/* Announcements */}
        <Card title="Announcements"
          action={<button onClick={() => navigate('/announcements')} className="text-xs text-blue-600 hover:underline">View all</button>}>
          {announcements.length === 0
            ? <p className="text-sm text-gray-400 py-4 text-center">No announcements</p>
            : announcements.map(a => (
                <div key={a.id} className="py-2.5 border-b border-gray-50 last:border-0">
                  <p className="text-sm font-medium text-gray-700 leading-tight">{a.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{a.author_name} ·{' '}
                    {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              ))
          }
        </Card>
      </div>

      {/* Quick actions */}
      <div className="mt-5">
        <p className="text-xs font-medium text-gray-400 mb-3">Quick actions</p>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: 'Mark attendance',  path: '/attendance'    },
            { label: 'Enter grades',     path: '/grades'        },
            { label: 'View reports',     path: '/reports'       },
            { label: 'Send message',     path: '/messages'      },
            { label: 'Announcement',     path: '/announcements' },
          ].map(a => (
            <button key={a.path} onClick={() => navigate(a.path)}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg bg-white
                         text-gray-600 hover:bg-gray-50 transition-colors">
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}