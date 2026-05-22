import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const API = (() => {
  const base = process.env.REACT_APP_API_URL || 'https://educlass-api.onrender.com';
  return base.replace(/\/api\/?$/, '') + '/api';
})();

const LABELS = {
  feeding:    { label: 'Feeding Fee',    color: 'text-green-600',  bg: 'bg-green-50',  icon: '🍽️' },
  transport:  { label: 'Transport Fee',  color: 'text-blue-600',   bg: 'bg-blue-50',   icon: '🚌' },
  school_fee: { label: 'School Fee',     color: 'text-purple-600', bg: 'bg-purple-50', icon: '🏫' },
};

export default function VerifyReceipt() {
  const { receiptNumber } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [found,   setFound]   = useState(true);

  useEffect(() => {
    fetch(`${API}/daily-fees/receipt/${receiptNumber}`)
      .then(r => r.json())
      .then(d => { if (d.data) setReceipt(d.data); else setFound(false); })
      .catch(() => setFound(false))
      .finally(() => setLoading(false));
  }, [receiptNumber]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-400">Verifying receipt…</p>
    </div>
  );

  if (!found || !receipt) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-3xl mb-3">❌</p>
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Receipt Not Found</h2>
        <p className="text-sm text-gray-500">Receipt <strong>{receiptNumber}</strong> could not be verified.</p>
      </div>
    </div>
  );

  const category = receipt.fee_type || receipt.receipt_category || 'school_fee';
  const meta     = LABELS[category] || LABELS['school_fee'];
  const amount   = receipt.amount || receipt.amount_paid || 0;
  const date     = receipt.payment_date || receipt.created_at;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">

        {/* Verified banner */}
        <div className="bg-green-500 px-5 py-4 text-white text-center">
          <p className="text-2xl mb-1">✅</p>
          <p className="font-bold text-lg">Receipt Verified</p>
          <p className="text-xs opacity-80 mt-0.5">This is an authentic EduClass receipt</p>
        </div>

        <div className="p-5">
          {/* Badge */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-4 ${meta.bg} ${meta.color}`}>
            {meta.icon} {meta.label}
          </div>

          {/* Amount */}
          <div className="text-center mb-5 p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-400 mb-1">Amount Paid</p>
            <p className={`text-3xl font-bold ${meta.color}`}>GH₵ {parseFloat(amount).toFixed(2)}</p>
          </div>

          {/* Details */}
          <div className="space-y-2.5">
            {[
              ['Receipt No.',    receipt.receipt_number],
              ['Student',        receipt.student_name],
              ['Student No.',    receipt.student_number],
              ['Class',          `${receipt.class_name || ''}${receipt.section || receipt.class_section ? ' ' + (receipt.section || receipt.class_section) : ''}`],
              ['Term',           receipt.term],
              ['Academic Year',  receipt.academic_year],
              ['Payment Method', receipt.payment_method?.replace('_',' ')],
              ['Date',           date ? new Date(date).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) : ''],
              ['Received by',    receipt.recorded_by_name],
            ].filter(([,v]) => v).map(([label, val]) => (
              <div key={label} className="flex justify-between items-center py-1.5 border-b border-gray-50">
                <span className="text-xs text-gray-400">{label}</span>
                <span className="text-xs font-semibold text-gray-700 text-right max-w-[60%]">{val}</span>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-400 mt-5">
            EduClass School Management System
          </p>
        </div>
      </div>
    </div>
  );
}