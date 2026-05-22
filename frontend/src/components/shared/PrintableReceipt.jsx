import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';

const VERIFY_BASE = 'https://edu-class-pi.vercel.app/verify';

const RECEIPT_LABELS = {
  feeding:    { label: 'Feeding Fee Receipt',   color: '#16a34a', bg: '#f0fdf4', icon: '🍽️' },
  transport:  { label: 'Transport Fee Receipt', color: '#2563eb', bg: '#eff6ff', icon: '🚌' },
  school_fee: { label: 'School Fee Receipt',    color: '#7c3aed', bg: '#faf5ff', icon: '🏫' },
};

const PRINT_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #fff; display: flex; justify-content: center; }
  .receipt-wrap { width: 320px; padding: 24px 20px; }

  .r-header { text-align: center; padding-bottom: 14px; border-bottom: 2px dashed #e2e8f0; margin-bottom: 16px; }
  .r-logo { font-size: 32px; margin-bottom: 6px; }
  .r-school { font-size: 16px; font-weight: 700; color: #1e293b; }
  .r-subtitle { font-size: 11px; color: #64748b; margin-top: 2px; }
  .r-badge { display: inline-block; margin-top: 8px; padding: 4px 14px;
             border-radius: 99px; font-size: 11px; font-weight: 700;
             letter-spacing: 0.3px; }

  .r-amount-box { text-align: center; margin: 16px 0; padding: 12px 0;
                  border-radius: 10px; }
  .r-amount-label { font-size: 10px; text-transform: uppercase;
                    letter-spacing: 1px; color: #64748b; margin-bottom: 4px; }
  .r-amount-value { font-size: 28px; font-weight: 800; }

  .r-divider { border: none; border-top: 1px dashed #e2e8f0; margin: 12px 0; }

  .r-row { display: flex; justify-content: space-between; align-items: flex-start;
           padding: 6px 0; border-bottom: 1px solid #f8fafc; }
  .r-row:last-child { border-bottom: none; }
  .r-row-label { font-size: 11px; color: #94a3b8; flex-shrink: 0; width: 45%; }
  .r-row-value { font-size: 11px; font-weight: 600; color: #1e293b;
                 text-align: right; width: 55%; word-break: break-word; }

  .r-qr { text-align: center; margin-top: 16px; padding-top: 14px;
           border-top: 2px dashed #e2e8f0; }
  .r-qr img { width: 120px; height: 120px; margin: 0 auto; display: block; }
  .r-qr-label { font-size: 10px; color: #94a3b8; margin-top: 6px; }

  .r-footer { text-align: center; margin-top: 14px; padding-top: 10px;
              border-top: 1px solid #f1f5f9; }
  .r-footer p { font-size: 10px; color: #94a3b8; line-height: 1.6; }
  .r-footer .r-thank { font-size: 12px; font-weight: 600; color: #475569; }
`;

export default function PrintableReceipt({ receipt, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const printRef = useRef();

  const category = receipt?.fee_type || receipt?.receipt_category || 'school_fee';
  const meta     = RECEIPT_LABELS[category] || RECEIPT_LABELS['school_fee'];

  useEffect(() => {
    if (!receipt?.receipt_number) return;
    async function genQR() {
      const isOnline = navigator.onLine;
      const qrContent = isOnline
        ? `${VERIFY_BASE}/${receipt.receipt_number}`
        : JSON.stringify({
            receipt_number: receipt.receipt_number,
            student_name:   receipt.student_name,
            student_number: receipt.student_number,
            amount:         receipt.amount,
            fee_type:       category,
            payment_date:   receipt.payment_date || receipt.created_at,
            term:           receipt.term,
            academic_year:  receipt.academic_year,
            payment_method: receipt.payment_method,
            recorded_by:    receipt.recorded_by_name,
          });
      try {
        const url = await QRCode.toDataURL(qrContent, {
          width: 180, margin: 1,
          color: { dark: '#1e293b', light: '#ffffff' },
        });
        setQrDataUrl(url);
      } catch (e) { console.error('QR error:', e); }
    }
    genQR();
  }, [receipt]);

  function handlePrint() {
    // Use hidden iframe — never blocked by browser popup blocker
    const existingFrame = document.getElementById('receipt-print-frame');
    if (existingFrame) existingFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'receipt-print-frame';
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:400px;height:600px;border:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
      <title>Receipt ${receipt.receipt_number}</title>
      <style>${PRINT_STYLES}</style>
    </head><body>${buildReceiptHTML()}</body></html>`);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => iframe.remove(), 1000);
    }, 400);
  }

  function buildReceiptHTML() {
    const amount = receipt.amount || receipt.amount_paid || 0;
    const date   = receipt.payment_date || receipt.created_at;
    const cls    = `${receipt.class_name || ''}${receipt.section || receipt.class_section ? ' ' + (receipt.section || receipt.class_section) : ''}`;

    const rows = [
      ['Receipt No.',   receipt.receipt_number],
      ['Student',       receipt.student_name],
      ['Student No.',   receipt.student_number],
      ['Class',         cls.trim()],
      ['Term',          receipt.term],
      ['Academic Year', receipt.academic_year],
      ['Payment Method',receipt.payment_method?.replace('_',' ').replace(/\b\w/g,l=>l.toUpperCase())],
      ['Date',          date ? new Date(date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}) : ''],
      ['Received by',   receipt.recorded_by_name],
    ].filter(([,v]) => v);

    return `
      <div class="receipt-wrap">
        <div class="r-header">
          <div class="r-logo">🎓</div>
          <div class="r-school">EduClass School</div>
          <div class="r-subtitle">Official Payment Receipt</div>
          <span class="r-badge" style="background:${meta.bg};color:${meta.color}">
            ${meta.icon} ${meta.label}
          </span>
        </div>

        <div class="r-amount-box" style="background:${meta.bg}">
          <div class="r-amount-label">Amount Paid</div>
          <div class="r-amount-value" style="color:${meta.color}">
            GH₵ ${parseFloat(amount).toFixed(2)}
          </div>
        </div>

        <hr class="r-divider">

        ${rows.map(([label, val]) => `
          <div class="r-row">
            <span class="r-row-label">${label}</span>
            <span class="r-row-value">${val}</span>
          </div>
        `).join('')}

        ${receipt.notes ? `
          <div style="margin-top:10px;padding:8px 10px;background:#f8fafc;border-radius:6px;
                      font-size:11px;color:#64748b;text-align:center;">
            📝 ${receipt.notes}
          </div>` : ''}

        ${qrDataUrl ? `
          <div class="r-qr">
            <img src="${qrDataUrl}" alt="QR Code" />
            <div class="r-qr-label">
              ${navigator.onLine ? '🔗 Scan to verify receipt online' : '📴 Scan for receipt details (offline)'}
            </div>
          </div>` : ''}

        <div class="r-footer">
          <p class="r-thank">Thank you for your payment!</p>
          <p>EduClass School Management System</p>
          <p>${receipt.receipt_number}</p>
        </div>
      </div>
    `;
  }

  if (!receipt) return null;

  const amount = receipt.amount || receipt.amount_paid || 0;
  const date   = receipt.payment_date || receipt.created_at;
  const cls    = `${receipt.class_name || ''}${receipt.section || receipt.class_section ? ' ' + (receipt.section || receipt.class_section) : ''}`;

  const rows = [
    ['Receipt No.',    receipt.receipt_number],
    ['Student',        receipt.student_name],
    ['Student No.',    receipt.student_number],
    ['Class',          cls.trim()],
    ['Term',           receipt.term],
    ['Academic Year',  receipt.academic_year],
    ['Payment Method', receipt.payment_method?.replace('_',' ').replace(/\b\w/g,l=>l.toUpperCase())],
    ['Date',           date ? new Date(date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}) : ''],
    ['Received by',    receipt.recorded_by_name],
  ].filter(([,v]) => v);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">

        {/* Modal toolbar */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">Payment Receipt</span>
          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700">
              🖨️ Print
            </button>
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-200">
              ✕
            </button>
          </div>
        </div>

        {/* Receipt preview */}
        <div className="overflow-y-auto max-h-[82vh]">
          <div className="px-5 py-5">

            {/* Header */}
            <div className="text-center pb-4 border-b-2 border-dashed border-gray-200 mb-4">
              <div className="text-4xl mb-2">🎓</div>
              <p className="text-base font-bold text-gray-800">EduClass School</p>
              <p className="text-xs text-gray-400 mt-0.5">Official Payment Receipt</p>
              <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: meta.bg, color: meta.color }}>
                {meta.icon} {meta.label}
              </span>
            </div>

            {/* Amount */}
            <div className="text-center rounded-xl py-4 mb-4" style={{ background: meta.bg }}>
              <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Amount Paid</p>
              <p className="text-3xl font-extrabold" style={{ color: meta.color }}>
                GH₵ {parseFloat(amount).toFixed(2)}
              </p>
            </div>

            {/* Detail rows */}
            <div className="space-y-1">
              {rows.map(([label, val]) => (
                <div key={label}
                  className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-400 w-[42%] flex-shrink-0">{label}</span>
                  <span className="text-xs font-semibold text-gray-800 text-right w-[56%] break-words">{val}</span>
                </div>
              ))}
            </div>

            {receipt.notes && (
              <div className="mt-3 px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-500 text-center">
                📝 {receipt.notes}
              </div>
            )}

            {/* QR Code */}
            {qrDataUrl && (
              <div className="text-center mt-4 pt-4 border-t-2 border-dashed border-gray-200">
                <img src={qrDataUrl} alt="QR Code"
                  className="w-32 h-32 mx-auto rounded-lg border border-gray-100 p-1" />
                <p className="text-xs text-gray-400 mt-2">
                  {navigator.onLine ? '🔗 Scan to verify online' : '📴 Scan for receipt (offline)'}
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="text-center mt-4 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-600">Thank you for your payment!</p>
              <p className="text-[10px] text-gray-400 mt-0.5">EduClass School Management System</p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}