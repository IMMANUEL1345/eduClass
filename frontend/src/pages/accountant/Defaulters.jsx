import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { feeAPI, classAPI } from '../../api';
import { PageHeader, Card, Table, Button, Select, Input, Badge, Spinner, Empty } from '../../components/ui';
import toast from 'react-hot-toast';

const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
const TERMS = ['Term 1', 'Term 2', 'Term 3'];

export default function Defaulters() {
  const navigate = useNavigate();
  const [classes,    setClasses]    = useState([]);
  const [defaulters, setDefaulters] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [filters,    setFilters]    = useState({ class_id: '', term: 'Term 1', academic_year: CURRENT_YEAR });

  React.useEffect(() => {
    classAPI.list({}).then(({ data }) => setClasses(data.data)).catch(() => {});
  }, []);

  async function load() {
    if (!filters.term || !filters.academic_year) return toast.error('Select term and year');
    setLoading(true);
    try {
      const { data } = await feeAPI.defaulters(filters);
      setDefaulters(data.data);
    } catch { toast.error('Failed to load defaulters'); }
    finally { setLoading(false); }
  }

  const totalOutstanding = defaulters.reduce((sum, d) => sum + parseFloat(d.balance), 0);

  const columns = [
    { key: 'student_name',   label: 'Student',   width: '180px' },
    { key: 'student_number', label: 'ID',         width: '110px', render: v => <span className="text-gray-400 text-xs">{v}</span> },
    { key: 'class_name',     label: 'Class',      width: '100px', render: (v, row) => `${v} ${row.section}` },
    { key: 'total_fee',      label: 'Total fee',  width: '110px', render: v => `GH₵${parseFloat(v).toFixed(2)}` },
    { key: 'amount_paid',    label: 'Paid',       width: '110px', render: v => <span className="text-green-600">GH₵{parseFloat(v).toFixed(2)}</span> },
    { key: 'balance',        label: 'Balance',    width: '110px', render: v => <span className="text-red-500 font-medium">GH₵{parseFloat(v).toFixed(2)}</span> },
    { key: 'actions',        label: '',           width: '80px',
      render: (_, row) => (
        <button onClick={() => navigate('/fees/payments/new', { state: { student_id: row.student_id } })}
          className="text-xs text-blue-600 hover:underline">
          Record
        </button>
      )
    },
  ];

  return (
    <div>
      <PageHeader
        title="Fee defaulters"
        subtitle="Students with outstanding balances"
        action={<Button onClick={() => navigate('/fees/payments/new')} variant="primary">+ Record payment</Button>}
      />

      <div className="flex gap-3 mb-5 flex-wrap">
        <Select value={filters.class_id} onChange={e => setFilters(p => ({ ...p, class_id: e.target.value }))} className="w-44">
          <option value="">All classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </Select>
        <Select value={filters.term} onChange={e => setFilters(p => ({ ...p, term: e.target.value }))} className="w-28">
          {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input value={filters.academic_year} onChange={e => setFilters(p => ({ ...p, academic_year: e.target.value }))} className="w-28" placeholder="2025/2026" />
        <Button onClick={load}>View</Button>
      </div>

      {defaulters.length > 0 && (
        <div className="flex gap-4 mb-4">
          <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-2">
            <span className="text-xs text-red-500">Defaulters: </span>
            <span className="text-sm font-medium text-red-600">{defaulters.length} students</span>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-2">
            <span className="text-xs text-amber-500">Total outstanding: </span>
            <span className="text-sm font-medium text-amber-600">GH₵{totalOutstanding.toFixed(2)}</span>
          </div>
        </div>
      )}

      <Card>
        {loading
          ? <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          : defaulters.length === 0
            ? <Empty message="No defaulters found — select a term and click View" />
            : <Table columns={columns} data={defaulters} />
        }
      </Card>
    </div>
  );
}