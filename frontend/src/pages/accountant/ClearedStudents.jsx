import React, { useState } from 'react';
import { feeAPI, classAPI } from '../../api';
import { PageHeader, Card, Table, Button, Select, Input, Badge, Spinner, Empty } from '../../components/ui';
import toast from 'react-hot-toast';

const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
const TERMS = ['Term 1', 'Term 2', 'Term 3'];

export default function ClearedStudents() {
  const [classes,  setClasses]  = useState([]);
  const [cleared,  setCleared]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [filters,  setFilters]  = useState({ class_id: '', term: 'Term 1', academic_year: CURRENT_YEAR });

  React.useEffect(() => {
    classAPI.list({}).then(({ data }) => setClasses(data.data)).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await feeAPI.cleared(filters);
      setCleared(data.data);
    } catch { toast.error('Failed to load cleared students'); }
    finally { setLoading(false); }
  }

  const columns = [
    { key: 'student_name',   label: 'Student',    width: '200px' },
    { key: 'student_number', label: 'ID',          width: '110px', render: v => <span className="text-gray-400 text-xs">{v}</span> },
    { key: 'class_name',     label: 'Class',       width: '120px', render: (v, row) => `${v} ${row.section}` },
    { key: 'total_fee',      label: 'Fee',         width: '110px', render: v => `GH₵${parseFloat(v).toFixed(2)}` },
    { key: 'amount_paid',    label: 'Paid',        width: '110px', render: v => <span className="text-green-600 font-medium">GH₵{parseFloat(v).toFixed(2)}</span> },
    { key: 'status',         label: 'Status',      width: '90px',  render: () => <Badge color="green">Cleared</Badge> },
  ];

  return (
    <div>
      <PageHeader title="Cleared students" subtitle="Students who have fully paid fees" />

      <div className="flex gap-3 mb-5 flex-wrap">
        <Select value={filters.class_id} onChange={e => setFilters(p => ({ ...p, class_id: e.target.value }))} className="w-44">
          <option value="">All classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </Select>
        <Select value={filters.term} onChange={e => setFilters(p => ({ ...p, term: e.target.value }))} className="w-28">
          {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input value={filters.academic_year} onChange={e => setFilters(p => ({ ...p, academic_year: e.target.value }))} className="w-28" />
        <Button onClick={load}>View</Button>
      </div>

      {cleared.length > 0 && (
        <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-2 mb-4 inline-block">
          <span className="text-xs text-green-600">Cleared: </span>
          <span className="text-sm font-medium text-green-700">{cleared.length} students</span>
        </div>
      )}

      <Card>
        {loading
          ? <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          : cleared.length === 0
            ? <Empty message="No cleared students found — select a term and click View" />
            : <Table columns={columns} data={cleared} />
        }
      </Card>
    </div>
  );
}