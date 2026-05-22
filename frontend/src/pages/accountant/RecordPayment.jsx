import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { feeAPI, classAPI } from '../../api';
import { PageHeader, Card, Button, Input, Select } from '../../components/ui';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import toast from 'react-hot-toast';
import PrintableReceipt from '../../components/shared/PrintableReceipt';

const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
const TERMS   = ['Term 1','Term 2','Term 3'];
const METHODS = ['cash','mobile_money','bank_transfer','cheque'];

export default function RecordPayment() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const user      = useSelector(selectUser);

  const [classes,  setClasses]  = useState([]);
  const [students, setStudents] = useState([]);
  const [balance,  setBalance]  = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [receipt,  setReceipt]  = useState(null);

  const [form, setForm] = useState({
    class_id:'', student_id:'', fee_structure_id:'',
    amount_paid:'', payment_method:'cash',
    reference:'', paid_at: new Date().toISOString().split('T')[0],
    term:'Term 1', academic_year: CURRENT_YEAR, notes:'',
  });

  // Load classes
  useEffect(() => {
    classAPI.list({}).then(({ data }) => setClasses(data.data)).catch(() => {});
  }, []);

  // Pre-fill from Defaulters "Record" button via location.state
  useEffect(() => {
    const state = location.state;
    if (!state) return;
    setForm(p => ({
      ...p,
      class_id:    state.class_id    ? String(state.class_id)    : p.class_id,
      student_id:  state.student_id  ? String(state.student_id)  : p.student_id,
      term:        state.term        || p.term,
      academic_year: state.academic_year || p.academic_year,
    }));
  }, [location.state]);

  // Load students when class changes
  useEffect(() => {
    if (!form.class_id) { setStudents([]); return; }
    classAPI.students(form.class_id).then(({ data }) => setStudents(data.data)).catch(() => {});
  }, [form.class_id]);

  // Load balance when student / term / year changes
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
      const { data } = await feeAPI.recordPayment({
        student_id:       parseInt(form.student_id),
        fee_structure_id: parseInt(form.fee_structure_id),
        amount_paid:      parseFloat(form.amount_paid),
        payment_method:   form.payment_method,
        reference:        form.reference,
        paid_at:          form.paid_at,
        notes:            form.notes,
      });

      toast.success('Payment recorded');

      // Use API response if available, fall back to form data
      const resp          = data?.data || {};
      const student       = students.find(s => s.id === parseInt(form.student_id));
      const cls           = classes.find(c => c.id === parseInt(form.class_id));
      const amountPaid    = parseFloat(form.amount_paid);
      const totalFee      = balance ? parseFloat(balance.total_fee) : 0;
      const prevPaid      = balance ? parseFloat(balance.amount_paid) : 0;
      const balRemaining  = Math.max(0, totalFee - prevPaid - amountPaid);

      setReceipt({
        receipt_number:    resp.receipt_number || resp.id || `RCP${Date.now().toString().slice(-8)}`,
        payment_date:      form.paid_at,
        student_name:      resp.student_name   || student?.name || '—',
        student_number:    resp.student_number || student?.student_number || '—',
        class_name:        resp.class_name     || (cls ? cls.name : '—'),
        section:           resp.section        || cls?.section || '',
        term:              form.term,
        academic_year:     form.academic_year,
        amount:            amountPaid,
        amount_paid:       amountPaid,
        payment_method:    form.payment_method,
        reference:         form.reference,
        recorded_by_name:  resp.received_by    || user?.name || '—',
        fee_type:          'school_fee',
        total_fee:         totalFee,
        balance_remaining: balRemaining,
        notes:             form.notes,
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
            <Input label="Academic year *" value={form.academic_year}
              onChange={set('academic_year')} placeholder="2025/2026" />
          </div>

          <Select label="Class *" value={form.class_id} onChange={set('class_id')}>
            <option value="">Select class…</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
          </Select>

          <Select label="Student *" value={form.student_id}
            onChange={set('student_id')} disabled={!form.class_id}>
            <option value="">Select student…</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.student_number})</option>
            ))}
          </Select>

          {/* Balance summary */}
          {balance && (
            <div className={`p-3 rounded-lg border text-sm ${
              parseFloat(balance.balance) <= 0
                ? 'bg-green-50 border-green-100 text-green-700'
                : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
              {parseFloat(balance.balance) <= 0 ? (
                <span>✅ Student has fully paid for {form.term}.</span>
              ) : (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs opacity-70">Total fee</p>
                    <p className="font-semibold">GH₵{parseFloat(balance.total_fee).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs opacity-70">Already paid</p>
                    <p className="font-semibold">GH₵{parseFloat(balance.amount_paid).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs opacity-70">Outstanding</p>
                    <p className="font-bold">GH₵{parseFloat(balance.balance).toFixed(2)}</p>
                  </div>
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
            <Input label="Reference / receipt no." value={form.reference}
              onChange={set('reference')} placeholder="Optional" />
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
        <PrintableReceipt
          receipt={receipt}
          onClose={() => { setReceipt(null); navigate('/fees/payments'); }}
        />
      )}
    </div>
  );
}