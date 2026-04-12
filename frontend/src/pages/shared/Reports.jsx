import React, { useEffect, useState } from 'react';
import { reportAPI, classAPI } from '../../api';
import { useSelector } from 'react-redux';
import { selectRole } from '../../store/slices/authSlice';
import {
  PageHeader, Card, Button, Select, Input, Badge, Table, Spinner, Empty,
} from '../../components/ui';
import { gradeColor } from '../../utils/grades';
import toast from 'react-hot-toast';

const TERMS        = ['Term 1', 'Term 2', 'Term 3'];
const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;

export default function Reports() {
  const role = useSelector(selectRole);
  const canGenerate = role === 'admin' || role === 'teacher';

  const [classes,    setClasses]    = useState([]);
  const [reports,    setReports]    = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [generating, setGenerating] = useState(false);
  const [detailLoad, setDetailLoad] = useState(false);

  const [filters, setFilters] = useState({ class_id: '', term: 'Term 1', academic_year: CURRENT_YEAR });

  useEffect(() => {
    if (canGenerate) {
      classAPI.list({}).then(({ data }) => setClasses(data.data)).catch(() => {});
    }
  }, [canGenerate]);

  async function loadReports() {
    if (!filters.class_id) return toast.error('Select a class first');
    setLoading(true);
    setSelected(null);
    try {
      const { data } = await reportAPI.byClass(filters.class_id, {
        term: filters.term,
        academic_year: filters.academic_year,
      });
      setReports(data.data);
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  }

  async function handleGenerate() {
    if (!filters.class_id) return toast.error('Select a class first');
    if (!window.confirm(`Generate reports for all students in this class for ${filters.term} ${filters.academic_year}?`)) return;
    setGenerating(true);
    try {
      await reportAPI.generate({
        class_id:     parseInt(filters.class_id),
        term:         filters.term,
        academic_year: filters.academic_year,
      });
      toast.success('Reports generated');
      loadReports();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate reports');
    } finally { setGenerating(false); }
  }

  async function openReport(report) {
    setDetailLoad(true);
    try {
      const { data } = await reportAPI.getOne(report.id);
      setSelected(data.data);
    } catch { toast.error('Failed to load report'); }
    finally { setDetailLoad(false); }
  }

  const reportCols = [
    { key: 'class_position', label: 'Pos',    width: '60px',
      render: (v, row) => <span className="font-medium">{v}/{row.class_size}</span> },
    { key: 'student_name',   label: 'Student', width: '180px' },
    { key: 'student_number', label: 'ID',      width: '100px', render: v => <span className="text-gray-400 text-xs">{v}</span> },
    { key: 'average_score',  label: 'Average', width: '100px',
      render: v => {
        const n = parseFloat(v);
        const color = n >= 70 ? 'green' : n >= 55 ? 'amber' : 'red';
        return <span className={`font-medium text-${color === 'green' ? 'green' : color === 'amber' ? 'amber' : 'red'}-600`}>{n.toFixed(1)}%</span>;
      }},
    { key: 'remarks', label: 'Remarks', render: v => <span className="text-xs text-gray-400 truncate">{v}</span> },
  ];

  return (
    <div className="flex gap-5">

      {/* Left */}
      <div className="flex-1 min-w-0">
        <PageHeader title="Reports" subtitle="Term report cards" />

        {/* Controls */}
        <div className="flex gap-3 mb-5 flex-wrap items-end">
          {canGenerate && (
            <Select value={filters.class_id} onChange={e => setFilters(p => ({ ...p, class_id: e.target.value }))} className="w-40">
              <option value="">Select class…</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
            </Select>
          )}
          <Select value={filters.term} onChange={e => setFilters(p => ({ ...p, term: e.target.value }))} className="w-28">
            {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Input value={filters.academic_year} onChange={e => setFilters(p => ({ ...p, academic_year: e.target.value }))} className="w-28" placeholder="2025/2026" />
          <Button onClick={loadReports}>View reports</Button>
          {canGenerate && (
            <Button variant="primary" loading={generating} onClick={handleGenerate}>
              Generate / refresh
            </Button>
          )}
        </div>

        <Card>
          {loading
            ? <div className="flex justify-center py-16"><Spinner size="lg" /></div>
            : reports.length === 0
              ? <Empty message="No reports found — select a class and click View reports" />
              : <Table columns={reportCols} data={reports} onRowClick={openReport} />
          }
        </Card>
      </div>

      {/* Right — report detail */}
      {(selected || detailLoad) && (
        <div className="w-80 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-700">Report card</h2>
            <button onClick={() => setSelected(null)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
          </div>

          {detailLoad
            ? <div className="flex justify-center py-10"><Spinner /></div>
            : selected && (
              <>
                {/* Header */}
                <Card className="mb-4">
                  <div className="text-center mb-3">
                    <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 flex items-center
                                    justify-center text-sm font-medium mx-auto mb-2">
                      {selected.student_name?.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                    <p className="text-sm font-medium text-gray-800">{selected.student_name}</p>
                    <p className="text-xs text-gray-400">{selected.class_name} {selected.section}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      ['Average', `${parseFloat(selected.average_score || 0).toFixed(1)}%`],
                      ['Position', `${selected.class_position}/${selected.class_size}`],
                      ['Term', selected.term],
                    ].map(([l, v]) => (
                      <div key={l} className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-400 mb-0.5">{l}</p>
                        <p className="text-sm font-medium text-gray-700">{v}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Subject scores */}
                <Card title="Subject breakdown">
                  {(selected.subjects || []).length === 0
                    ? <p className="text-xs text-gray-400 py-2">No subject grades found</p>
                    : selected.subjects.map(s => (
                        <div key={s.subject} className="flex items-center justify-between py-2
                                                          border-b border-gray-50 last:border-0">
                          <div>
                            <p className="text-sm text-gray-700">{s.subject}</p>
                            {s.code && <p className="text-xs text-gray-400">{s.code}</p>}
                          </div>
                          <div className="text-right">
                            <Badge color={gradeColor(s.letter_grade)}>{s.letter_grade}</Badge>
                            <p className="text-xs text-gray-400 mt-0.5">{s.score}%</p>
                          </div>
                        </div>
                      ))
                  }
                </Card>

                {/* Remarks */}
                {selected.remarks && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs font-medium text-blue-700 mb-1">Teacher remarks</p>
                    <p className="text-xs text-blue-600">{selected.remarks}</p>
                  </div>
                )}
              </>
            )
          }
        </div>
      )}
    </div>
  );
}
