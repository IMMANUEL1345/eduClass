import React, { useEffect, useState } from 'react';
import { assignmentAPI, studentAPI } from '../../api';
import { PageHeader, Card, Badge, Spinner } from '../../components/ui';
import { format, isPast } from 'date-fns';
import toast from 'react-hot-toast';

export default function ParentAssignments() {
  const [children,    setChildren]    = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [aLoading,    setALoading]    = useState(false);

  useEffect(() => {
    studentAPI.myChildren()
      .then(({ data }) => {
        setChildren(data.data);
        if (data.data.length > 0) loadAssignments(data.data[0]);
      })
      .catch(() => toast.error('Failed to load children'))
      .finally(() => setLoading(false));
  }, []);

  async function loadAssignments(child) {
    setSelected(child);
    setALoading(true);
    try {
      const { data } = await assignmentAPI.childList(child.id);
      setAssignments(data.data);
    } catch { toast.error('Failed to load assignments'); }
    finally { setALoading(false); }
  }

  const pending   = assignments.filter(a => !a.submission_id && !isPast(new Date(`${a.due_date}T${a.due_time}`))).length;
  const overdue   = assignments.filter(a => !a.submission_id && isPast(new Date(`${a.due_date}T${a.due_time}`))).length;
  const graded    = assignments.filter(a => a.submission_status === 'graded').length;

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div>
      <PageHeader title="Assignments" subtitle="Track your child's assignment progress" />

      {children.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {children.map(c => (
            <button key={c.id} onClick={() => loadAssignments(c)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors
                ${selected?.id===c.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label:'Pending',  value: pending, color:'blue'  },
          { label:'Overdue',  value: overdue, color:'red'   },
          { label:'Graded',   value: graded,  color:'green' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
            <p className={`text-2xl font-bold ${
              s.color==='blue'?'text-blue-600':s.color==='green'?'text-green-600':'text-red-500'}`}>
              {s.value}
            </p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {aLoading ? <div className="flex justify-center py-10"><Spinner /></div> : (
        assignments.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
            <p className="text-gray-400 text-sm">No assignments found for {selected?.name}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {assignments.map(a => {
              const deadline  = new Date(`${a.due_date}T${a.due_time}`);
              const isOverdue = isPast(deadline) && !a.submission_id;
              return (
                <div key={a.id} className="bg-white border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {a.subject_name && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">{a.subject_name}</span>}
                        {a.submission_id
                          ? <Badge color={a.submission_status==='graded'?'green':a.submission_status==='late'?'amber':'blue'}>
                              {a.submission_status}
                            </Badge>
                          : isOverdue
                            ? <Badge color="red">Not submitted (overdue)</Badge>
                            : <Badge color="gray">Pending</Badge>
                        }
                      </div>
                      <p className="text-sm font-semibold text-gray-800">{a.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {a.teacher_name} · Due {format(new Date(a.due_date), 'dd MMM yyyy')}
                      </p>
                    </div>
                    {a.score !== null && a.score !== undefined && (
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">{a.score}</p>
                        <p className="text-xs text-gray-400">/{a.max_score}</p>
                      </div>
                    )}
                  </div>
                  {a.feedback && (
                    <div className="mt-2 bg-blue-50 rounded-lg p-2">
                      <p className="text-xs text-blue-600">Teacher feedback: {a.feedback}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}