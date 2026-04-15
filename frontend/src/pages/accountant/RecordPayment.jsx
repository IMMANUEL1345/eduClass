import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { feeAPI, classAPI } from '../../api';
import { PageHeader, Card, Button, Input, Select, Spinner } from '../../components/ui';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import toast from 'react-hot-toast';

const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
const TERMS   = ['Term 1','Term 2','Term 3'];
const METHODS = ['cash','mobile_money','bank_transfer','cheque'];

function PrintReceipt({ receipt, onClose }) {
  const ref = useRef();

  function handlePrint() {
    const content = ref.current.innerHTML;
    const w = window.open('', '_blank', 'width=400,height=600');
    w.document.write(`
      <html><head><title>Fee Receipt</title>
      <style>
        body { font-family: sans-serif; padding: 24px; font-size: 13px; color: #111; }
        .logo { text-align: center; margin-bottom: 16px; }
        .logo h2 { margin: 0; font-size: 18px; }
        .logo p  { margin: 2px 0; color: #666; font-size: 11px; }
        .divider { border-top: 1px dashed #ccc; margin: 12px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 5px 0; }
        td:last-child { text-align: right; font-weight: 600; }
        .total { font-size: 15px; font-weight: 700; }
        .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #888; }
        @media print { button { display: none; } }
      </style>
      </head><body>${content}</body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
        {/* Receipt content */}
        <div ref={ref}>
          <div className="logo text-center mb-4">
            <h2 className="text-lg font-bold text-gray-800">EduClass</h2>
            <p className="text-xs text-gray-500">School Management System</p>
            <p className="text-xs text-gray-400">Faculty of Engineering · Dept. of ICT</p>
          </div>

          <div className="text-center mb-3">
            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
              OFFICIAL RECEIPT
            </span>
          </div>

          <div className="border-t border-dashed border-gray-200 my-3" />

          <table className="w-full text-sm mb-3">
            <tbody>
              {[
                ['Receipt No.',    receipt.receipt_number || receipt.id],
                ['Date',          receipt.paid_at],
                ['Student',       receipt.student_name],
                ['Student No.',   receipt.student_number],
                ['Class',         receipt.class_name],
                ['Term',          receipt.term],
                ['Academic Year', receipt.academic_year],
                ['Payment Method', receipt.payment_method?.replace('_',' ')],
                receipt.reference ? ['Reference', receipt.reference] : null,
              ].filter(Boolean).map(([k,v]) => (
                <tr key={k}>
                  <td className="py-1 text-gray-500">{k}</td>
                  <td className="py-1 text-gray-800 font-medium text-right capitalize">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-dashed border-gray-200 my-3" />

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Amount Paid</span>
            <span className="text-xl font-bold text-green-600">
              GH₵{parseFloat(receipt.amount_paid).toFixed(2)}
            </span>
          </div>

          <div className="border-t border-dashed border-gray-200 my-3" />

          <p className="text-xs text-center text-gray-400">
            Received by: {receipt.received_by}<br />
            Thank you for your payment
          </p>
        </div>

        <div className="flex gap-3 mt-5">
          <Button className="flex-1" onClick={onClose}>Close</Button>
          <Button className="flex-1" variant="primary" onClick={handlePrint}>
            🖨️ Print receipt
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function RecordPayment() {
  const navigate = useNavigate();
  const user     = useSelector(selectUser);
  const [classes,    setClasses]    = useState([]);
  const [students,   setStudents]   = useState([]);
  const [balance,    setBalance]    = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [receipt,    setReceipt]    = useState(null);

  const [form, setForm] = useState({
    class_id:'', student_id:'', fee_structure_id:'',
    amount_paid:'', payment_method:'cash',
    reference:'', paid_at: new Date().toISOString().split('T')[0],
    term:'Term 1', academic_year: CURRENT_YEAR, notes:'',
  });

  useEffect(() => {
    classAPI.list({}).then(({ data }) => setClasses(data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.class_id) { setStudents([]); return; }
    classAPI.students(form.class_id).then(({ data }) => setStudents(data.data)).catch(() => {});
  }, [form.class_id]);

  useEffect(() => {
    if (!form.student_id || !form.term || !form.academic_year) return;
    feeAPI.studentBalance(form.student_id, { term: form.term, academic_year: form.academic_year })
      .then(({ data }) => {
        const b = data.data[0] || null;
        setBalance(b);
        if (b) setForm(p => ({
          ...p,
          fee_structure_id: b.fee_structure_id,
          amount_paid: Math.max(0, parseFloat(b.balance)).toFixed(2),
        }));
      }).catch(() => {});
  }, [form.student_id, form.term, form.academic_year]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.student_id || !form.fee_structure_id || !form.amount_paid)
      return toast.error('Student, fee structure and amount are required');
    setSaving(true);
    try {
      await feeAPI.recordPayment({
        student_id:       parseInt(form.student_id),
        fee_structure_id: parseInt(form.fee_structure_id),
        amount_paid:      parseFloat(form.amount_paid),
        payment_method:   form.payment_method,
        reference:        form.reference,
        paid_at:          form.paid_at,
        notes:            form.notes,
      });
      toast.success('Payment recorded');

      // Find student info for receipt
      const student = students.find(s => s.id === parseInt(form.student_id));
      const cls     = classes.find(c => c.id === parseInt(form.class_id));
      setReceipt({
        receipt_number: `RCP${Date.now().toString().slice(-8)}`,
        paid_at:        new Date(form.paid_at).toLocaleDateString('en-GB'),
        student_name:   student?.name || '—',
        student_number: student?.student_number || '—',
        class_name:     cls ? `${cls.name} ${cls.section}` : '—',
        term:           form.term,
        academic_year:  form.academic_year,
        amount_paid:    form.amount_paid,
        payment_method: form.payment_method,
        reference:      form.reference,
        received_by:    user?.name || '—',
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally { setSaving(false); }
  }

  function set(field) { return e => setForm(p => ({ ...p, [field]: e.target.value })); }

  return (
    <div className="max-w-xl">
      <PageHeader title="Record payment" subtitle="Enter fee payment details"
        action={<Button onClick={() => navigate(-1)}>Back</Button>} />

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Term *" value={form.term} onChange={set('term')}>
              {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Input label="Academic year *" value={form.academic_year} onChange={set('academic_year')} placeholder="2025/2026" />
          </div>

          <Select label="Class *" value={form.class_id} onChange={set('class_id')}>
            <option value="">Select class…</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
          </Select>

          <Select label="Student *" value={form.student_id} onChange={set('student_id')} disabled={!form.class_id}>
            <option value="">Select student…</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.student_number})</option>)}
          </Select>

          {balance && (
            <div className={`p-3 rounded-lg border text-sm ${parseFloat(balance.balance) <= 0
              ? 'bg-green-50 border-green-100 text-green-700'
              : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
              {parseFloat(balance.balance) <= 0 ? (
                <span>Student has fully paid for {form.term}.</span>
              ) : (
                <div className="flex justify-between">
                  <span>Fee: GH₵{parseFloat(balance.total_fee).toFixed(2)}</span>
                  <span>Paid: GH₵{parseFloat(balance.amount_paid).toFixed(2)}</span>
                  <span className="font-medium">Balance: GH₵{parseFloat(balance.balance).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          <Input label="Amount paid (GH₵) *" type="number" min="0.01" step="0.01"
            value={form.amount_paid} onChange={set('amount_paid')} placeholder="0.00" />

          <Select label="Payment method" value={form.payment_method} onChange={set('payment_method')}>
            {METHODS.map(m => (
              <option key={m} value={m}>
                {m.replace('_',' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Reference / receipt no." value={form.reference} onChange={set('reference')} placeholder="Optional" />
            <Input label="Payment date" type="date" value={form.paid_at} onChange={set('paid_at')} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Notes (optional)</label>
            <textarea rows={2} value={form.notes} onChange={set('notes')}
              placeholder="Any additional notes…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none
                         focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={saving}>Record payment</Button>
          </div>
        </form>
      </Card>

      {receipt && (
        <PrintReceipt receipt={receipt} onClose={() => { setReceipt(null); navigate('/fees/payments'); }} />
      )}
    </div>
  );
}