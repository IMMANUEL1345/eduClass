import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { feeAPI, classAPI } from '../../api';
import { PageHeader, Card, Table, Button, Select, Input, Badge, Spinner, Empty } from '../../components/ui';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const METHOD_COLOR = { cash: 'green', mobile_money: 'blue', bank_transfer: 'purple', cheque: 'amber' };

export default function PaymentHistory() {
  const navigate = useNavigate();
  const [classes,  setClasses]  = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [filters,  setFilters]  = useState({
    class_id: '', term: '', academic_year: CURRENT_YEAR,
  });

  const totalCollected = payments.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0);

  useEffect(() => {
    classAPI.list({}).then(({ data }) => setClasses(data.data)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.class_id)      params.class_id      = filters.class_id;
      if (filters.term)          params.term          = filters.term;
      if (filters.academic_year) params.academic_year = filters.academic_year;
      const { data } = await feeAPI.listPayments(params);
      setPayments(data.data);
    } catch { toast.error('Failed to load payments'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, []);

  const columns = [
    { key: 'paid_at',        label: 'Date',        width: '110px',
      render: v => format(new Date(v), 'dd MMM yyyy') },
    { key: 'student_name',   label: 'Student',     width: '160px' },
    { key: 'student_number', label: 'ID',           width: '100px', render: v => <span className="text-gray-400 text-xs">{v}</span> },
    { key: 'class_name',     label: 'Class',        width: '100px', render: (v, row) => `${v} ${row.section}` },
    { key: 'term',           label: 'Term',         width: '80px'  },
    { key: 'amount_paid',    label: 'Amount',       width: '110px',
      render: v => <span className="font-medium text-green-600">GH₵{parseFloat(v).toFixed(2)}</span> },
    { key: 'payment_method', label: 'Method',       width: '120px',
      render: v => <Badge color={METHOD_COLOR[v] || 'gray'}>{v?.replace('_',' ')}</Badge> },
    { key: 'reference',      label: 'Reference',    width: '110px', render: v => v || '—' },
    { key: 'received_by',    label: 'Received by',  width: '120px', render: v => <span className="text-gray-400 text-xs">{v}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Payment history"
        subtitle="All recorded fee payments"
        action={
          <Button variant="primary" onClick={() => navigate('/fees/payments/new')}>
            + Record payment
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-end">
        <Select value={filters.class_id} onChange={e => setFilters(p => ({ ...p, class_id: e.target.value }))} className="w-44">
          <option value="">All classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </Select>
        <Select value={filters.term} onChange={e => setFilters(p => ({ ...p, term: e.target.value }))} className="w-28">
          <option value="">All terms</option>
          {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input
          value={filters.academic_year}
          onChange={e => setFilters(p => ({ ...p, academic_year: e.target.value }))}
          className="w-28" placeholder="2025/2026"
        />
        <Button onClick={load}>Apply</Button>
      </div>

      {/* Summary */}
      {payments.length > 0 && (
        <div className="flex gap-4 mb-4">
          <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-2">
            <span className="text-xs text-green-600">Total collected: </span>
            <span className="text-sm font-medium text-green-700">GH₵{totalCollected.toFixed(2)}</span>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">
            <span className="text-xs text-blue-600">Transactions: </span>
            <span className="text-sm font-medium text-blue-700">{payments.length}</span>
          </div>
        </div>
      )}

      <Card>
        {loading
          ? <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          : payments.length === 0
            ? <Empty message="No payments found" />
            : <Table columns={columns} data={payments} />
        }
      </Card>
    </div>
  );
}