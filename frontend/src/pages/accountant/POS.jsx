import React, { useEffect, useState } from 'react';
import api from '../../api';
import { Button, Input, Select, Badge } from '../../components/ui';
import toast from 'react-hot-toast';

const PAYMENT_METHODS = ['cash','mobile_money','bank_transfer'];

export default function POS() {
  const [items,     setItems]     = useState([]);
  const [students,  setStudents]  = useState([]);
  const [search,    setSearch]    = useState('');
  const [cart,      setCart]      = useState([]);
  const [payment,   setPayment]   = useState('cash');
  const [buyerName, setBuyerName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [saving,    setSaving]    = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);

  useEffect(() => {
    api.get('/inventory/items').then(({ data }) => setItems(data.data)).catch(() => {});
    api.get('/students').then(({ data }) => setStudents(data.data.students || data.data)).catch(() => {});
  }, []);

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) && i.stock_qty > 0
  );

  function addToCart(item) {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) {
        if (existing.qty >= item.stock_qty) { toast.error('Not enough stock'); return prev; }
        return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  }

  function updateQty(id, qty) {
    if (qty < 1) { setCart(c => c.filter(i => i.id !== id)); return; }
    setCart(c => c.map(i => i.id === id ? { ...i, qty } : i));
  }

  const total = cart.reduce((sum, c) => sum + parseFloat(c.price) * c.qty, 0);

  async function handleCheckout() {
    if (cart.length === 0) return toast.error('Cart is empty');
    setSaving(true);
    try {
      const receipts = [];
      for (const item of cart) {
        const { data } = await api.post('/inventory/sales', {
          item_id: item.id,
          student_id: studentId || null,
          buyer_name: buyerName || null,
          quantity: item.qty,
          payment_method: payment,
        });
        receipts.push({ ...data.data, item_name: item.name, qty: item.qty, price: item.price });
        if (data.data.low_stock_warning) toast(data.data.low_stock_warning, { icon: '⚠️' });
      }
      setLastReceipt({ items: receipts, total, payment, time: new Date() });
      setCart([]);
      setStudentId('');
      setBuyerName('');
      toast.success('Sale completed!');
      // Refresh items
      const { data } = await api.get('/inventory/items');
      setItems(data.data);
    } catch (err) { toast.error(err.response?.data?.message || 'Sale failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex h-full gap-5">
      {/* Left — item catalog */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-800">POS Terminal</h1>
          <Input placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} className="w-48" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {filtered.map(item => (
            <button key={item.id} onClick={() => addToCart(item)}
              className="bg-white border border-gray-100 rounded-xl p-4 text-left hover:border-blue-200 hover:shadow-sm transition-all">
              <div className="flex justify-between items-start mb-2">
                <Badge color={item.category === 'Books' ? 'blue' : item.category === 'Uniforms' ? 'purple' : 'teal'}>
                  {item.category}
                </Badge>
                <span className="text-xs text-gray-400">{item.stock_qty} left</span>
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">{item.name}</p>
              <p className="text-base font-semibold text-blue-600">GH₵{parseFloat(item.price).toFixed(2)}</p>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-10 text-gray-400 text-sm">
              {search ? 'No items match your search' : 'No items in stock'}
            </div>
          )}
        </div>
      </div>

      {/* Right — cart */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Current sale</h2>

        {/* Customer */}
        <div className="mb-4">
          <Select value={studentId} onChange={e => { setStudentId(e.target.value); if (e.target.value) setBuyerName(''); }} className="w-full mb-2">
            <option value="">Walk-in customer</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.student_number})</option>)}
          </Select>
          {!studentId && (
            <Input placeholder="Customer name (optional)" value={buyerName} onChange={e => setBuyerName(e.target.value)} />
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto mb-4">
          {cart.length === 0
            ? <p className="text-sm text-gray-400 text-center py-8">Add items from the catalog</p>
            : cart.map(item => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">GH₵{parseFloat(item.price).toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => updateQty(item.id, item.qty - 1)}
                      className="w-5 h-5 rounded bg-gray-100 text-gray-600 text-xs flex items-center justify-center">−</button>
                    <span className="text-sm w-5 text-center">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, item.qty + 1)}
                      className="w-5 h-5 rounded bg-gray-100 text-gray-600 text-xs flex items-center justify-center">+</button>
                  </div>
                </div>
              ))
          }
        </div>

        {/* Payment */}
        <Select value={payment} onChange={e => setPayment(e.target.value)} className="w-full mb-3">
          {PAYMENT_METHODS.map(m => (
            <option key={m} value={m}>{m.replace('_',' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
          ))}
        </Select>

        {/* Total */}
        <div className="flex justify-between items-center py-3 border-t border-gray-100 mb-3">
          <span className="text-sm text-gray-500">Total</span>
          <span className="text-xl font-bold text-gray-800">GH₵{total.toFixed(2)}</span>
        </div>

        <Button variant="primary" loading={saving} onClick={handleCheckout} className="w-full">
          Complete sale
        </Button>

        {cart.length > 0 && (
          <button onClick={() => setCart([])} className="mt-2 text-xs text-red-400 hover:underline text-center w-full">
            Clear cart
          </button>
        )}
      </div>

      {/* Receipt modal */}
      {lastReceipt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-2">✓</div>
              <p className="text-base font-semibold text-gray-800">Sale complete</p>
              <p className="text-xs text-gray-400">{lastReceipt.time.toLocaleTimeString()}</p>
            </div>
            <div className="border-t border-gray-100 py-3 mb-3">
              {lastReceipt.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm py-1">
                  <span className="text-gray-600">{item.item_name} × {item.qty}</span>
                  <span className="text-gray-700 font-medium">GH₵{(parseFloat(item.price) * item.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-3 mb-4">
              <span>Total</span>
              <span>GH₵{lastReceipt.total.toFixed(2)}</span>
            </div>
            <p className="text-xs text-center text-gray-400 mb-4 capitalize">
              Payment: {lastReceipt.payment.replace('_', ' ')}
            </p>
            <Button className="w-full" onClick={() => setLastReceipt(null)}>New sale</Button>
          </div>
        </div>
      )}
    </div>
  );
}