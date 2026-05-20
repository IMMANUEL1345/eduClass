import React, { useEffect, useState, useCallback } from 'react';
import { classAPI, teacherAPI } from '../../api';
import api from '../../api';
import { PageHeader, Card, Button, Select, Badge, Spinner } from '../../components/ui';
import toast from 'react-hot-toast';

// Keyword matching: subject name → specialization keywords
const SPEC_MAP = {
  'English Language':            ['english language', 'english'],
  'Mathematics':                 ['mathematics'],
  'Integrated Science':          ['integrated science'],
  'Science':                     ['science & environmental', 'science'],
  'Our World Our People':        ['environmental', 'science', 'owop'],
  'Social Studies':              ['social studies'],
  'History':                     ['history', 'social studies'],
  'Ghanaian Language':           ['ghanaian language'],
  'Ghanaian Language & Culture': ['ghanaian language'],
  'Religious & Moral Education': ['religious & moral', 'religious', 'moral'],
  'Creative Arts':               ['creative arts'],
  'Physical Education':          ['physical education'],
  'Computing (ICT)':             ['information technology', 'computing', 'ict'],
  'French':                      ['french'],
  'Design & Technology':         ['design & technology'],
  'Language & Literacy':         ['early childhood', 'english language', 'english'],
  'Number Work':                 ['early childhood', 'mathematics'],
  'Environmental Studies':       ['early childhood', 'science & environmental'],
  'Movement & Drama':            ['creative arts', 'physical education', 'early childhood'],
  'Social Development':          ['early childhood'],
  'Language Play':               ['early childhood'],
};

function matchTeacher(subjectName, teachers) {
  const keywords = SPEC_MAP[subjectName] ||
    [subjectName.toLowerCase().replace(/[^a-z0-9 ]/g,'').trim()];

  // Priority: exact or first keyword match (most specific first)
  for (const kw of keywords) {
    const match = teachers.find(t =>
      (t.specialization || '').toLowerCase().includes(kw)
    );
    if (match) return match;
  }
  return null;
}

export default function SubjectTeacherAssignment() {
  const [classes,   setClasses]   = useState([]);
  const [teachers,  setTeachers]  = useState([]);
  const [subjects,  setSubjects]  = useState([]);
  const [selClass,  setSelClass]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState({});
  const [progress,  setProgress]  = useState(null);
  const [errors,    setErrors]    = useState([]);

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

  useEffect(() => { loadSubjects(selClass); }, [selClass, loadSubjects]);

  async function assignTeacher(subjectId, teacherId) {
    setSaving(p => ({ ...p, [subjectId]: true }));
    try {
      await api.put(`/subjects/${subjectId}`, { teacher_id: teacherId || null });
      setSubjects(prev => prev.map(s =>
        s.id === subjectId ? {
          ...s,
          teacher_id:   teacherId ? parseInt(teacherId) : null,
          teacher_name: teachers.find(t => t.id === parseInt(teacherId))?.name || null,
        } : s
      ));
      toast.success('Teacher assigned');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign teacher');
    } finally {
      setSaving(p => ({ ...p, [subjectId]: false }));
    }
  }

  async function handleBulkAutoAssign() {
    if (!window.confirm(
      'Auto-assign teachers to ALL unassigned subjects across all classes?\n\n' +
      'Only subjects with no teacher will be updated.'
    )) return;

    setErrors([]);
    setProgress({ total: 0, done: 0, msg: 'Loading classes…' });

    try {
      const { data: cls } = await classAPI.list({});
      const allClasses = cls.data;

      // Count total unassigned subjects
      let total = 0;
      const classSubjects = {};
      for (const c of allClasses) {
        const { data: s } = await api.get(`/classes/${c.id}/subjects`);
        classSubjects[c.id] = s.data;
        total += s.data.filter(sub => !sub.teacher_id).length;
      }

      setProgress({ total, done: 0, msg: `Found ${total} unassigned subjects across ${allClasses.length} classes…` });

      let done = 0;
      let assigned = 0;
      const failList = [];

      for (const c of allClasses) {
        const unassigned = classSubjects[c.id].filter(s => !s.teacher_id);

        for (const subj of unassigned) {
          const match = matchTeacher(subj.name, teachers);

          if (match) {
            try {
              await api.put(`/subjects/${subj.id}`, { teacher_id: match.id });
              assigned++;
            } catch (err) {
              failList.push(`${c.name}: ${subj.name} — ${err.response?.data?.message || err.message}`);
            }
          } else {
            failList.push(`${c.name}: ${subj.name} — no matching teacher found`);
          }

          done++;
          setProgress({ total, done, assigned, msg: `Processing ${c.name} ${c.section}…` });
        }
      }

      setErrors(failList);
      setProgress(null);

      if (failList.length === 0) {
        toast.success(`✅ All ${assigned} subjects assigned successfully!`);
      } else {
        toast.success(`Assigned ${assigned} subjects. ${failList.length} could not be matched.`);
      }

      if (selClass) loadSubjects(selClass);

    } catch (err) {
      setProgress(null);
      toast.error('Bulk assign failed: ' + (err.message || 'Unknown error'));
    }
  }

  const assigned   = subjects.filter(s => s.teacher_id).length;
  const unassigned = subjects.filter(s => !s.teacher_id).length;
  const selClassName = classes.find(c => c.id === parseInt(selClass));

  return (
    <div>
      <PageHeader
        title="Assign teachers to subjects"
        subtitle="Bulk auto-assign or review class by class"
        action={
          <Button variant="primary" onClick={handleBulkAutoAssign} disabled={!!progress}>
            {progress ? '⏳ Assigning…' : '⚡ Bulk auto-assign all classes'}
          </Button>
        }
      />

      {/* Progress */}
      {progress && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <p className="text-sm font-medium text-blue-700">{progress.msg}</p>
            <span className="ml-auto text-xs text-blue-500 font-medium">
              {progress.total > 0 ? `${progress.done}/${progress.total}` : ''}
            </span>
          </div>
          {progress.total > 0 && (
            <div className="bg-blue-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.round(progress.done / progress.total * 100)}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <p className="text-sm font-semibold text-amber-700 mb-2">
            ⚠️ {errors.length} subject{errors.length > 1 ? 's' : ''} could not be auto-assigned — assign manually below:
          </p>
          <ul className="text-xs text-amber-600 space-y-0.5 max-h-32 overflow-y-auto">
            {errors.map((e, i) => <li key={i}>• {e}</li>)}
          </ul>
        </div>
      )}

      {/* Info banner */}
      {!progress && errors.length === 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 flex items-start gap-3">
          <span className="text-lg">💡</span>
          <div>
            <p className="text-sm font-medium text-blue-700 mb-0.5">How bulk assign works</p>
            <p className="text-xs text-blue-500">
              Matches each subject to a teacher whose specialization matches the subject name.
              Only fills subjects with no teacher yet. Review per class below to fix any gaps.
            </p>
          </div>
        </div>
      )}

      {/* Class selector */}
      <div className="flex gap-3 mb-5 items-center flex-wrap">
        <Select value={selClass} onChange={e => setSelClass(e.target.value)} className="w-52">
          <option value="">Select class to review…</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name} {c.section}</option>
          ))}
        </Select>
        {selClass && subjects.length > 0 && (
          <>
            <span className="bg-green-100 text-green-700 text-xs font-medium px-3 py-1.5 rounded-full">
              ✓ {assigned} assigned
            </span>
            <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${
              unassigned > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
              {unassigned > 0 ? `⚠ ${unassigned} missing` : '✓ All assigned'}
            </span>
          </>
        )}
      </div>

      {/* Subject table */}
      {!selClass ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center">
          <p className="text-4xl mb-3">📚</p>
          <p className="text-gray-600 text-sm font-medium mb-1">Select a class to review assignments</p>
          <p className="text-gray-400 text-xs">Or click ⚡ Bulk auto-assign to process all classes at once</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : subjects.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
          <p className="text-gray-400 text-sm">No subjects for this class.</p>
          <p className="text-xs text-gray-300 mt-1">Add subjects from the Classes page first.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              {selClassName?.name} {selClassName?.section} — {subjects.length} subjects
            </h3>
            {unassigned > 0 && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                {unassigned} still need teachers
              </span>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Subject</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 w-20">Code</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 w-16">Periods</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Assigned teacher</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map(s => (
                <tr key={s.id} className={`border-b border-gray-50 last:border-0 transition-colors
                  ${!s.teacher_id ? 'bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-gray-50'}`}>
                  <td className="px-4 py-3 font-medium text-gray-700">{s.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{s.code || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-center">{s.periods_per_week}×</td>
                  <td className="px-4 py-3">
                    <Select
                      value={s.teacher_id || ''}
                      onChange={e => assignTeacher(s.id, e.target.value)}
                      disabled={saving[s.id]}
                      className="w-full text-sm">
                      <option value="">— No teacher assigned —</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name}{t.specialization ? ` (${t.specialization})` : ''}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    {saving[s.id] ? (
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : s.teacher_id ? (
                      <Badge color="green">✓ Done</Badge>
                    ) : (
                      <Badge color="red">Missing</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}