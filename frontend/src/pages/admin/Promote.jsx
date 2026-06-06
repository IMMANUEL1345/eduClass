import React, { useEffect, useState, useCallback } from 'react';
import { studentAPI, classAPI, gradeAPI } from '../../api';
import { PageHeader, Card, Button, Select, Input, Badge, Spinner } from '../../components/ui';
import toast from 'react-hot-toast';

const TERMS        = ['Term 1', 'Term 2', 'Term 3'];
const CURRENT_YEAR = (() => {
  const y = new Date().getFullYear();
  return new Date().getMonth() >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
})();
const NEXT_YEAR = (() => {
  const y = new Date().getFullYear();
  return new Date().getMonth() >= 8 ? `${y + 1}/${y + 2}` : `${y}/${y + 1}`;
})();

const PASS_MARK = 50; // default pass mark %

function avgColor(avg) {
  if (avg === null || avg === undefined) return 'text-gray-400';
  if (avg >= 70) return 'text-green-600';
  if (avg >= 50) return 'text-blue-600';
  if (avg >= 40) return 'text-amber-600';
  return 'text-red-600';
}

function statusBadge(avg, subjectsWithGrades) {
  if (!subjectsWithGrades || subjectsWithGrades === '0') {
    return <Badge color="gray">No grades</Badge>;
  }
  if (avg === null || avg === undefined) {
    return <Badge color="gray">No grades</Badge>;
  }
  return parseFloat(avg) >= PASS_MARK
    ? <Badge color="green">Pass</Badge>
    : <Badge color="red">Fail</Badge>;
}

export default function Promote() {
  const [classes,    setClasses]    = useState([]);
  const [students,   setStudents]   = useState([]); // with grade summaries merged
  const [selected,   setSelected]   = useState(new Set());
  const [fromClass,  setFromClass]  = useState('');
  const [term,       setTerm]       = useState('Term 3'); // end of year = Term 3
  const [gradeYear,  setGradeYear]  = useState(CURRENT_YEAR);
  const [toClass,    setToClass]    = useState('');
  const [newYear,    setNewYear]    = useState(NEXT_YEAR);
  const [loading,    setLoading]    = useState(false);
  const [promoting,  setPromoting]  = useState(false);
  const [done,       setDone]       = useState(null);

  useEffect(() => {
    classAPI.list({}).then(({ data }) => setClasses(data.data)).catch(() => {});
  }, []);

  // Load students + grade summaries when class/term/year changes
  const loadStudents = useCallback(async () => {
    if (!fromClass) { setStudents([]); setSelected(new Set()); return; }
    setLoading(true);
    try {
      // Load students and grade summaries in parallel
      const [studRes, summaryRes] = await Promise.all([
        classAPI.students(fromClass),
        gradeAPI.promotionSummary({ class_id: fromClass, term, academic_year: gradeYear }),
      ]);

      const studs   = studRes.data.data   || [];
      const summary = summaryRes.data.data || [];

      // Merge grade summary into student list
      const summaryMap = {};
      summary.forEach(s => { summaryMap[s.student_id] = s; });

      const merged = studs.map(s => ({
        ...s,
        average:              summaryMap[s.id]?.average             ?? null,
        subjects_with_grades: summaryMap[s.id]?.subjects_with_grades ?? 0,
        total_subjects:       summaryMap[s.id]?.total_subjects       ?? 0,
        class_position:       summaryMap[s.id]?.class_position       ?? null,
      }));

      // Sort: fails first (so admin sees them easily), then passes by avg desc
      merged.sort((a, b) => {
        const aPass = a.average !== null && parseFloat(a.average) >= PASS_MARK;
        const bPass = b.average !== null && parseFloat(b.average) >= PASS_MARK;
        if (aPass !== bPass) return aPass ? 1 : -1; // fails first
        return (parseFloat(b.average) || 0) - (parseFloat(a.average) || 0);
      });

      setStudents(merged);

      // Auto-select only students who PASS (avg >= PASS_MARK and has grades)
      const autoSelect = new Set(
        merged
          .filter(s => s.average !== null && parseFloat(s.average) >= PASS_MARK)
          .map(s => s.id)
      );
      setSelected(autoSelect);

    } catch { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  }, [fromClass, term, gradeYear]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  function toggleAll() {
    if (selected.size === students.length) setSelected(new Set());
    else setSelected(new Set(students.map(s => s.id)));
  }

  function toggleOne(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handlePromote() {
    if (!fromClass)               return toast.error('Select the current class');
    if (!toClass)                 return toast.error('Select the destination class');
    if (fromClass === toClass)    return toast.error('Source and destination must be different');
    if (selected.size === 0)      return toast.error('Select at least one student');
    if (!newYear)                 return toast.error('Enter the new academic year');

    const fromObj = classes.find(c => String(c.id) === String(fromClass));
    const toObj   = classes.find(c => String(c.id) === String(toClass));
    const repeats = students.length - selected.size;

    const confirmed = window.confirm(
      `Promote ${selected.size} student${selected.size !== 1 ? 's' : ''} from ` +
      `${fromObj?.name} ${fromObj?.section} → ${toObj?.name} ${toObj?.section}\n` +
      `New academic year: ${newYear}\n\n` +
      (repeats > 0 ? `${repeats} student${repeats !== 1 ? 's' : ''} will REPEAT ${fromObj?.name} ${fromObj?.section}.\n\n` : '') +
      `Proceed?`
    );
    if (!confirmed) return;

    setPromoting(true);
    try {
      const { data } = await studentAPI.promote({
        student_ids:       Array.from(selected),
        new_class_id:      parseInt(toClass),
        new_academic_year: newYear,
      });
      setDone({ ...data.data, repeats });
      toast.success(data.message || 'Students promoted');
      setFromClass(''); setToClass(''); setStudents([]); setSelected(new Set());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Promotion failed');
    } finally { setPromoting(false); }
  }

  // Counts
  const passCount    = students.filter(s => s.average !== null && parseFloat(s.average) >= PASS_MARK).length;
  const failCount    = students.filter(s => s.average !== null && parseFloat(s.average) <  PASS_MARK).length;
  const noGradeCount = students.filter(s => s.average === null).length;
  const fromObj      = classes.find(c => String(c.id) === String(fromClass));
  const toObj        = classes.find(c => String(c.id) === String(toClass));

  return (
    <div>
      <PageHeader
        title="Promote / Graduate Students"
        subtitle={`Students ≥ ${PASS_MARK}% are auto-selected for promotion. Uncheck any student to make them repeat.`}
      />

      {/* Success banner */}
      {done && (
        <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-green-700">
              ✓ {done.promoted} student{done.promoted !== 1 ? 's' : ''} promoted to {done.class_name}
            </p>
            {done.repeats > 0 && (
              <p className="text-xs text-amber-600 mt-0.5">
                {done.repeats} student{done.repeats !== 1 ? 's' : ''} will repeat their current class.
              </p>
            )}
            <p className="text-xs text-green-600 mt-0.5">
              Historical grades remain accessible to all students.
            </p>
          </div>
          <button onClick={() => setDone(null)} className="text-green-400 hover:text-green-600 text-lg">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── LEFT: Settings ──────────────────────────────── */}
        <Card title="Promotion settings">
          <div className="space-y-4">

            {/* Source class */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">
                Current class (promoting FROM)
              </label>
              <Select value={fromClass} onChange={e => { setFromClass(e.target.value); setDone(null); }} className="w-full">
                <option value="">Select class…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
              </Select>
            </div>

            {/* Grade term + year — to pull correct scores */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">
                Grade term to evaluate
              </label>
              <div className="flex gap-2">
                <Select value={term} onChange={e => setTerm(e.target.value)} className="flex-1">
                  {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
                <Input
                  value={gradeYear}
                  onChange={e => setGradeYear(e.target.value)}
                  placeholder="2025/2026"
                  className="w-28"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Grades from this term/year determine pass or fail.
              </p>
            </div>

            {/* Destination class */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">
                Destination class (promoting TO)
              </label>
              <Select value={toClass} onChange={e => setToClass(e.target.value)} className="w-full">
                <option value="">Select class…</option>
                {classes.filter(c => String(c.id) !== String(fromClass))
                  .map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
              </Select>
            </div>

            {/* New academic year */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">
                New academic year
              </label>
              <Input
                value={newYear}
                onChange={e => setNewYear(e.target.value)}
                placeholder="2026/2027"
                className="w-full"
              />
            </div>

            {/* Grade summary stats */}
            {students.length > 0 && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-green-50 rounded-xl p-2.5">
                  <p className="text-lg font-bold text-green-600">{passCount}</p>
                  <p className="text-xs text-green-600">Pass</p>
                </div>
                <div className="bg-red-50 rounded-xl p-2.5">
                  <p className="text-lg font-bold text-red-500">{failCount}</p>
                  <p className="text-xs text-red-500">Fail</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2.5">
                  <p className="text-lg font-bold text-gray-400">{noGradeCount}</p>
                  <p className="text-xs text-gray-400">No grades</p>
                </div>
              </div>
            )}

            {/* Summary */}
            {fromObj && toObj && selected.size > 0 && (
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs space-y-1">
                <p className="font-semibold text-blue-700">Promotion summary</p>
                <p className="text-blue-600">From: <span className="font-medium">{fromObj.name} {fromObj.section}</span></p>
                <p className="text-blue-600">To: <span className="font-medium">{toObj.name} {toObj.section}</span></p>
                <p className="text-blue-600">Year: <span className="font-medium">{newYear}</span></p>
                <p className="text-green-700 font-medium">🎓 Promoting: {selected.size} student{selected.size !== 1 ? 's' : ''}</p>
                {students.length - selected.size > 0 && (
                  <p className="text-amber-700 font-medium">↺ Repeating: {students.length - selected.size} student{students.length - selected.size !== 1 ? 's' : ''}</p>
                )}
              </div>
            )}

            <Button
              variant="primary"
              className="w-full"
              loading={promoting}
              disabled={!fromClass || !toClass || selected.size === 0 || fromClass === toClass}
              onClick={handlePromote}
            >
              🎓 Promote {selected.size > 0 ? `${selected.size} student${selected.size !== 1 ? 's' : ''}` : 'students'}
            </Button>
          </div>
        </Card>

        {/* ── RIGHT: Student list with grades ─────────────── */}
        <div className="lg:col-span-2">
          <Card title={
            fromObj
              ? `${fromObj.name} ${fromObj.section} — ${students.length} student${students.length !== 1 ? 's' : ''} · ${term} ${gradeYear}`
              : 'Students'
          }>
            {!fromClass ? (
              <p className="text-sm text-gray-400 py-10 text-center">Select a source class to view students</p>
            ) : loading ? (
              <div className="flex justify-center py-10"><Spinner size="lg" /></div>
            ) : students.length === 0 ? (
              <p className="text-sm text-gray-400 py-10 text-center">No students in this class</p>
            ) : (
              <>
                {/* Header row */}
                <div className="flex items-center gap-3 px-2 pb-2 mb-1 border-b border-gray-100">
                  <input
                    type="checkbox"
                    checked={selected.size === students.length && students.length > 0}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <span className="text-xs font-medium text-gray-500 flex-1">Student</span>
                  <span className="text-xs font-medium text-gray-500 w-20 text-center">Average</span>
                  <span className="text-xs font-medium text-gray-500 w-24 text-center">Subjects</span>
                  <span className="text-xs font-medium text-gray-500 w-20 text-center">Status</span>
                  <span className="text-xs font-medium text-gray-500 w-20 text-center">Action</span>
                </div>

                {/* Student rows */}
                <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
                  {students.map(s => {
                    const checked  = selected.has(s.id);
                    const hasFail  = s.average !== null && parseFloat(s.average) < PASS_MARK;
                    const noGrades = s.average === null || parseInt(s.subjects_with_grades) === 0;

                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-3 py-2.5 px-2 cursor-pointer rounded-lg transition-colors
                          ${checked
                            ? 'bg-green-50 hover:bg-green-100'
                            : hasFail
                              ? 'bg-red-50 hover:bg-red-100'
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOne(s.id)}
                          className="w-4 h-4 rounded accent-blue-600 flex-shrink-0"
                        />

                        {/* Name + number */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                          <p className="text-xs text-gray-400">{s.student_number}</p>
                        </div>

                        {/* Average */}
                        <div className="w-20 text-center">
                          {s.average !== null ? (
                            <span className={`text-sm font-bold ${avgColor(parseFloat(s.average))}`}>
                              {parseFloat(s.average).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </div>

                        {/* Subjects with grades */}
                        <div className="w-24 text-center">
                          <span className="text-xs text-gray-500">
                            {parseInt(s.subjects_with_grades) > 0
                              ? `${s.subjects_with_grades} / ${s.total_subjects}`
                              : <span className="text-gray-300">0 graded</span>
                            }
                          </span>
                        </div>

                        {/* Pass/Fail badge */}
                        <div className="w-20 flex justify-center">
                          {statusBadge(s.average, s.subjects_with_grades)}
                        </div>

                        {/* Promote/Repeat badge */}
                        <div className="w-20 flex justify-center">
                          <Badge color={checked ? 'green' : noGrades ? 'gray' : 'amber'}>
                            {checked ? 'Promote' : 'Repeat'}
                          </Badge>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-green-200 inline-block"/>Pass ≥ {PASS_MARK}%</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-200 inline-block"/>Fail &lt; {PASS_MARK}%</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-gray-200 inline-block"/>No grades recorded</span>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}