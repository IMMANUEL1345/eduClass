import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';

const API = process.env.REACT_APP_API_URL || 'https://educlass-api.onrender.com';

const CATEGORIES = [
  'Misconduct','Bullying','Violence','Insubordination',
  'Academic Dishonesty','Harassment','Lateness / Truancy',
  'Vandalism','Substance Abuse','Cyberbullying','Other',
];

const SEV_COLOR = {
  low:      'bg-green-100 text-green-700',
  medium:   'bg-yellow-100 text-yellow-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};
const STATUS_COLOR = {
  open:         'bg-blue-100 text-blue-700',
  under_review: 'bg-purple-100 text-purple-700',
  resolved:     'bg-green-100 text-green-700',
  dismissed:    'bg-gray-100 text-gray-500',
};

export default function IncidentReports() {
  const user     = useSelector(selectUser);
  const navigate = useNavigate();
  const token    = sessionStorage.getItem('token');

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', severity: '', category: '' });

  useEffect(() => { fetchReports(); }, [filters]);

  async function fetchReports() {
    setLoading(true);
    try {
      const q   = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v]) => v)));
      const res = await fetch(`${API}/api/incidents?${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setReports(data.data || []);
    } catch {}
    setLoading(false);
  }

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Incident Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Disciplinary and behavioural reports</p>
        </div>
        <button onClick={() => navigate('/incidents/new')}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          🚩 File a Report
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 flex gap-3 flex-wrap">
        {[
          { key: 'status',   label: 'All statuses',
            options: [['open','Open'],['under_review','Under review'],['resolved','Resolved'],['dismissed','Dismissed']] },
          { key: 'severity', label: 'All severities',
            options: [['low','Low'],['medium','Medium'],['high','High'],['critical','Critical']] },
          { key: 'category', label: 'All categories',
            options: CATEGORIES.map(c => [c, c]) },
        ].map(({ key, label, options }) => (
          <select key={key} value={filters[key]} onChange={e => setFilter(key, e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">{label}</option>
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        {Object.values(filters).some(Boolean) && (
          <button onClick={() => setFilters({ status:'', severity:'', category:'' })}
            className="text-sm text-gray-400 hover:text-gray-600 px-2">
            Clear filters ✕
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-2xl mb-2">📋</p>
            <p className="text-sm text-gray-400">No reports found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                  {['Subject','Category','Severity','Status','Reported by','Date','Files'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reports.map(r => (
                  <tr key={r.id} onClick={() => navigate(`/incidents/${r.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{r.subject_name}</p>
                      <p className="text-xs text-gray-400 capitalize">{r.subject_role?.replace('_',' ')}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.category}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${SEV_COLOR[r.severity]}`}>
                        {r.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLOR[r.status]}`}>
                        {r.status?.replace('_',' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.reporter_name}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {new Date(r.incident_date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {r.attachment_count > 0 ? `📎 ${r.attachment_count}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}