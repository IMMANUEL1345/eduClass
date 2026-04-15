import React, { useEffect, useState } from 'react';
import { reportAPI, classAPI } from '../../api';
import { useSelector } from 'react-redux';
import { selectRole } from '../../store/slices/authSlice';
import {
  PageHeader, Card, Button, Select, Input, Badge, Spinner,
} from '../../components/ui';
import { gradeColor } from '../../utils/grades';
import toast from 'react-hot-toast';

const TERMS        = ['Term 1','Term 2','Term 3'];
const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;

const REPORT_TYPES = [
  { id: 'term',        label: 'Term report cards',        roles: ['admin','teacher','parent','student'] },
  { id: 'attendance',  label: 'Attendance report',        roles: ['admin','teacher'] },
  { id: 'enrollment',  label: 'Student enrollment',       roles: ['admin'] },
  { id: 'fee',         label: 'Fee collection',           roles: ['admin','accountant'] },
  { id: 'expense',     label: 'Expense summary',          roles: ['admin','accountant'] },
];

function downloadCSV(data, filename, columns) {
  const headers = columns.map(c => c.label);
  const rows    = data.map(row => columns.map(c => {
    const v = row[c.key];
    return typeof v === 'string' && v.includes(',') ? `"${v}"` : (v ?? '');
  }));
  const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const role        = useSelector(selectRole);
  const [activeType,  setActiveType]  = useState('term');
  const [classes,     setClasses]     = useState([]);
  const [reports,     setReports]     = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [generating,  setGenerating]  = useState(false);
  const [detailLoad,  setDetailLoad]  = useState(false);
  const [filters, setFilters] = useState({
    class_id:'', term:'Term 1', academic_year: CURRENT_YEAR, year: new Date().getFullYear(),
  });

  const canGenerate = role === 'admin' || role === 'teacher';
  const availableTypes = REPORT_TYPES.filter(t => t.roles.includes(role));

  useEffect(() => {
    classAPI.list({}).then(({ data }) => setClasses(data.data)).catch(() => {});
  }, []);

  // ── LOADERS ───────────────────────────────────────────
  async function loadTermReports() {
    if (!filters.class_id) return toast.error('Select a class first');
    setLoading(true); setSelected(null);
    try {
      const { data } = await reportAPI.byClass(filters.class_id, {
        term: filters.term, academic_year: filters.academic_year,
      });
      setReports(data.data);
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  }

  async function loadAttendance() {
    if (!filters.class_id) return toast.error('Select a class first');
    setLoading(true);
    try {
      const { data } = await reportAPI.attendanceReport({
        class_id: filters.class_id, term: filters.term, academic_year: filters.academic_year,
      });
      setReports(data.data);
    } catch { toast.error('Failed to load attendance report'); }
    finally { setLoading(false); }
  }

  async function loadEnrollment() {
    setLoading(true);
    try {
      const { data } = await reportAPI.enrollmentReport({
        class_id: filters.class_id, academic_year: filters.academic_year,
      });
      setReports(data.data);
    } catch { toast.error('Failed to load enrollment report'); }
    finally { setLoading(false); }
  }

  async function loadFeeCollection() {
    setLoading(true);
    try {
      const { data } = await reportAPI.feeCollectionReport({
        term: filters.term, academic_year: filters.academic_year,
      });
      setReports(data.data.by_class || []);
    } catch { toast.error('Failed to load fee collection report'); }
    finally { setLoading(false); }
  }

  async function loadExpenses() {
    setLoading(true);
    try {
      const { data } = await reportAPI.expenseSummaryReport({ year: filters.year });
      setReports(data.data.by_category || []);
    } catch { toast.error('Failed to load expense report'); }
    finally { setLoading(false); }
  }

  function handleLoad() {
    setReports([]); setSelected(null);
    if (activeType === 'term')       loadTermReports();
    if (activeType === 'attendance') loadAttendance();
    if (activeType === 'enrollment') loadEnrollment();
    if (activeType === 'fee')        loadFeeCollection();
    if (activeType === 'expense')    loadExpenses();
  }

  async function handleGenerate() {
    if (!filters.class_id) return toast.error('Select a class first');
    if (!window.confirm(`Generate term reports for ${filters.term} ${filters.academic_year}?`)) return;
    setGenerating(true);
    try {
      await reportAPI.generate({ class_id: parseInt(filters.class_id), term: filters.term, academic_year: filters.academic_year });
      toast.success('Reports generated');
      loadTermReports();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setGenerating(false); }
  }

  async function openReport(report) {
    setDetailLoad(true);
    try {
      const { data } = await reportAPI.getOne(report.id);
      setSelected(data.data);
    } catch { toast.error('Failed to load report detail'); }
    finally { setDetailLoad(false); }
  }

  function handleDownload() {
    if (!reports.length) return toast.error('No data to export');
    if (activeType === 'term') {
      downloadCSV(reports, `term_reports_${filters.term}_${filters.academic_year}.csv`, [
        { key:'class_position', label:'Position' },
        { key:'student_name',   label:'Student'  },
        { key:'student_number', label:'ID'       },
        { key:'average_score',  label:'Average'  },
        { key:'remarks',        label:'Remarks'  },
      ]);
    } else if (activeType === 'attendance') {
      downloadCSV(reports, `attendance_${filters.term}.csv`, [
        { key:'student_name',   label:'Student'    },
        { key:'student_number', label:'ID'         },
        { key:'present',        label:'Present'    },
        { key:'absent',         label:'Absent'     },
        { key:'late',           label:'Late'       },
        { key:'total',          label:'Total'      },
        { key:'percentage',     label:'Percentage' },
      ]);
    } else if (activeType === 'enrollment') {
      downloadCSV(reports, `enrollment_${filters.academic_year}.csv`, [
        { key:'student_number', label:'Student No.' },
        { key:'student_name',   label:'Name'        },
        { key:'class_name',     label:'Class'       },
        { key:'section',        label:'Section'     },
        { key:'gender',         label:'Gender'      },
        { key:'academic_year',  label:'Year'        },
      ]);
    } else if (activeType === 'fee') {
      downloadCSV(reports, `fee_collection_${filters.term}.csv`, [
        { key:'class_name',       label:'Class'       },
        { key:'total_students',   label:'Students'    },
        { key:'total_expected',   label:'Expected'    },
        { key:'total_collected',  label:'Collected'   },
        { key:'outstanding',      label:'Outstanding' },
        { key:'cleared',          label:'Cleared'     },
        { key:'defaulters',       label:'Defaulters'  },
      ]);
    } else if (activeType === 'expense') {
      downloadCSV(reports, `expenses_${filters.year}.csv`, [
        { key:'category', label:'Category' },
        { key:'total',    label:'Total'    },
        { key:'count',    label:'Count'    },
      ]);
    }
  }

  return (
    <div>
      <PageHeader title="Reports" subtitle="Generate and download school reports" />

      {/* Report type tabs */}
      <div className="flex gap-1 border-b border-gray-100 mb-5 overflow-x-auto">
        {availableTypes.map(t => (
          <button key={t.id} onClick={() => { setActiveType(t.id); setReports([]); setSelected(null); }}
            className={`px-4 py-2 text-sm whitespace-nowrap transition-colors flex-shrink-0
              ${activeType === t.id
                ? 'border-b-2 border-blue-600 text-blue-700 font-medium -mb-px'
                : 'text-gray-400 hover:text-gray-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-end">
        {['term','attendance','enrollment'].includes(activeType) && (
          <Select value={filters.class_id} onChange={e => setFilters(p=>({...p,class_id:e.target.value}))} className="w-40">
            <option value="">{activeType === 'enrollment' ? 'All classes' : 'Select class…'}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
          </Select>
        )}
        {['term','attendance','fee'].includes(activeType) && (
          <Select value={filters.term} onChange={e => setFilters(p=>({...p,term:e.target.value}))} className="w-28">
            {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        )}
        {['term','attendance','enrollment','fee'].includes(activeType) && (
          <Input value={filters.academic_year}
            onChange={e => setFilters(p=>({...p,academic_year:e.target.value}))}
            className="w-28" placeholder="2025/2026" />
        )}
        {activeType === 'expense' && (
          <Input value={filters.year} type="number"
            onChange={e => setFilters(p=>({...p,year:e.target.value}))}
            className="w-24" placeholder="2025" />
        )}
        <Button onClick={handleLoad}>View report</Button>
        {activeType === 'term' && canGenerate && (
          <Button variant="primary" loading={generating} onClick={handleGenerate}>
            Generate / refresh
          </Button>
        )}
        {reports.length > 0 && (
          <Button onClick={handleDownload}>↓ Export CSV</Button>
        )}
      </div>

      <div className="flex gap-5">
        {/* Report table */}
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-16"><Spinner size="lg" /></div>
            ) : reports.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-400 text-sm">No data — select filters and click View report</p>
              </div>
            ) : activeType === 'term' ? (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  {['Pos','Student','ID','Average','Remarks'].map(h =>
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400">{h}</th>)}
                </tr></thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id} onClick={() => openReport(r)}
                      className="border-b border-gray-50 last:border-0 hover:bg-blue-50 cursor-pointer transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-700">{r.class_position}/{r.class_size}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-700">{r.student_name}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">{r.student_number}</td>
                      <td className="px-4 py-2.5">
                        <span className={`font-medium ${parseFloat(r.average_score)>=70?'text-green-600':parseFloat(r.average_score)>=55?'text-amber-600':'text-red-500'}`}>
                          {parseFloat(r.average_score).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 truncate max-w-xs">{r.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeType === 'attendance' ? (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  {['Student','ID','Present','Absent','Late','Total','Rate'].map(h =>
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400">{h}</th>)}
                </tr></thead>
                <tbody>
                  {reports.map((r,i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-gray-700">{r.student_name}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">{r.student_number}</td>
                      <td className="px-4 py-2.5 text-green-600 font-medium">{r.present}</td>
                      <td className="px-4 py-2.5 text-red-500 font-medium">{r.absent}</td>
                      <td className="px-4 py-2.5 text-amber-600">{r.late}</td>
                      <td className="px-4 py-2.5 text-gray-500">{r.total}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full">
                            <div className={`h-1.5 rounded-full ${parseFloat(r.percentage)>=80?'bg-green-400':parseFloat(r.percentage)>=60?'bg-amber-400':'bg-red-400'}`}
                              style={{ width:`${r.percentage}%` }} />
                          </div>
                          <span className="text-xs font-medium">{r.percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeType === 'enrollment' ? (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  {['Student No.','Name','Class','Gender','Year'].map(h =>
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400">{h}</th>)}
                </tr></thead>
                <tbody>
                  {reports.map((r,i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2.5 text-xs text-gray-400">{r.student_number}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-700">{r.student_name}</td>
                      <td className="px-4 py-2.5 text-gray-500">{r.class_name} {r.section}</td>
                      <td className="px-4 py-2.5 capitalize text-gray-500">{r.gender || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500">{r.academic_year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeType === 'fee' ? (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  {['Class','Students','Expected','Collected','Outstanding','Cleared','Defaulters'].map(h =>
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400">{h}</th>)}
                </tr></thead>
                <tbody>
                  {reports.map((r,i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-gray-700">{r.class_name} {r.section}</td>
                      <td className="px-4 py-2.5 text-gray-500">{r.total_students}</td>
                      <td className="px-4 py-2.5 text-gray-600">GH₵{parseFloat(r.total_expected).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-green-600 font-medium">GH₵{parseFloat(r.total_collected).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-amber-600 font-medium">GH₵{parseFloat(r.outstanding).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-green-600">{r.cleared}</td>
                      <td className="px-4 py-2.5 text-red-500">{r.defaulters}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeType === 'expense' ? (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  {['Category','Total Amount','Transactions'].map(h =>
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400">{h}</th>)}
                </tr></thead>
                <tbody>
                  {reports.map((r,i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-gray-700">{r.category}</td>
                      <td className="px-4 py-2.5 text-gray-600 font-medium">GH₵{parseFloat(r.total).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-gray-500">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        </div>

        {/* Term report detail panel */}
        {activeType === 'term' && (selected || detailLoad) && (
          <div className="w-72 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-gray-700">Report card</h2>
              <button onClick={() => setSelected(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ Close</button>
            </div>
            {detailLoad ? <div className="flex justify-center py-10"><Spinner /></div> : selected && (
              <>
                <Card className="mb-4">
                  <div className="text-center mb-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center
                                    justify-center text-sm font-bold mx-auto mb-2">
                      {selected.student_name?.split(' ').map(w=>w[0]).join('').slice(0,2)}
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{selected.student_name}</p>
                    <p className="text-xs text-gray-400">{selected.class_name} {selected.section}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      ['Average', `${parseFloat(selected.average_score||0).toFixed(1)}%`],
                      ['Position', `${selected.class_position}/${selected.class_size}`],
                      ['Term', selected.term],
                    ].map(([l,v]) => (
                      <div key={l} className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-400 mb-0.5">{l}</p>
                        <p className="text-xs font-semibold text-gray-700">{v}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card title="Subject scores" className="mb-4">
                  {(selected.subjects||[]).length === 0
                    ? <p className="text-xs text-gray-400 py-2">No grades found</p>
                    : (selected.subjects||[]).map(s => (
                        <div key={s.subject} className="flex items-center justify-between py-2
                                                          border-b border-gray-50 last:border-0">
                          <p className="text-sm text-gray-700">{s.subject}</p>
                          <div className="flex items-center gap-2">
                            <Badge color={gradeColor(s.letter_grade)}>{s.letter_grade}</Badge>
                            <span className="text-xs text-gray-400">{s.score}%</span>
                          </div>
                        </div>
                      ))
                  }
                </Card>

                {selected.remarks && (
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 mb-4">
                    <p className="text-xs font-medium text-blue-700 mb-1">Remarks</p>
                    <p className="text-xs text-blue-600">{selected.remarks}</p>
                  </div>
                )}

                <Button className="w-full" onClick={() => {
                  const w = window.open('', '_blank', 'width=500,height=700');
                  w.document.write(`<html><head><title>Report Card</title>
                    <style>
                      body{font-family:sans-serif;padding:32px;font-size:13px;color:#111}
                      h2,h3{margin:0 0 4px}
                      table{width:100%;border-collapse:collapse;margin:12px 0}
                      td,th{padding:6px 8px;border:1px solid #ddd;font-size:12px}
                      th{background:#f5f5f5;font-weight:600}
                      .center{text-align:center}.divider{border-top:2px solid #333;margin:12px 0}
                    </style></head><body>
                    <div class="center"><h2>EduClass</h2><p>School Management System</p></div>
                    <div class="divider"></div>
                    <h3>Student Term Report</h3>
                    <p><b>Name:</b> ${selected.student_name} &nbsp; <b>Class:</b> ${selected.class_name} ${selected.section}</p>
                    <p><b>Term:</b> ${selected.term} &nbsp; <b>Year:</b> ${selected.academic_year}</p>
                    <p><b>Position:</b> ${selected.class_position} out of ${selected.class_size}</p>
                    <table><thead><tr><th>Subject</th><th>Score</th><th>Grade</th></tr></thead>
                    <tbody>
                      ${(selected.subjects||[]).map(s=>`<tr><td>${s.subject}</td><td>${s.score}%</td><td>${s.letter_grade}</td></tr>`).join('')}
                    </tbody></table>
                    <p><b>Average:</b> ${parseFloat(selected.average_score||0).toFixed(1)}%</p>
                    <p><b>Remarks:</b> ${selected.remarks||''}</p>
                    <div class="divider"></div>
                    <p class="center" style="font-size:11px;color:#888">Generated by EduClass · ${new Date().toLocaleDateString()}</p>
                    </body></html>`);
                  w.document.close(); w.focus(); w.print(); w.close();
                }}>
                  🖨️ Print report card
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}