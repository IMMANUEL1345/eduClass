import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { feeAPI, classAPI } from '../../api';
import { PageHeader, Card, Table, Button, Select, Input, Spinner, Empty } from '../../components/ui';
import toast from 'react-hot-toast';
import PrintableReceipt from '../../components/shared/PrintableReceipt';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';

const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
const TERMS   = ['Term 1', 'Term 2', 'Term 3'];
const METHODS = ['cash','mobile_money','bank_transfer','cheque'];

// ── Quick Pay Modal ───────────────────────────────────────
function QuickPayModal({ student, filters, onClose, onSuccess }) {
  const user = useSelector(selectUser);
  const [amount,  setAmount]  = useState(parseFloat(student.balance).toFixed(2));
  const [method,  setMethod]  = useState('cash');
  const [date,    setDate]    = useState(new Date().toISOString().split('T')[0]);
  const [ref,     setRef]     = useState('');
  const [saving,  setSaving]  = useState(false);
  const [receipt, setReceipt] = useState(null);

  const outstanding   = parseFloat(student.balance);
  const amountNum     = parseFloat(amount) || 0;
  const afterPayment  = Math.max(0, outstanding - amountNum);
  const isFullPayment = afterPayment <= 0;

  async function handlePay() {
    if (!amountNum || amountNum <= 0) return toast.error('Enter a valid amount');
    if (amountNum > outstanding) return toast.error(`Amount cannot exceed outstanding balance of GH₵${outstanding.toFixed(2)}`);
    setSaving(true);
    try {
      const { data } = await feeAPI.recordPayment({
        student_id:       parseInt(student.student_id),
        fee_structure_id: parseInt(student.fee_structure_id),
        amount_paid:      amountNum,
        payment_method:   method,
        reference:        ref,
        paid_at:          date,
      });

      toast.success('Payment recorded');
      const resp = data?.data || {};

      setReceipt({
        receipt_number:   resp.receipt_number || resp.id || `RCP${Date.now().toString().slice(-8)}`,
        payment_date:     date,
        student_name:     student.student_name,
        student_number:   student.student_number,
        class_name:       student.class_name,
        section:          student.section,
        term:             filters.term,
        academic_year:    filters.academic_year,
        amount:           amountNum,
        amount_paid:      amountNum,
        payment_method:   method,
        reference:        ref,
        recorded_by_name: resp.received_by || user?.name || '—',
        fee_type:         'school_fee',
        total_fee:        parseFloat(student.total_fee),
        balance_remaining: afterPayment,
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally { setSaving(false); }
  }

  // Show receipt after payment — on close refresh defaulters list
  if (receipt) {
    return (
      <PrintableReceipt
        receipt={receipt}
        onClose={() => { setReceipt(null); onSuccess(); onClose(); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-sm font-semibold text-gray-800">Record Payment</p>
            <p className="text-xs text-gray-400 mt-0.5">{filters.term} · {filters.academic_year}</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Student info */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 text-sm font-bold
                              flex items-center justify-center flex-shrink-0">
                {student.student_name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{student.student_name}</p>
                <p className="text-xs text-gray-400">{student.student_number} · {student.class_name} {student.section}</p>
              </div>
            </div>
            {/* Fee breakdown */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-white rounded-lg p-2">
                <p className="text-gray-400 mb-0.5">Total fee</p>
                <p className="font-semibold text-gray-700">GH₵{parseFloat(student.total_fee).toFixed(2)}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2">
                <p className="text-gray-400 mb-0.5">Already paid</p>
                <p className="font-semibold text-green-600">GH₵{parseFloat(student.amount_paid).toFixed(2)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-2">
                <p className="text-gray-400 mb-0.5">Outstanding</p>
                <p className="font-bold text-red-600">GH₵{outstanding.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Amount to pay (GH₵) *
            </label>
            <input type="number" value={amount} min="0.01" step="0.01"
              max={outstanding}
              onChange={e => setAmount(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500" />

            {/* After-payment preview */}
            {amountNum > 0 && (
              <div className={`mt-2 px-3 py-2 rounded-lg text-xs font-medium ${
                isFullPayment
                  ? 'bg-green-50 text-green-700'
                  : 'bg-yellow-50 text-yellow-700'
              }`}>
                {isFullPayment
                  ? '✅ This will fully clear the student\'s balance'
                  : `⚠️ Partial payment — GH₵${afterPayment.toFixed(2)} will remain outstanding`}
              </div>
            )}
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Payment method</label>
            <select value={method} onChange={e=>setMethod(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500">
              {METHODS.map(m=>(
                <option key={m} value={m}>
                  {m.replace('_',' ').replace(/\b\w/g,l=>l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          {/* Date + Reference */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Payment date</label>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Reference (optional)</label>
              <input value={ref} onChange={e=>setRef(e.target.value)}
                placeholder="Receipt / ref no."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-sm font-medium text-gray-600
                       rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handlePay} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold
                       rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Recording…' : '💳 Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function Defaulters() {
  const navigate = useNavigate();
  const [classes,     setClasses]     = useState([]);
  const [defaulters,  setDefaulters]  = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [quickPay,    setQuickPay]    = useState(null); // selected student for modal
  const [filters,     setFilters]     = useState({
    class_id: '', term: 'Term 1', academic_year: CURRENT_YEAR,
  });

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
    { key: 'student_name',   label: 'Student',    width: '180px' },
    { key: 'student_number', label: 'ID',          width: '110px',
      render: v => <span className="text-gray-400 text-xs">{v}</span> },
    { key: 'class_name',     label: 'Class',       width: '100px',
      render: (v, row) => `${v} ${row.section}` },
    { key: 'total_fee',      label: 'Total fee',   width: '110px',
      render: v => `GH₵${parseFloat(v).toFixed(2)}` },
    { key: 'amount_paid',    label: 'Paid',        width: '110px',
      render: v => <span className="text-green-600">GH₵{parseFloat(v).toFixed(2)}</span> },
    { key: 'balance',        label: 'Outstanding', width: '110px',
      render: v => <span className="text-red-500 font-bold">GH₵{parseFloat(v).toFixed(2)}</span> },
    { key: 'actions',        label: '',            width: '80px',
      render: (_, row) => (
        <button onClick={() => setQuickPay(row)}
          className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-600
                     rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap">
          💳 Record
        </button>
      )
    },
  ];

  return (
    <div>
      <PageHeader
        title="Fee defaulters"
        subtitle="Students with outstanding balances"
        action={
          <Button onClick={() => navigate('/fees/payments/new')} variant="primary">
            + Record payment
          </Button>
        }
      />

      <div className="flex gap-3 mb-5 flex-wrap">
        <Select value={filters.class_id}
          onChange={e => setFilters(p => ({ ...p, class_id: e.target.value }))} className="w-44">
          <option value="">All classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </Select>
        <Select value={filters.term}
          onChange={e => setFilters(p => ({ ...p, term: e.target.value }))} className="w-28">
          {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input value={filters.academic_year}
          onChange={e => setFilters(p => ({ ...p, academic_year: e.target.value }))}
          className="w-28" placeholder="2025/2026" />
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
            <span className="text-sm font-medium text-amber-600">
              GH₵{totalOutstanding.toFixed(2)}
            </span>
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

      {/* Quick Pay Modal */}
      {quickPay && (
        <QuickPayModal
          student={quickPay}
          filters={filters}
          onClose={() => setQuickPay(null)}
          onSuccess={load}
        />
      )}
    </div>
  );
}