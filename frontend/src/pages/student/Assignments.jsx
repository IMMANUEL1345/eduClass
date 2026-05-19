import React, { useEffect, useState } from 'react';
import { assignmentAPI } from '../../api';
import { PageHeader, Card, Badge, Button, Spinner } from '../../components/ui';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_COLOR = {
  submitted: 'blue', graded: 'green', late: 'amber',
};

export default function StudentAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [text,        setText]        = useState('');
  const [filter,      setFilter]      = useState('pending'); // pending | submitted | all

  useEffect(() => {
    assignmentAPI.myList()
      .then(({ data }) => setAssignments(data.data))
      .catch(() => toast.error('Failed to load assignments'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return toast.error('Please write your submission');
    setSubmitting(true);
    try {
      const { data } = await assignmentAPI.submit(selected.id, { submission_text: text });
      toast.success(data.message || 'Submitted successfully');
      setText('');
      // Refresh
      const { data: fresh } = await assignmentAPI.myList();
      setAssignments(fresh.data);
      setSelected(fresh.data.find(a => a.id === selected.id));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit'); }
    finally { setSubmitting(false); }
  }

  const now = new Date();
  const filtered = assignments.filter(a => {
    const deadline = new Date(`${a.due_date}T${a.due_time}`);
    if (filter === 'pending')   return !a.submission_id && !isPast(deadline);
    if (filter === 'submitted') return !!a.submission_id;
    if (filter === 'overdue')   return !a.submission_id && isPast(deadline);
    return true;
  });

  const pending   = assignments.filter(a => !a.submission_id && !isPast(new Date(`${a.due_date}T${a.due_time}`))).length;
  const overdue   = assignments.filter(a => !a.submission_id && isPast(new Date(`${a.due_date}T${a.due_time}`))).length;
  const submitted = assignments.filter(a => !!a.submission_id).length;

  return (
    <div>
      <PageHeader title="My assignments" subtitle="View and submit your assignments" />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label:'Pending',   value: pending,   color:'blue',  key:'pending'   },
          { label:'Submitted', value: submitted,  color:'green', key:'submitted' },
          { label:'Overdue',   value: overdue,    color:'red',   key:'overdue'   },
        ].map(s => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            className={`rounded-2xl p-4 text-center border transition-all
              ${filter===s.key ? 'border-blue-300 bg-blue-50' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
            <p className={`text-2xl font-bold ${
              s.color==='blue'?'text-blue-600':s.color==='green'?'text-green-600':'text-red-500'}`}>
              {s.value}
            </p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-100 mb-5">
        {[
          { key:'pending',   label:'Pending'   },
          { key:'submitted', label:'Submitted' },
          { key:'overdue',   label:'Overdue'   },
          { key:'all',       label:'All'       },
        ].map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`px-4 py-2 text-sm transition-colors
              ${filter===t.key
                ? 'border-b-2 border-blue-600 text-blue-700 font-medium -mb-px'
                : 'text-gray-400 hover:text-gray-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : (
        <div className="flex gap-5">
          {/* List */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {filtered.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
                <p className="text-2xl mb-2">✅</p>
                <p className="text-gray-500 text-sm">
                  {filter==='pending' ? 'No pending assignments!' :
                   filter==='overdue' ? 'No overdue assignments!' :
                   'No assignments found'}
                </p>
              </div>
            ) : filtered.map(a => {
              const deadline = new Date(`${a.due_date}T${a.due_time}`);
              const overdue  = isPast(deadline) && !a.submission_id;
              const timeLeft = !isPast(deadline)
                ? `Due in ${formatDistanceToNow(deadline)}`
                : `${formatDistanceToNow(deadline)} ago`;

              return (
                <div key={a.id} onClick={() => { setSelected(a); setText(''); }}
                  className={`bg-white border rounded-2xl p-4 cursor-pointer transition-all hover:shadow-sm
                    ${selected?.id===a.id ? 'border-blue-300' : overdue ? 'border-red-100' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {a.subject_name && <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{a.subject_name}</span>}
                        {a.submission_id && <Badge color={STATUS_COLOR[a.submission_status]||'gray'}>{a.submission_status}</Badge>}
                        {overdue && <Badge color="red">Overdue</Badge>}
                      </div>
                      <p className="text-sm font-semibold text-gray-800">{a.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format(new Date(a.due_date), 'dd MMM yyyy')} at {a.due_time?.slice(0,5)} · {timeLeft}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {a.score !== null && a.score !== undefined
                        ? <span className="text-sm font-bold text-green-600">{a.score}/{a.max_score}</span>
                        : <span className="text-xs text-gray-400">{a.max_score} marks</span>
                      }
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detail / submission panel */}
          {selected && (
            <div className="w-80 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700">Assignment details</h2>
                <button onClick={() => setSelected(null)} className="text-xs text-gray-400">✕</button>
              </div>
              <Card className="mb-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">{selected.title}</h3>
                {selected.subject_name && <p className="text-xs text-blue-600 mb-2">{selected.subject_name}</p>}
                {selected.description && (
                  <p className="text-xs text-gray-600 leading-relaxed mb-3 whitespace-pre-wrap">
                    {selected.description}
                  </p>
                )}
                <div className="border-t border-gray-50 pt-2 mt-2">
                  {[
                    ['Teacher', selected.teacher_name],
                    ['Due', `${format(new Date(selected.due_date),'dd MMM yyyy')} at ${selected.due_time?.slice(0,5)}`],
                    ['Max score', selected.max_score],
                    ['Term', selected.term],
                  ].map(([k,v]) => (
                    <div key={k} className="flex justify-between py-1 text-xs">
                      <span className="text-gray-400">{k}</span>
                      <span className="text-gray-700 font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Already submitted */}
              {selected.submission_id ? (
                <Card>
                  <p className="text-xs font-medium text-gray-500 mb-2">Your submission</p>
                  <p className="text-xs text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap">
                    {selected.submission_text}
                  </p>
                  <p className="text-xs text-gray-400">
                    Submitted {formatDistanceToNow(new Date(selected.submitted_at), { addSuffix:true })}
                  </p>
                  {selected.score !== null && selected.score !== undefined && (
                    <div className="mt-3 bg-green-50 border border-green-100 rounded-xl p-3">
                      <p className="text-xs font-semibold text-green-700 mb-1">
                        Score: {selected.score}/{selected.max_score}
                      </p>
                      {selected.feedback && (
                        <p className="text-xs text-green-600">{selected.feedback}</p>
                      )}
                    </div>
                  )}
                </Card>
              ) : (
                /* Submit form */
                (() => {
                  const deadline = new Date(`${selected.due_date}T${selected.due_time}`);
                  const isOverdue = isPast(deadline);
                  return (
                    <Card>
                      <p className="text-xs font-medium text-gray-500 mb-3">
                        {isOverdue ? '⚠️ This assignment is overdue. You can still submit but it will be marked late.' : 'Write your submission below:'}
                      </p>
                      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                        <textarea rows={6} value={text} onChange={e => setText(e.target.value)}
                          placeholder="Write your answer here…"
                          className={`w-full px-3 py-2 text-sm border rounded-lg resize-none
                                     focus:outline-none focus:ring-2 focus:ring-blue-500
                                     ${isOverdue ? 'border-amber-200' : 'border-gray-200'}`} />
                        <Button type="submit" variant="primary" loading={submitting} className="w-full">
                          {isOverdue ? 'Submit (late)' : 'Submit assignment'}
                        </Button>
                      </form>
                    </Card>
                  );
                })()
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}