import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader, Card, Button, Input, Select, Badge, Spinner } from '../../components/ui';
import toast from 'react-hot-toast';

const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear()+1}`;
const STATUS_COLOR = { pending:'amber', approved:'blue', rejected:'red', enrolled:'green' };

export default function AdmissionsList() {
  const navigate = useNavigate();
  const [admissions, setAdmissions] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState(new Set());
  const [bulking,    setBulking]    = useState(false);
  const [filters,    setFilters]    = useState({ status:'pending', academic_year: CURRENT_YEAR, search:'' });

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const { data } = await api.get('/admissions', { params: filters });
      setAdmissions(data.data.admissions);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, []);

  function toggleOne(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const pending = admissions.filter(a => a.status === 'pending');
    if (selected.size === pending.length) setSelected(new Set());
    else setSelected(new Set(pending.map(a => a.id)));
  }

  async function handleBulkApprove() {
    if (selected.size === 0) return toast.error('Select at least one application');
    if (!window.confirm(`Approve ${selected.size} application(s) and create student accounts?`)) return;
    setBulking(true);
    let success = 0; let failed = 0;
    for (const id of selected) {
      try {
        await api.post(`/admissions/${id}/approve`);
        success++;
      } catch { failed++; }
    }
    toast.success(`${success} approved${failed > 0 ? `, ${failed} failed` : ''}`);
    setBulking(false);
    load();
  }

  const pendingCount = admissions.filter(a => a.status === 'pending').length;

  return (
    <div>
      <PageHeader title="All applications"
        action={
          <div className="flex gap-2">
            {selected.size > 0 && (
              <Button variant="primary" loading={bulking} onClick={handleBulkApprove}>
                ✓ Approve selected ({selected.size})
              </Button>
            )}
            <Button variant="primary" onClick={() => navigate('/admissions/new')}>+ New application</Button>
          </div>
        }
      />

      <div className="flex gap-3 mb-5 flex-wrap">
        <Input placeholder="Search name…" value={filters.search}
          onChange={e => setFilters(p=>({...p,search:e.target.value}))} className="w-48" />
        <Select value={filters.status} onChange={e => setFilters(p=>({...p,status:e.target.value}))} className="w-36">
          <option value="">All statuses</option>
          {['pending','approved','rejected','enrolled'].map(s =>
            <option key={s} value={s}>{s}</option>)}
        </Select>
        <Input value={filters.academic_year}
          onChange={e => setFilters(p=>({...p,academic_year:e.target.value}))} className="w-28" />
        <Button onClick={load}>Search</Button>
      </div>

      <Card>
        {loading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : (
          admissions.length === 0
            ? <p className="text-sm text-gray-400 py-8 text-center">No applications found</p>
            : <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="w-10 px-4 py-3">
                      {pendingCount > 0 && (
                        <input type="checkbox"
                          checked={selected.size === pendingCount && pendingCount > 0}
                          onChange={toggleAll}
                          className="rounded border-gray-300" />
                      )}
                    </th>
                    {['Admission #','Name','Class','Parent','Status','Date',''].map(h =>
                      <th key={h} className="text-left px-2 py-3 text-xs font-medium text-gray-400">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {admissions.map(a => (
                    <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        {a.status === 'pending' && (
                          <input type="checkbox"
                            checked={selected.has(a.id)}
                            onChange={() => toggleOne(a.id)}
                            className="rounded border-gray-300" />
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-xs text-gray-400">{a.admission_number}</td>
                      <td className="px-2 py-2.5 font-medium text-gray-700">{a.applicant_name}</td>
                      <td className="px-2 py-2.5 text-gray-500">{a.class_applied}</td>
                      <td className="px-2 py-2.5 text-gray-500">{a.parent_name || '—'}</td>
                      <td className="px-2 py-2.5">
                        <Badge color={STATUS_COLOR[a.status]}>{a.status}</Badge>
                      </td>
                      <td className="px-2 py-2.5 text-gray-400 text-xs">
                        {new Date(a.created_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-2 py-2.5">
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