import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { studentAPI, feeAPI } from '../../api';
import { useSelector } from 'react-redux';
import { selectRole } from '../../store/slices/authSlice';
import {
  PageHeader, Card, Badge, Button, StatCard, Spinner, Table,
} from '../../components/ui';
import { gradeColor } from '../../utils/grades';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const TABS = ['overview', 'grades', 'attendance', 'reports', 'fees'];

export default function StudentDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const role     = useSelector(selectRole);

  const [student,    setStudent]    = useState(null);
  const [grades,     setGrades]     = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [reports,    setReports]    = useState([]);
  const [feeBalance, setFeeBalance] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState('overview');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data } = await studentAPI.getOne(id);
        setStudent(data.data);
        const [g, a, r] = await Promise.all([
          studentAPI.grades(id, {}),
          studentAPI.attendance(id, {}),
          studentAPI.reports(id),
        ]);
        setGrades(g.data.data);
        setAttendance(a.data.data);
        setReports(r.data.data);
        if (role === 'admin' || role === 'accountant') {
          feeAPI.studentBalance(id, {}).then(({ data: fb }) => setFeeBalance(fb.data)).catch(() => {});
        }
      } catch { toast.error('Failed to load student'); }
      finally { setLoading(false); }
    }
    load();
  }, [id, role]);

  const avgScore = grades.length
    ? Math.round(grades.reduce((s, g) => s + parseFloat(g.score), 0) / grades.length)
    : null;

  const gradeCols = [
    { key: 'subject_name',    label: 'Subject',    width: '160px' },
    { key: 'assessment_type', label: 'Type',        width: '110px', render: v => <span className="capitalize">{v}</span> },
    { key: 'term',            label: 'Term',        width: '80px'  },
    { key: 'score',           label: 'Score',       width: '80px',  render: v => `${v}%` },
    { key: 'letter_grade',    label: 'Grade',       width: '80px',
      render: v => <Badge color={gradeColor(v)}>{v}</Badge> },
  ];

  const attCols = [
    { key: 'date',         label: 'Date',    width: '120px', render: v => format(new Date(v), 'dd MMM yyyy') },
    { key: 'subject_name', label: 'Subject', width: '160px' },
    { key: 'status',       label: 'Status',  width: '100px',
      render: v => {
        const colors = { present: 'green', absent: 'red', late: 'amber', excused: 'blue' };
        return <Badge color={colors[v] || 'gray'}>{v}</Badge>;
      }},
    { key: 'notes', label: 'Notes', render: v => <span className="text-gray-400 text-xs">{v || '—'}</span> },
  ];

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!student) return <div className="text-center py-20 text-gray-400">Student not found</div>;

  const showTabs = role === 'admin' || role === 'accountant'
    ? TABS
    : TABS.filter(t => t !== 'fees');

  return (
    <div>
      <PageHeader
        title={student.name}
        subtitle={`${student.class_name} ${student.section} · ${student.student_number}`}
        action={<Button onClick={() => navigate(-1)}>Back</Button>}
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Class"         value={`${student.class_name} ${student.section}`} color="blue"   />
        <StatCard label="Avg score"     value={avgScore !== null ? `${avgScore}%` : '—'}   color="green"  />
        <StatCard label="Attendance"    value={`${attendance?.summary?.percentage ?? 0}%`} color={attendance?.summary?.percentage >= 80 ? 'green' : 'amber'} />
        <StatCard label="Academic year" value={student.academic_year}                       color="purple" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 mb-5">
        {showTabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize transition-colors
              ${tab === t
                ? 'border-b-2 border-blue-600 text-blue-700 font-medium -mb-px'
                : 'text-gray-400 hover:text-gray-600'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 gap-5">
          <Card title="Profile">
            <table className="w-full text-sm">
              {[
                ['Full name',      student.name],
                ['Student number', student.student_number],
                ['Email',          student.email],
                ['Class',          `${student.class_name} ${student.section}`],
                ['Gender',         student.gender || '—'],
                ['Date of birth',  student.dob ? format(new Date(student.dob), 'dd MMM yyyy') : '—'],
                ['Enrolled',       student.enrolled_at ? format(new Date(student.enrolled_at), 'dd MMM yyyy') : '—'],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 text-gray-400 w-36">{k}</td>
                  <td className="py-2 text-gray-700 font-medium">{v}</td>
                </tr>
              ))}
            </table>
          </Card>
          <Card title="Recent grades">
            {grades.slice(0, 6).map(g => (
              <div key={g.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm text-gray-700">{g.subject_name}</p>
                  <p className="text-xs text-gray-400 capitalize">{g.assessment_type} · {g.term}</p>
                </div>
                <div className="text-right">
                  <Badge color={gradeColor(g.letter_grade)}>{g.letter_grade}</Badge>
                  <p className="text-xs text-gray-400 mt-0.5">{g.score}%</p>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Grades */}
      {tab === 'grades' && (
        <Card>
          {grades.length === 0
            ? <p className="text-sm text-gray-400 py-8 text-center">No grades recorded yet</p>
            : <Table columns={gradeCols} data={grades} />
          }
        </Card>
      )}

      {/* Attendance */}
      {tab === 'attendance' && (
        <div>
          {attendance?.summary && (
            <div className="grid grid-cols-4 gap-4 mb-5">
              <StatCard label="Total"   value={attendance.summary.total}      color="blue"   />
              <StatCard label="Present" value={attendance.summary.present}    color="green"  />
              <StatCard label="Absent"  value={attendance.summary.absent}     color="red"    />
              <StatCard label="Rate"    value={`${attendance.summary.percentage}%`} color={attendance.summary.percentage >= 80 ? 'green' : 'amber'} />
            </div>
          )}
          <Card>
            {!attendance?.records?.length
              ? <p className="text-sm text-gray-400 py-8 text-center">No attendance records yet</p>
              : <Table columns={attCols} data={attendance.records} />
            }
          </Card>
        </div>
      )}

      {/* Reports */}
      {tab === 'reports' && (
        <Card>
          {reports.length === 0
            ? <p className="text-sm text-gray-400 py-8 text-center">No reports generated yet</p>
            : reports.map(r => (
                <div key={r.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{r.term} · {r.academic_year}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{r.remarks}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700">{parseFloat(r.average_score || 0).toFixed(1)}% avg</p>
                    <p className="text-xs text-gray-400">Pos: {r.class_position}/{r.class_size}</p>
                  </div>
                </div>
              ))
          }
        </Card>
      )}

      {/* Fees */}
      {tab === 'fees' && (
        <Card>
          {feeBalance.length === 0
            ? <p className="text-sm text-gray-400 py-8 text-center">No fee structure found for this student</p>
            : feeBalance.map(f => (
                <div key={f.fee_structure_id}
                  className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{f.term} · {f.academic_year}</p>
                    <p className="text-xs text-gray-400">Fee: GH₵{parseFloat(f.total_fee).toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <Badge color={f.is_cleared ? 'green' : 'red'}>
                      {f.is_cleared ? 'Cleared' : `Owes GH₵${parseFloat(f.balance).toFixed(2)}`}
                    </Badge>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Paid: GH₵{parseFloat(f.amount_paid).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))
          }
        </Card>
      )}
    </div>
  );
}