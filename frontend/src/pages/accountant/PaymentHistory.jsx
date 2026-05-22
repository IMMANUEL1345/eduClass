import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { feeAPI, classAPI } from '../../api';
import { PageHeader, Button, Select, Input, Badge, Spinner } from '../../components/ui';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import PrintableReceipt from '../../components/shared/PrintableReceipt';

const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
const TERMS        = ['Term 1','Term 2','Term 3'];
const METHOD_COLOR = { cash:'green', mobile_money:'blue', bank_transfer:'purple', cheque:'amber' };

export default function PaymentHistory() {
  const navigate = useNavigate();
  const [classes,  setClasses]  = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [receipt,  setReceipt]  = useState(null);
  const [filters,  setFilters]  = useState({
    class_id:'', term:'', academic_year: CURRENT_YEAR,
  });

  const totalCollected = payments.reduce((s, p) => s + parseFloat(p.amount_paid), 0);

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

  function openReceipt(p) {
    setReceipt({
      receipt_number:   p.receipt_number || p.id,
      payment_date:     p.paid_at,
      student_name:     p.student_name,
      student_number:   p.student_number,
      class_name:       p.class_name,
      section:          p.section,
      term:             p.term,
      academic_year:    p.academic_year,
      amount:           parseFloat(p.amount_paid),
      amount_paid:      parseFloat(p.amount_paid),
      payment_method:   p.payment_method,
      reference:        p.reference,
      recorded_by_name: p.received_by,
      fee_type:         'school_fee',
      // balance_remaining not available from history list — show neutral
    });
  }

  function downloadCSV() {
    const headers = ['Date','Student','ID','Class','Term','Amount','Method','Reference','Received By'];
    const rows = payments.map(p => [
      format(new Date(p.paid_at), 'dd/MM/yyyy'),
      p.student_name, p.student_number,
      `${p.class_name} ${p.section}`,
      p.term, p.amount_paid,
      p.payment_method?.replace('_',' '),
      p.reference || '', p.received_by,
    ]);
    const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `payments_${filters.term || 'all'}_${filters.academic_year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader title="Payment history" subtitle="All recorded fee payments"
        action={
          <div className="flex gap-2">
            <Button onClick={downloadCSV}>↓ Export CSV</Button>
            <Button variant="primary" onClick={() => navigate('/fees/payments/new')}>
              + Record payment
            </Button>
          </div>
        }
      />

      <div className="flex gap-3 mb-5 flex-wrap">
        <Select value={filters.class_id}
          onChange={e => setFilters(p=>({...p,class_id:e.target.value}))} className="w-44">
          <option value="">All classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </Select>
        <Select value={filters.term}
          onChange={e => setFilters(p=>({...p,term:e.target.value}))} className="w-28">
          <option value="">All terms</option>
          {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input value={filters.academic_year}
          onChange={e => setFilters(p=>({...p,academic_year:e.target.value}))} className="w-28" />
        <Button onClick={load}>Apply</Button>
      </div>

      {payments.length > 0 && (
        <div className="flex gap-4 mb-4">
          <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-2">
            <span className="text-xs text-green-600">Total collected: </span>
            <span className="text-sm font-medium text-green-700">
              GH₵{totalCollected.toFixed(2)}
            </span>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">
            <span className="text-xs text-blue-600">Transactions: </span>
            <span className="text-sm font-medium text-blue-700">{payments.length}</span>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : payments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No payments found</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Date','Student','Class','Term','Amount','Method','Reference','By',''].map(h => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-medium text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                    {format(new Date(p.paid_at),'dd MMM yyyy')}
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="text-sm font-medium text-gray-700">{p.student_name}</p>
                    <p className="text-xs text-gray-400">{p.student_number}</p>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap">
                    {p.class_name} {p.section}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-500">{p.term}</td>
                  <td className="px-3 py-2.5 font-medium text-green-600 whitespace-nowrap">
                    GH₵{parseFloat(p.amount_paid).toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge color={METHOD_COLOR[p.payment_method] || 'gray'}>
                      {p.payment_method?.replace('_',' ')}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">{p.reference || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">{p.received_by}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => openReceipt(p)}
                      className="text-xs text-blue-600 hover:underline whitespace-nowrap">
                      🖨️ Receipt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {receipt && (
        <PrintableReceipt receipt={receipt} onClose={() => setReceipt(null)} />
      )}
    </div>
  );
}