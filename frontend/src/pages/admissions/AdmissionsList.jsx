import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader, Card, Button, Input, Select, Badge, Spinner } from '../../components/ui';
import toast from 'react-hot-toast';

const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
const STATUS_COLOR = { pending:'amber', approved:'blue', rejected:'red', enrolled:'green' };

export default function AdmissionsList() {
  const navigate = useNavigate();
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filters, setFilters]       = useState({ status:'', academic_year: CURRENT_YEAR, search:'' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admissions', { params: filters });
      setAdmissions(data.data.admissions);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader title="All applications"
        action={<Button variant="primary" onClick={() => navigate('/admissions/new')}>+ New application</Button>}
      />

      <div className="flex gap-3 mb-5 flex-wrap">
        <Input placeholder="Search name…" value={filters.search}
          onChange={e => setFilters(p => ({ ...p, search: e.target.value }))} className="w-48" />
        <Select value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))} className="w-36">
          <option value="">All statuses</option>
          {['pending','approved','rejected','enrolled'].map(s =>
            <option key={s} value={s} className="capitalize">{s}</option>)}
        </Select>
        <Input value={filters.academic_year}
          onChange={e => setFilters(p => ({ ...p, academic_year: e.target.value }))} className="w-28" />
        <Button onClick={load}>Search</Button>
      </div>

      <Card>
        {loading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : (
          admissions.length === 0
            ? <p className="text-sm text-gray-400 py-8 text-center">No applications found</p>
            : <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    {['Admission #','Name','Class','Parent','Status','Date',''].map(h =>
                      <th key={h} className="text-left py-2 pr-4 font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {admissions.map(a => (
                    <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="py-2.5 pr-4 text-xs text-gray-400">{a.admission_number}</td>
                      <td className="py-2.5 pr-4 font-medium text-gray-700">{a.applicant_name}</td>
                      <td className="py-2.5 pr-4 text-gray-500">{a.class_applied}</td>
                      <td className="py-2.5 pr-4 text-gray-500">{a.parent_name || '—'}</td>
                      <td className="py-2.5 pr-4">
                        <Badge color={STATUS_COLOR[a.status]}>{a.status}</Badge>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-400 text-xs">
                        {new Date(a.created_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="py-2.5">
                        <button onClick={() => navigate(`/admissions/${a.id}`)}
                          className="text-xs text-blue-600 hover:underline">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        )}
      </Card>
    </div>
  );
}