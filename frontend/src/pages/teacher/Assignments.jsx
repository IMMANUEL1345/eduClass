import React, { useEffect, useState, useCallback } from 'react';
import { assignmentAPI, classAPI } from '../../api';
import api from '../../api';
import { PageHeader, Card, Button, Input, Select, Badge, Spinner } from '../../components/ui';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import toast from 'react-hot-toast';
import { formatDistanceToNow, isPast, format } from 'date-fns';

const STATUS_COLOR = { active:'green', draft:'gray', closed:'red' };

export default function TeacherAssignments() {
  const user = useSelector(selectUser);
  const [assignments, setAssignments]   = useState([]);
  const [classes,     setClasses]       = useState([]);
  const [subjects,    setSubjects]      = useState([]);
  const [loading,     setLoading]       = useState(true);
  const [showForm,    setShowForm]      = useState(false);
  const [selected,    setSelected]      = useState(null);
  const [submissions, setSubmissions]   = useState([]);
  const [subLoading,  setSubLoading]    = useState(false);
  const [saving,      setSaving]        = useState(false);
  const [gradingId,   setGradingId]     = useState(null);
  const [gradeForm,   setGradeForm]     = useState({ score:'', feedback:'' });

  const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear()+1}`;
  const [form, setForm] = useState({
    title:'', description:'', class_id:'', subject_id:'',
    due_date: new Date(Date.now()+7*24*60*60*1000).toISOString().split('T')[0],
    due_time:'23:59', term:'Term 1', academic_year: CURRENT_YEAR,
    max_score:100, status:'active',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await assignmentAPI.list({});
      setAssignments(data.data);
    } catch { toast.error('Failed to load assignments'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    classAPI.list({}).then(({ data }) => setClasses(data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.class_id) { setSubjects([]); return; }
    api.get(`/classes/${form.class_id}/subjects`)
      .then(({ data }) => setSubjects(data.data)).catch(() => {});
  }, [form.class_id]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.title || !form.class_id || !form.due_date)
      return toast.error('Title, class and due date required');
    setSaving(true);
    try {
      await assignmentAPI.create(form);
      toast.success('Assignment created and students notified');
      setShowForm(false);
      setForm({ title:'', description:'', class_id:'', subject_id:'',
        due_date: new Date(Date.now()+7*24*60*60*1000).toISOString().split('T')[0],
        due_time:'23:59', term:'Term 1', academic_year: CURRENT_YEAR,
        max_score:100, status:'active' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  }

  async function openSubmissions(a) {
    setSelected(a);
    setSubLoading(true);
    try {
      const { data } = await assignmentAPI.getSubmissions(a.id);
      setSubmissions(data.data);
    } catch { toast.error('Failed to load submissions'); }
    finally { setSubLoading(false); }
  }

  async function handleGrade(subId) {
    if (!gradeForm.score && gradeForm.score !== 0) return toast.error('Enter a score');
    setSaving(true);
    try {
      await assignmentAPI.grade(selected.id, subId, gradeForm);
      toast.success('Graded successfully');
      setGradingId(null);
      setGradeForm({ score:'', feedback:'' });
      openSubmissions(selected);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this assignment?')) return;
    try {
      await assignmentAPI.remove(id);
      toast.success('Deleted');
      load();
    } catch { toast.error('Failed to delete'); }
  }

  const submitted = submissions.filter(s => s.submission_id).length;
  const notSubmitted = submissions.filter(s => !s.submission_id).length;

  return (
    <div>
      <PageHeader title="Assignments"
        subtitle={`${assignments.length} assignment${assignments.length !== 1 ? 's' : ''}`}
        action={<Button variant="primary" onClick={() => setShowForm(true)}>+ Create assignment</Button>}
      />

      <div className="flex gap-5">
        {/* Assignment list */}
        <div className="flex-1 min-w-0">
          {loading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : (
            assignments.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center">
                <p className="text-3xl mb-3">📝</p>
                <p className="text-gray-500 text-sm">No assignments yet</p>
                <p className="text-gray-400 text-xs mt-1">Create your first assignment for your class</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {assignments.map(a => {
                  const deadline = new Date(`${a.due_date}T${a.due_time}`);
                  const overdue  = isPast(deadline) && a.status === 'active';
                  return (
                    <div key={a.id}
                      onClick={() => openSubmissions(a)}
                      className={`bg-white border rounded-2xl p-4 cursor-pointer hover:shadow-sm transition-all
                        ${selected?.id === a.id ? 'border-blue-300 shadow-sm' : 'border-gray-100'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge color={STATUS_COLOR[a.status]}>{a.status}</Badge>
                            {overdue && <Badge color="red">Overdue</Badge>}
                            {a.subject_name && <span className="text-xs text-gray-400">{a.subject_name}</span>}
                          </div>
                          <p className="text-sm font-semibold text-gray-800 truncate">{a.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {a.class_name} {a.section} · Due {format(new Date(a.due_date), 'dd MMM yyyy')} at {a.due_time?.slice(0,5)}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-bold text-gray-700">{a.submission_count}</p>
                          <p className="text-xs text-gray-400">submitted</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-50">
                        <span className="text-xs text-gray-400">Max score: {a.max_score}</span>
                        <button onClick={e => { e.stopPropagation(); handleDelete(a.id); }}
                          className="text-xs text-red-400 hover:underline">Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Submissions panel */}
        {selected && (
          <div className="w-80 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 truncate">{selected.title}</h2>
              <button onClick={() => setSelected(null)} className="text-xs text-gray-400">✕</button>
            </div>
            <div className="flex gap-2 mb-3">
              <div className="flex-1 bg-green-50 border border-green-100 rounded-xl p-2 text-center">
                <p className="text-lg font-bold text-green-600">{submitted}</p>
                <p className="text-xs text-green-500">Submitted</p>
              </div>
              <div className="flex-1 bg-red-50 border border-red-100 rounded-xl p-2 text-center">
                <p className="text-lg font-bold text-red-500">{notSubmitted}</p>
                <p className="text-xs text-red-400">Not submitted</p>
              </div>
            </div>
            {subLoading ? <div className="flex justify-center py-10"><Spinner /></div> : (
              <div className="flex flex-col gap-2">
                {submissions.map(s => (
                  <div key={s.student_id}
                    className="bg-white border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-700 truncate">{s.student_name}</p>
                      {s.submission_id
                        ? <Badge color={s.submission_status==='graded'?'green':s.submission_status==='late'?'amber':'blue'}>
                            {s.submission_status}
                          </Badge>
                        : <Badge color="gray">Not submitted</Badge>
                      }
                    </div>
                    {s.submission_id && (
                      <>
                        <p className="text-xs text-gray-400 mb-2 line-clamp-2">{s.submission_text}</p>
                        {s.submission_status === 'graded' ? (
                          <p className="text-xs text-green-600 font-medium">Score: {s.score}/{selected.max_score}</p>
                        ) : (
                          gradingId === s.submission_id ? (
                            <div className="flex flex-col gap-1.5 mt-2">
                              <div className="flex gap-1.5">
                                <input type="number" placeholder="Score" min={0} max={selected.max_score}
                                  value={gradeForm.score}
                                  onChange={e => setGradeForm(p=>({...p,score:e.target.value}))}
                                  className="w-20 px-2 py-1 text-xs border border-gray-200 rounded-lg" />
                                <input placeholder="Feedback (optional)"
                                  value={gradeForm.feedback}
                                  onChange={e => setGradeForm(p=>({...p,feedback:e.target.value}))}
                                  className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg" />
                              </div>
                              <div className="flex gap-1.5">
                                <button onClick={() => handleGrade(s.submission_id)}
                                  className="flex-1 text-xs bg-green-500 text-white rounded-lg py-1.5 font-medium">
                                  {saving ? '...' : 'Save grade'}
                                </button>
                                <button onClick={() => setGradingId(null)}
                                  className="text-xs text-gray-400 px-2">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => { setGradingId(s.submission_id); setGradeForm({score:'',feedback:''}); }}
                              className="text-xs text-blue-600 hover:underline mt-1">
                              Grade submission
                            </button>
                          )
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-medium text-gray-800 mb-5">Create assignment</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <Input label="Title *" value={form.title}
                onChange={e => setForm(p=>({...p,title:e.target.value}))} placeholder="e.g. Chapter 3 Exercise" />
              <Select label="Class *" value={form.class_id}
                onChange={e => setForm(p=>({...p,class_id:e.target.value}))}>
                <option value="">Select class…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
              </Select>
              <Select label="Subject" value={form.subject_id}
                onChange={e => setForm(p=>({...p,subject_id:e.target.value}))}>
                <option value="">Select subject…</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Description / Instructions</label>
                <textarea rows={4} value={form.description}
                  onChange={e => setForm(p=>({...p,description:e.target.value}))}
                  placeholder="Write the assignment instructions here…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none
                             focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Due date *" type="date" value={form.due_date}
                  onChange={e => setForm(p=>({...p,due_date:e.target.value}))} />
                <Input label="Due time" type="time" value={form.due_time}
                  onChange={e => setForm(p=>({...p,due_time:e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Term" value={form.term}
                  onChange={e => setForm(p=>({...p,term:e.target.value}))}>
                  {['Term 1','Term 2','Term 3'].map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
                <Input label="Max score" type="number" value={form.max_score}
                  onChange={e => setForm(p=>({...p,max_score:parseInt(e.target.value)}))} />
              </div>
              <Select label="Status" value={form.status}
                onChange={e => setForm(p=>({...p,status:e.target.value}))}>
                <option value="active">Active — visible to students</option>
                <option value="draft">Draft — hidden from students</option>
              </Select>
              <div className="flex justify-end gap-3 mt-2">
                <Button type="button" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" variant="primary" loading={saving}>Create & notify students</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}