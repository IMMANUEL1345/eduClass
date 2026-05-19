import React, { useEffect, useState, useCallback } from 'react';
import { classAPI, teacherAPI } from '../../api';
import api from '../../api';
import { PageHeader, Card, Button, Select, Badge, Spinner } from '../../components/ui';
import toast from 'react-hot-toast';

export default function SubjectTeacherAssignment() {
  const [classes,    setClasses]    = useState([]);
  const [teachers,   setTeachers]   = useState([]);
  const [subjects,   setSubjects]   = useState([]);
  const [selClass,   setSelClass]   = useState('');
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState({});
  const [progress,   setProgress]   = useState(null);

  useEffect(() => {
    classAPI.list({}).then(({ data }) => setClasses(data.data)).catch(() => {});
    teacherAPI.list({}).then(({ data }) => setTeachers(data.data)).catch(() => {});
  }, []);

  const loadSubjects = useCallback(async (classId) => {
    if (!classId) { setSubjects([]); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/classes/${classId}/subjects`);
      setSubjects(data.data);
    } catch { toast.error('Failed to load subjects'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSubjects(selClass); }, [selClass]);

  async function assignTeacher(subjectId, teacherUserId) {
    setSaving(p => ({ ...p, [subjectId]: true }));
    try {
      await api.put(`/subjects/${subjectId}`, { teacher_id: teacherUserId || null });
      setSubjects(prev => prev.map(s =>
        s.id === subjectId
          ? { ...s, teacher_id: teacherUserId || null,
              teacher_name: teachers.find(t => t.id === parseInt(teacherUserId))?.name || null }
          : s
      ));
      toast.success('Teacher assigned');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(p => ({ ...p, [subjectId]: false })); }
  }

  // Bulk assign all subjects across all classes
  async function handleBulkAutoAssign() {
    if (!window.confirm('Auto-assign teachers to all unassigned subjects based on their specialization? This will only fill subjects with NO teacher yet.')) return;

    const specMap = {
      'English Language':            ['English Language', 'english'],
      'Mathematics':                 ['Mathematics', 'mathematics'],
      'Integrated Science':          ['Integrated Science', 'science'],
      'Science':                     ['Science', 'science'],
      'Social Studies':              ['Social Studies', 'social'],
      'History':                     ['History', 'social studies'],
      'Our World Our People':        ['Science', 'environmental'],
      'Ghanaian Language':           ['Ghanaian Language', 'ghanaian'],
      'Ghanaian Language & Culture': ['Ghanaian Language', 'ghanaian'],
      'Religious & Moral Education': ['Religious', 'rme', 'moral'],
      'Creative Arts':               ['Creative Arts', 'creative'],
      'Physical Education':          ['Physical Education', 'pe', 'physical'],
      'Computing (ICT)':             ['Computing', 'ict', 'information technology'],
      'French':                      ['French', 'french'],
      'Design & Technology':         ['Design', 'technology'],
      'Language & Literacy':         ['English', 'literacy', 'early childhood'],
      'Number Work':                 ['Mathematics', 'early childhood'],
      'Environmental Studies':       ['Science', 'environmental', 'early childhood'],
    };

    setProgress({ total: 0, done: 0, msg: 'Starting...' });

    try {
      const { data: allClasses } = await classAPI.list({});
      let total = 0; let done = 0;

      for (const cls of allClasses.data) {
        const { data: subjData } = await api.get(`/classes/${cls.id}/subjects`);
        const unassigned = subjData.data.filter(s => !s.teacher_id);
        total += unassigned.length;
      }

      setProgress({ total, done: 0, msg: `Assigning ${total} subjects…` });

      for (const cls of allClasses.data) {
        const { data: subjData } = await api.get(`/classes/${cls.id}/subjects`);
        const unassigned = subjData.data.filter(s => !s.teacher_id);

        for (const subj of unassigned) {
          // Find best matching teacher by specialization
          const keywords = specMap[subj.name] || [subj.name.toLowerCase()];
          const match = teachers.find(t =>
            keywords.some(kw =>
              (t.specialization || '').toLowerCase().includes(kw.toLowerCase())
            )
          );
          if (match) {
            await api.put(`/subjects/${subj.id}`, { teacher_id: match.id }).catch(() => {});
          }
          done++;
          setProgress({ total, done, msg: `Assigned ${done} of ${total}…` });
        }
      }

      setProgress(null);
      toast.success(`Bulk assignment complete! ${done} subjects processed.`);
      if (selClass) loadSubjects(selClass);
    } catch (err) {
      setProgress(null);
      toast.error('Bulk assignment failed');
    }
  }

  const assigned   = subjects.filter(s => s.teacher_id).length;
  const unassigned = subjects.filter(s => !s.teacher_id).length;

  return (
    <div>
      <PageHeader
        title="Assign teachers to subjects"
        subtitle="Assign teachers class by class or use bulk auto-assign"
        action={
          <Button variant="primary" onClick={handleBulkAutoAssign}>
            ⚡ Bulk auto-assign all classes
          </Button>
        }
      />

      {/* Progress banner */}
      {progress && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-700">{progress.msg}</p>
            {progress.total > 0 && (
              <div className="mt-1.5 bg-blue-200 rounded-full h-1.5">
                <div className="bg-blue-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.round(progress.done / progress.total * 100)}%` }} />
              </div>
            )}
          </div>
          <span className="text-xs text-blue-500 font-medium">
            {progress.total > 0 ? `${Math.round(progress.done / progress.total * 100)}%` : ''}
          </span>
        </div>
      )}

      {/* How it works */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-5">
        <p className="text-sm font-medium text-amber-700 mb-1">⚡ Bulk auto-assign</p>
        <p className="text-xs text-amber-600">
          Matches teachers to subjects based on their specialization. Only fills subjects that have no teacher yet.
          You can then adjust individual assignments below if needed.
        </p>
      </div>

      {/* Class selector */}
      <div className="flex gap-3 mb-5 items-center">
        <Select value={selClass} onChange={e => setSelClass(e.target.value)} className="w-52">
          <option value="">Select a class to review…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </Select>
        {selClass && subjects.length > 0 && (
          <div className="flex gap-2">
            <span className="bg-green-100 text-green-700 text-xs font-medium px-3 py-1.5 rounded-full">
              {assigned} assigned
            </span>
            <span className="bg-red-100 text-red-600 text-xs font-medium px-3 py-1.5 rounded-full">
              {unassigned} unassigned
            </span>
          </div>
        )}
      </div>

      {/* Subject list */}
      {!selClass ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center">
          <p className="text-3xl mb-3">📚</p>
          <p className="text-gray-500 text-sm font-medium mb-1">Select a class to view its subjects</p>
          <p className="text-gray-400 text-xs">Or click ⚡ Bulk auto-assign to assign all classes at once</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : subjects.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
          <p className="text-gray-400 text-sm">No subjects found for this class.</p>
          <p className="text-xs text-gray-300 mt-1">Add subjects from the Classes page first.</p>
        </div>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Subject</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 w-24">Code</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 w-20">Periods/wk</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 w-64">Assigned teacher</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map(s => (
                <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-700">{s.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{s.code || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.periods_per_week}×</td>
                  <td className="px-4 py-3">
                    <Select
                      value={s.teacher_id || ''}
                      onChange={e => assignTeacher(s.id, e.target.value)}
                      className="w-full text-sm"
                      disabled={saving[s.id]}
                    >
                      <option value="">— No teacher assigned —</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.specialization || 'General'})</option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    {saving[s.id] ? (
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    ) : s.teacher_id ? (
                      <Badge color="green">Assigned</Badge>
                    ) : (
                      <Badge color="red">Missing</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}