import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';

const VERIFY_BASE = 'https://edu-class-pi.vercel.app/verify';

const RECEIPT_LABELS = {
  feeding:    { label: 'Feeding Fee Receipt',    color: '#16a34a', icon: '🍽️'  },
  transport:  { label: 'Transport Fee Receipt',  color: '#2563eb', icon: '🚌'  },
  school_fee: { label: 'School Fee Receipt',     color: '#7c3aed', icon: '🏫'  },
};

export default function PrintableReceipt({ receipt, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const printRef = useRef();

  const category = receipt?.fee_type || receipt?.receipt_category || 'school_fee';
  const meta     = RECEIPT_LABELS[category] || RECEIPT_LABELS['school_fee'];

  useEffect(() => {
    if (!receipt?.receipt_number) return;

    async function genQR() {
      const isOnline = navigator.onLine;
      let qrContent;

      if (isOnline) {
        // Online: encode verification URL
        qrContent = `${VERIFY_BASE}/${receipt.receipt_number}`;
      } else {
        // Offline: encode receipt data as JSON
        qrContent = JSON.stringify({
          receipt_number:  receipt.receipt_number,
          student_name:    receipt.student_name,
          student_number:  receipt.student_number,
          amount:          receipt.amount,
          fee_type:        category,
          payment_date:    receipt.payment_date || receipt.created_at,
          term:            receipt.term,
          academic_year:   receipt.academic_year,
          payment_method:  receipt.payment_method,
          recorded_by:     receipt.recorded_by_name,
        });
      }

      try {
        const url = await QRCode.toDataURL(qrContent, {
          width: 160, margin: 1,
          color: { dark: '#1e293b', light: '#ffffff' },
        });
        setQrDataUrl(url);
      } catch (e) { console.error('QR error:', e); }
    }

    genQR();
  }, [receipt]);

  function handlePrint() {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>Receipt ${receipt.receipt_number}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #1e293b; background: #fff; }
        .receipt { width: 340px; margin: 20px auto; padding: 20px; border: 1px solid #e2e8f0; }
        .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
        .header h1 { font-size: 18px; font-weight: 700; color: #1e293b; }
        .header p  { font-size: 11px; color: #64748b; margin-top: 2px; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f1f5f9; }
        .row .label { color: #64748b; font-size: 11px; }
        .row .val   { font-weight: 600; font-size: 12px; text-align: right; }
        .amount { text-align: center; margin: 14px 0; padding: 10px; background: #f8fafc; border-radius: 8px; }
        .amount .num { font-size: 24px; font-weight: 700; }
        .qr-section { text-align: center; margin-top: 14px; padding-top: 10px; border-top: 1px dashed #e2e8f0; }
        .qr-section img { width: 110px; height: 110px; }
        .qr-section p { font-size: 9px; color: #94a3b8; margin-top: 4px; }
        .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 12px; }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 300);
  }

  if (!receipt) return null;

  const amount = receipt.amount || receipt.amount_paid || 0;
  const date   = receipt.payment_date || receipt.created_at;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-800">Receipt</span>
          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
              🖨️ Print
            </button>
            <button onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Receipt content */}
        <div className="overflow-y-auto max-h-[80vh]">
          <div ref={printRef} className="receipt">
            <div className="header">
              <div style={{ fontSize: '28px', marginBottom: '4px' }}>🎓</div>
              <h1>EduClass School</h1>
              <p>Official Payment Receipt</p>
              <div className="badge" style={{ backgroundColor: meta.color + '20', color: meta.color }}>
                {meta.icon} {meta.label}
              </div>
            </div>

            <div className="amount">
              <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Amount Paid</p>
              <p className="num" style={{ color: meta.color }}>GH₵ {parseFloat(amount).toFixed(2)}</p>
            </div>

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
              <div key={label} className="row">
                <span className="label">{label}</span>
                <span className="val">{val}</span>
              </div>
            ))}

            {receipt.notes && (
              <div style={{ marginTop: '8px', padding: '6px 8px', background: '#f8fafc', borderRadius: '6px', fontSize: '11px', color: '#64748b' }}>
                Note: {receipt.notes}
              </div>
            )}

            {qrDataUrl && (
              <div className="qr-section">
                <img src={qrDataUrl} alt="QR Code" />
                <p>{navigator.onLine ? 'Scan to verify online' : 'Scan for receipt details (offline)'}</p>
              </div>
            )}

            <div className="footer">
              <p>Thank you for your payment</p>
              <p style={{ marginTop: '2px' }}>EduClass School Management System</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}