import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader, Card, StatCard, Badge, Button, Spinner } from '../../components/ui';
import toast from 'react-hot-toast';

const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;

export default function AdmissionsDashboard() {
  const navigate = useNavigate();
  const [stats,   setStats]   = useState(null);
  const [recent,  setRecent]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [year,    setYear]    = useState(CURRENT_YEAR);

  useEffect(() => { load(); }, [year]);

  async function load() {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        api.get('/admissions/stats', { params: { academic_year: year } }),
        api.get('/admissions', { params: { academic_year: year, limit: 8, status: 'pending' } }),
      ]);
      setStats(s.data.data);
      setRecent(r.data.data.admissions);
    } catch { toast.error('Failed to load admissions'); }
    finally { setLoading(false); }
  }

  const STATUS_COLOR = { pending:'amber', approved:'blue', rejected:'red', enrolled:'green' };

  return (
    <div>
      <PageHeader
        title="Admissions"
        subtitle={`Academic year ${year}`}
        action={
          <div className="flex gap-2">
            <input value={year} onChange={e => setYear(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg w-28"
              placeholder="2025/2026" />
            <Button variant="primary" onClick={() => navigate('/admissions/new')}>
              + New application
            </Button>
          </div>
        }
      />

      {loading ? <div className="flex justify-center py-20"><Spinner size="lg" /></div> : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard label="Pending"  value={stats?.pending  || 0} color="amber"  sub="Awaiting review"   />
            <StatCard label="Approved" value={stats?.approved || 0} color="blue"   sub="Ready to enroll"   />
            <StatCard label="Enrolled" value={stats?.enrolled || 0} color="green"  sub="Accounts created"  />
            <StatCard label="Rejected" value={stats?.rejected || 0} color="red"    sub="Not admitted"      />
          </div>

          <Card title="Pending applications"
            action={<button onClick={() => navigate('/admissions/list')} className="text-xs text-blue-600 hover:underline">View all</button>}>
            {recent.length === 0
              ? <p className="text-sm text-gray-400 py-6 text-center">No pending applications</p>
              : <div>
                  {recent.map(a => (
                    <div key={a.id}
                      onClick={() => navigate(`/admissions/${a.id}`)}
                      className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 -mx-1 px-1 rounded">
                      <div>
                        <p className="text-sm font-medium text-gray-700">{a.applicant_name}</p>
                        <p className="text-xs text-gray-400">{a.class_applied} · {a.admission_number}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge color={STATUS_COLOR[a.status]}>{a.status}</Badge>
                        <span className="text-xs text-gray-400">
                          {new Date(a.created_at).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </Card>

          <div className="mt-5">
            <p className="text-xs font-medium text-gray-400 mb-3">Quick actions</p>
            <div className="flex gap-3 flex-wrap">
              {[
                { label: '+ New application', path: '/admissions/new'  },
                { label: 'All applications',  path: '/admissions/list' },
              ].map(a => (
                <button key={a.path} onClick={() => navigate(a.path)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50">
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}