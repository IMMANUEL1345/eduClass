import React, { useEffect, useState } from 'react';
import api from '../../api';
import { PageHeader, Card, StatCard, Button, Input, Select, Spinner, Badge } from '../../components/ui';
import toast from 'react-hot-toast';

const STATUS_COLOR = { present:'green', late:'amber', absent:'red', half_day:'blue' };

export default function StaffAttendance() {
  const [date,     setDate]     = useState(new Date().toISOString().split('T')[0]);
  const [overview, setOverview] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [showManual, setShowManual] = useState(null);
  const [manualForm, setManualForm] = useState({ status:'present', notes:'' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [date]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/staff-attendance/daily', { params: { date } });
      setOverview(data.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }

  async function handleManual(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/staff-attendance/manual', {
        user_id: showManual.id, date, ...manualForm,
      });
      toast.success('Attendance recorded');
      setShowManual(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  }

  function downloadCSV() {
    if (!overview?.staff) return;
    const rows = overview.staff.map(s => [
      s.name, s.role,
      s.attendance?.check_in_time?.slice(0,5) || '—',
      s.attendance?.check_out_time?.slice(0,5) || '—',
      s.status,
    ]);
    const csv = [['Name','Role','Check In','Check Out','Status'], ...rows].map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href=url; a.download=`staff_attendance_${date}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader title="Staff attendance" subtitle="Daily check-in overview"
        action={
          <div className="flex gap-2">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-36" />
            <Button onClick={downloadCSV}>↓ Export</Button>
          </div>
        }
      />

      {loading ? <div className="flex justify-center py-20"><Spinner size="lg" /></div> : overview && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-5">
            <StatCard label="Total staff"  value={overview.summary.total}   color="blue"  />
            <StatCard label="Present"      value={overview.summary.present} color="green" />
            <StatCard label="Late"         value={overview.summary.late}    color="amber" />
            <StatCard label="Absent"       value={overview.summary.absent}  color="red"   />
          </div>

          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Name','Role','Check in','Check out','Status',''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overview.staff.map(s => (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-gray-700">{s.name}</td>
                    <td className="px-4 py-2.5 capitalize text-gray-500 text-xs">{s.role.replace('_',' ')}</td>
                    <td className="px-4 py-2.5 text-gray-500">{s.attendance?.check_in_time?.slice(0,5) || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{s.attendance?.check_out_time?.slice(0,5) || '—'}</td>
                    <td className="px-4 py-2.5">
                      <Badge color={STATUS_COLOR[s.status] || 'gray'}>{s.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => { setShowManual(s); setManualForm({ status: s.status === 'absent' ? 'present' : s.status, notes:'' }); }}
                        className="text-xs text-blue-600 hover:underline">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {showManual && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-base font-medium text-gray-800 mb-1">Manual attendance</h2>
            <p className="text-xs text-gray-400 mb-5">{showManual.name} · {date}</p>
            <form onSubmit={handleManual} className="flex flex-col gap-3">
              <Select label="Status" value={manualForm.status} onChange={e => setManualForm(p=>({...p,status:e.target.value}))}>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="half_day">Half day</option>
              </Select>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Notes</label>
                <textarea rows={2} value={manualForm.notes} onChange={e => setManualForm(p=>({...p,notes:e.target.value}))}
                  placeholder="Optional reason…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex justify-end gap-3 mt-2">
                <Button type="button" onClick={() => setShowManual(null)}>Cancel</Button>
                <Button type="submit" variant="primary" loading={saving}>Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}