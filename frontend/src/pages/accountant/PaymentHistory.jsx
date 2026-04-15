import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { feeAPI, classAPI } from '../../api';
import { PageHeader, Card, Button, Select, Input, Badge, Spinner } from '../../components/ui';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
const TERMS        = ['Term 1','Term 2','Term 3'];
const METHOD_COLOR = { cash:'green', mobile_money:'blue', bank_transfer:'purple', cheque:'amber' };

function PrintReceipt({ receipt, onClose }) {
  const ref = useRef();

  function handlePrint() {
    const content = ref.current.innerHTML;
    const w = window.open('', '_blank', 'width=400,height=600');
    w.document.write(`<html><head><title>Fee Receipt</title>
      <style>
        body{font-family:sans-serif;padding:24px;font-size:13px;color:#111}
        .text-center{text-align:center}.divider{border-top:1px dashed #ccc;margin:12px 0}
        table{width:100%;border-collapse:collapse}
        td{padding:5px 0}td:last-child{text-align:right;font-weight:600}
        .total{font-size:16px;font-weight:700}.footer{text-align:center;margin-top:20px;font-size:11px;color:#888}
        @media print{button{display:none}}
      </style></head><body>${content}</body></html>`);
    w.document.close(); w.focus(); w.print(); w.close();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
        <div ref={ref}>
          <div className="text-center mb-4">
            <h2 className="text-lg font-bold text-gray-800">EduClass</h2>
            <p className="text-xs text-gray-500">School Management System</p>
            <p className="text-xs text-gray-400">Faculty of Engineering · Dept. of ICT</p>
          </div>
          <div className="text-center mb-3">
            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">OFFICIAL RECEIPT</span>
          </div>
          <div className="border-t border-dashed border-gray-200 my-3" />
          <table className="w-full text-sm mb-3">
            <tbody>
              {[
                ['Receipt No.',    receipt.id],
                ['Date',          receipt.paid_at ? format(new Date(receipt.paid_at), 'dd MMM yyyy') : '—'],
                ['Student',       receipt.student_name],
                ['Student No.',   receipt.student_number],
                ['Class',         `${receipt.class_name} ${receipt.section || ''}`],
                ['Term',          receipt.term],
                ['Academic Year', receipt.academic_year],
                ['Payment Method',receipt.payment_method?.replace('_',' ')],
                receipt.reference ? ['Reference', receipt.reference] : null,
              ].filter(Boolean).map(([k,v]) => (
                <tr key={k}>
                  <td className="py-1 text-gray-500">{k}</td>
                  <td className="py-1 text-right font-medium capitalize text-gray-800">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-dashed border-gray-200 my-3" />
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-500">Amount Paid</span>
            <span className="text-xl font-bold text-green-600">GH₵{parseFloat(receipt.amount_paid).toFixed(2)}</span>
          </div>
          <div className="border-t border-dashed border-gray-200 my-3" />
          <p className="text-xs text-center text-gray-400">
            Received by: {receipt.received_by}<br />Thank you for your payment
          </p>
        </div>
        <div className="flex gap-3 mt-5">
          <Button className="flex-1" onClick={onClose}>Close</Button>
          <Button className="flex-1" variant="primary" onClick={handlePrint}>🖨️ Print</Button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentHistory() {
  const navigate = useNavigate();
  const [classes,  setClasses]  = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [receipt,  setReceipt]  = useState(null);
  const [filters,  setFilters]  = useState({ class_id:'', term:'', academic_year: CURRENT_YEAR });

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
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `payments_${filters.term || 'all'}_${filters.academic_year}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader title="Payment history" subtitle="All recorded fee payments"
        action={
          <div className="flex gap-2">
            <Button onClick={downloadCSV}>↓ Export CSV</Button>
            <Button variant="primary" onClick={() => navigate('/fees/payments/new')}>+ Record payment</Button>
          </div>
        }
      />

      <div className="flex gap-3 mb-5 flex-wrap">
        <Select value={filters.class_id} onChange={e => setFilters(p=>({...p,class_id:e.target.value}))} className="w-44">
          <option value="">All classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </Select>
        <Select value={filters.term} onChange={e => setFilters(p=>({...p,term:e.target.value}))} className="w-28">
          <option value="">All terms</option>
          {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input value={filters.academic_year} onChange={e => setFilters(p=>({...p,academic_year:e.target.value}))} className="w-28" />
        <Button onClick={load}>Apply</Button>
      </div>

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
                  <td className="px-3 py-2.5 text-xs text-gray-500">{format(new Date(p.paid_at),'dd MMM yyyy')}</td>
                  <td className="px-3 py-2.5">
                    <p className="text-sm font-medium text-gray-700">{p.student_name}</p>
                    <p className="text-xs text-gray-400">{p.student_number}</p>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-500">{p.class_name} {p.section}</td>
                  <td className="px-3 py-2.5 text-sm text-gray-500">{p.term}</td>
                  <td className="px-3 py-2.5 font-medium text-green-600">GH₵{parseFloat(p.amount_paid).toFixed(2)}</td>
                  <td className="px-3 py-2.5">
                    <Badge color={METHOD_COLOR[p.payment_method] || 'gray'}>
                      {p.payment_method?.replace('_',' ')}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">{p.reference || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">{p.received_by}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setReceipt(p)}
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

      {receipt && <PrintReceipt receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}