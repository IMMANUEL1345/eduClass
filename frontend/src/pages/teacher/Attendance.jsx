import React, { useEffect, useState } from 'react';
import { classAPI, attendanceAPI } from '../../api';
import { PageHeader, Card, Button, Select, Badge, Spinner } from '../../components/ui';
import toast from 'react-hot-toast';

const STATUS_COLOR  = { present: 'green', late: 'amber', absent: 'red', excused: 'blue' };
const STATUS_LABEL  = { present: 'Present', late: 'Late', absent: 'Absent', excused: 'Excused' };
const STATUS_CYCLE  = ['present', 'late', 'absent', 'excused'];

export default function Attendance() {
  const today = new Date().toISOString().split('T')[0];

  const [classes,   setClasses]   = useState([]);
  const [subjects,  setSubjects]  = useState([]);
  const [students,  setStudents]  = useState([]);
  const [records,   setRecords]   = useState({});   // { studentId: status }
  const [classId,   setClassId]   = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [date,      setDate]      = useState(today);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    classAPI.list({}).then(({ data }) => setClasses(data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!classId) { setSubjects([]); setStudents([]); return; }
    classAPI.subjects(classId).then(({ data }) => setSubjects(data.data)).catch(() => {});
    classAPI.students(classId).then(({ data }) => {
      setStudents(data.data);
      // Default everyone to present
      const init = {};
      data.data.forEach(s => { init[s.id] = 'present'; });
      setRecords(init);
      setSubmitted(false);
    }).catch(() => {});
  }, [classId]);

  // Load existing attendance if switching date
  useEffect(() => {
    if (!subjectId || !date) return;
    setLoading(true);
    attendanceAPI.query({ subject_id: subjectId, date })
      .then(({ data }) => {
        if (data.data.length > 0) {
          const existing = {};
          data.data.forEach(r => { existing[r.student_id] = r.status; });
          setRecords(prev => ({ ...prev, ...existing }));
          setSubmitted(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [subjectId, date]);

  function toggleStatus(studentId) {
    setRecords(prev => {
      const current = prev[studentId] || 'present';
      const next    = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
      return { ...prev, [studentId]: next };
    });
  }

  function markAll(status) {
    const updated = {};
    students.forEach(s => { updated[s.id] = status; });
    setRecords(updated);
  }

  async function handleSubmit() {
    if (!subjectId) return toast.error('Select a subject first');
    const payload = students.map(s => ({ student_id: s.id, status: records[s.id] || 'present' }));
    setSaving(true);
    try {
      await attendanceAPI.mark({ subject_id: parseInt(subjectId), date, records: payload });
      toast.success('Attendance saved');
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  }

  const presentCount = Object.values(records).filter(s => s === 'present').length;
  const absentCount  = Object.values(records).filter(s => s === 'absent').length;

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Mark and review student attendance" />

      {/* Controls */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <Select value={classId} onChange={e => setClassId(e.target.value)} className="w-44">
          <option value="">Select class…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </Select>

        <Select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="w-44" disabled={!classId}>
          <option value="">Select subject…</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>

        <input
          type="date" value={date} onChange={e => setDate(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {students.length === 0 && (
        <Card>
          <p className="text-sm text-gray-400 py-8 text-center">Select a class to load students</p>
        </Card>
      )}

      {students.length > 0 && (
        <Card>
          {/* Summary + bulk actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-4 text-sm">
              <span className="text-green-600 font-medium">{presentCount} present</span>
              <span className="text-red-500 font-medium">{absentCount} absent</span>
              <span className="text-gray-400">{students.length} total</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => markAll('present')}>All present</Button>
              <Button size="sm" onClick={() => markAll('absent')}>All absent</Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : (
            <div className="divide-y divide-gray-50">
              {students.map(student => {
                const status = records[student.id] || 'present';
                return (
                  <div key={student.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{student.name}</p>
                      <p className="text-xs text-gray-400">{student.student_number}</p>
                    </div>
                    <button
                      onClick={() => toggleStatus(student.id)}
                      className="focus:outline-none"
                      title="Click to cycle: Present → Late → Absent → Excused"
                    >
                      <Badge color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Badge>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Submit */}
          <div className="mt-5 flex items-center justify-between">
            {submitted && (
              <p className="text-xs text-green-600">Attendance already recorded — saving will update it.</p>
            )}
            <div className="ml-auto">
              <Button variant="primary" loading={saving} onClick={handleSubmit} disabled={!subjectId}>
                {submitted ? 'Update attendance' : 'Submit attendance'}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
