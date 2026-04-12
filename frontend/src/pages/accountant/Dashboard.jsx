import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { feeAPI } from '../../api';
import { StatCard, Card, PageHeader, Badge, Spinner } from '../../components/ui';
import toast from 'react-hot-toast';

const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
const TERMS = ['Term 1', 'Term 2', 'Term 3'];

export default function AccountantDashboard() {
  const navigate = useNavigate();
  const [term,     setTerm]     = useState('Term 1');
  const [year,     setYear]     = useState(CURRENT_YEAR);
  const [summary,  setSummary]  = useState(null);
  const [loading,  setLoading]  = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await feeAPI.summary({ term, academic_year: year });
      setSummary(data.data);
    } catch { toast.error('Failed to load fee summary'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [term, year]);

  const t = summary?.totals;
  const collectionRate = t && parseFloat(t.total_expected) > 0
    ? Math.round((parseFloat(t.total_collected) / parseFloat(t.total_expected)) * 100)
    : 0;

  return (
    <div>
      <PageHeader title="Fee management" subtitle="Collection overview" />

      {/* Term selector */}
      <div className="flex gap-3 items-center mb-6">
        <select value={term} onChange={e => setTerm(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={year} onChange={e => setYear(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white w-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="2025/2026" />
      </div>

      {loading ? <div className="flex justify-center py-20"><Spinner size="lg" /></div> : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard label="Total expected"   value={t ? `GH₵${parseFloat(t.total_expected).toLocaleString()}` : '—'}    color="blue"   />
            <StatCard label="Total collected"  value={t ? `GH₵${parseFloat(t.total_collected).toLocaleString()}` : '—'}   color="green"  sub={`${collectionRate}% collection rate`} />
            <StatCard label="Outstanding"      value={t ? `GH₵${parseFloat(t.total_outstanding).toLocaleString()}` : '—'} color="amber"  />
            <StatCard label="Defaulters"       value={t ? t.defaulters_count : '—'}  color="red"    sub={`${t?.cleared_count ?? 0} cleared`} />
          </div>

          {/* Quick actions */}
          <div className="flex gap-3 mb-6">
            {[
              { label: '+ Record payment',    path: '/fees/payments/new'  },
              { label: 'View defaulters',     path: '/fees/defaulters'    },
              { label: 'Cleared students',    path: '/fees/cleared'       },
              { label: 'Fee structures',      path: '/fees/structures'    },
              { label: 'Payment history',     path: '/fees/payments'      },
            ].map(a => (
              <button key={a.path} onClick={() => navigate(a.path)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 transition-colors">
                {a.label}
              </button>
            ))}
          </div>

          {/* Per class breakdown */}
          <Card title="Collection by class">
            {!summary?.by_class?.length
              ? <p className="text-sm text-gray-400 py-4 text-center">No fee data for this term yet</p>
              : <div>
                  <div className="grid grid-cols-5 py-1.5 text-xs font-medium text-gray-400 border-b border-gray-50 mb-1">
                    <span>Class</span>
                    <span>Students</span>
                    <span>Expected</span>
                    <span>Collected</span>
                    <span>Rate</span>
                  </div>
                  {summary.by_class.map(c => {
                    const rate = parseFloat(c.expected) > 0
                      ? Math.round(parseFloat(c.collected) / parseFloat(c.expected) * 100)
                      : 0;
                    return (
                      <div key={`${c.class_name}-${c.section}`}
                        className="grid grid-cols-5 py-2.5 border-b border-gray-50 last:border-0 items-center">
                        <span className="text-sm font-medium text-gray-700">{c.class_name} {c.section}</span>
                        <span className="text-sm text-gray-500">{c.students}</span>
                        <span className="text-sm text-gray-500">GH₵{parseFloat(c.expected).toLocaleString()}</span>
                        <span className="text-sm text-gray-500">GH₵{parseFloat(c.collected).toLocaleString()}</span>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                            <div className={`h-1.5 rounded-full ${rate >= 80 ? 'bg-green-400' : rate >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                              style={{ width: `${rate}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 w-8">{rate}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
            }
          </Card>
        </>
      )}
    </div>
  );
}