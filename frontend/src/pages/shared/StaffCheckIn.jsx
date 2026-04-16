import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import api from '../../api';
import { PageHeader, Card, Button, Spinner } from '../../components/ui';
import toast from 'react-hot-toast';

export default function StaffCheckIn() {
  const user    = useSelector(selectUser);
  const [status,   setStatus]   = useState(null);
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [time,     setTime]     = useState(new Date());

  useEffect(() => {
    const tick = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => { loadStatus(); }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const [s, h] = await Promise.all([
        api.get('/staff-attendance/today'),
        api.get('/staff-attendance/my-history'),
      ]);
      setStatus(s.data.data);
      setHistory(h.data.data);
    } catch { toast.error('Failed to load attendance'); }
    finally { setLoading(false); }
  }

  async function handleCheckIn() {
    setSaving(true);
    try {
      const { data } = await api.post('/staff-attendance/check-in');
      toast.success(data.message);
      loadStatus();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to check in'); }
    finally { setSaving(false); }
  }

  async function handleCheckOut() {
    setSaving(true);
    try {
      const { data } = await api.post('/staff-attendance/check-out');
      toast.success(data.message);
      loadStatus();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to check out'); }
    finally { setSaving(false); }
  }

  const STATUS_COLOR = {
    present:   'bg-green-100 text-green-700 border-green-200',
    late:      'bg-amber-100 text-amber-700 border-amber-200',
    absent:    'bg-red-100 text-red-700 border-red-200',
    half_day:  'bg-blue-100 text-blue-700 border-blue-200',
  };

  const checkedIn   = !!status?.check_in_time;
  const checkedOut  = !!status?.check_out_time;
  const todayDate   = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  return (
    <div className="max-w-lg">
      <PageHeader title="Check in / out" subtitle={todayDate} />

      {loading ? <div className="flex justify-center py-20"><Spinner size="lg" /></div> : (
        <>
          {/* Clock */}
          <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center mb-5">
            <p className="text-5xl font-bold text-gray-800 tabular-nums mb-1">
              {time.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
            </p>
            <p className="text-sm text-gray-400">{todayDate}</p>

            <div className="mt-6 flex flex-col items-center gap-3">
              {!checkedIn && !checkedOut && (
                <Button variant="primary" loading={saving} onClick={handleCheckIn}
                  className="px-10 py-3 text-base">
                  Check in
                </Button>
              )}
              {checkedIn && !checkedOut && (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm text-green-600 font-medium">
                      Checked in at {status.check_in_time?.slice(0,5)}
                      {status.status === 'late' && ' (Late)'}
                    </span>
                  </div>
                  <Button variant="danger" loading={saving} onClick={handleCheckOut}
                    className="px-10 py-3 text-base">
                    Check out
                  </Button>
                </>
              )}
              {checkedIn && checkedOut && (
                <div className="text-center">
                  <div className={`inline-block px-4 py-2 rounded-full border text-sm font-medium mb-3 ${STATUS_COLOR[status.status]}`}>
                    {status.status === 'late' ? '⚠️ Late' : '✓ Present'}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-400 text-xs mb-1">Check in</p>
                      <p className="font-semibold text-gray-700">{status.check_in_time?.slice(0,5)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-400 text-xs mb-1">Check out</p>
                      <p className="font-semibold text-gray-700">{status.check_out_time?.slice(0,5)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">Attendance recorded for today</p>
                </div>
              )}
            </div>
          </div>

          {/* History */}
          <Card title="Recent attendance">
            {history.length === 0
              ? <p className="text-sm text-gray-400 py-4 text-center">No attendance records yet</p>
              : <div>
                  {history.slice(0, 14).map(h => (
                    <div key={h.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          {new Date(h.date).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' })}
                        </p>
                        {h.check_in_time && (
                          <p className="text-xs text-gray-400">
                            {h.check_in_time?.slice(0,5)}
                            {h.check_out_time ? ` → ${h.check_out_time?.slice(0,5)}` : ' (no check-out)'}
                          </p>
                        )}
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full border capitalize ${STATUS_COLOR[h.status] || 'bg-gray-100 text-gray-500'}`}>
                        {h.status}
                      </span>
                    </div>
                  ))}
                </div>
            }
          </Card>
        </>
      )}
    </div>
  );
}