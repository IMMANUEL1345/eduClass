import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import api from '../../api';
import toast from 'react-hot-toast';
import PrintableReceipt from '../../components/shared/PrintableReceipt';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const METHODS = ['cash','momo','bank_transfer','cheque'];
const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;

// ── Shared helpers ────────────────────────────────────────
function Stat({ icon, label, value, color = 'text-gray-800' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="text-xl mb-1">{icon}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap
        ${active ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
      {children}
    </button>
  );
}

// ── ZONES TAB ─────────────────────────────────────────────
function ZonesTab() {
  const [zones,   setZones]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState({ name:'', description:'', daily_rate:'' });
  const [editing, setEditing] = useState(null);
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get('/daily-fees/zones'); setZones(data.data || []); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.name || !form.daily_rate) return toast.error('Name and rate required');
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/daily-fees/zones/${editing.id}`, form);
        toast.success('Zone updated');
      } else {
        await api.post('/daily-fees/zones', form);
        toast.success('Zone created');
      }
      setForm({ name:'', description:'', daily_rate:'' }); setEditing(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this zone?')) return;
    try { await api.delete(`/daily-fees/zones/${id}`); toast.success('Deleted'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  }

  return (
    <div className="space-y-5">
      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">
          {editing ? `Edit zone: ${editing.name}` : 'Add transport zone'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
            placeholder="Zone name (e.g. Tema)"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
            placeholder="Description (optional)"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="number" value={form.daily_rate} onChange={e=>setForm(f=>({...f,daily_rate:e.target.value}))}
            placeholder="Daily rate (GH₵)"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Saving…' : editing ? 'Update zone' : 'Add zone'}
          </button>
          {editing && (
            <button onClick={() => { setEditing(null); setForm({ name:'', description:'', daily_rate:'' }); }}
              className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? <p className="text-center py-10 text-sm text-gray-400">Loading…</p>
        : zones.length === 0 ? <p className="text-center py-10 text-sm text-gray-400">No zones yet</p>
        : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                {['Zone','Description','Daily Rate','Students',''].map(h=>(
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {zones.map(z => (
                <tr key={z.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">🚌 {z.name}</td>
                  <td className="px-4 py-3 text-gray-500">{z.description || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-blue-700">GH₵ {parseFloat(z.daily_rate).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500">{z.student_count} students</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => { setEditing(z); setForm({ name:z.name, description:z.description||'', daily_rate:z.daily_rate }); }}
                        className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => handleDelete(z.id)}
                        className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── FEEDING RATES TAB ─────────────────────────────────────
function FeedingRatesTab() {
  const [rates,   setRates]   = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState({ class_id:'', daily_rate:'', term:'Term 1', academic_year: CURRENT_YEAR });
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    api.get('/classes').then(({data}) => setClasses(data.data || [])).catch(()=>{});
    loadRates();
  }, []);

  async function loadRates() {
    setLoading(true);
    try { const {data} = await api.get('/daily-fees/feeding-rates'); setRates(data.data||[]); } catch {}
    setLoading(false);
  }

  async function handleSave() {
    if (!form.class_id || !form.daily_rate) return toast.error('Class and rate required');
    setSaving(true);
    try {
      await api.post('/daily-fees/feeding-rates', form);
      toast.success('Rate saved'); loadRates();
    } catch (err) { toast.error(err.response?.data?.message||'Failed'); }
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Set feeding rate per class</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select value={form.class_id} onChange={e=>setForm(f=>({...f,class_id:e.target.value}))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select class…</option>
            {classes.map(c=><option key={c.id} value={c.id}>{c.name}{c.section?' '+c.section:''}</option>)}
          </select>
          <select value={form.term} onChange={e=>setForm(f=>({...f,term:e.target.value}))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {TERMS.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <input value={form.academic_year} onChange={e=>setForm(f=>({...f,academic_year:e.target.value}))}
            placeholder="2026/2027"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="number" value={form.daily_rate} onChange={e=>setForm(f=>({...f,daily_rate:e.target.value}))}
            placeholder="Daily rate (GH₵)"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={handleSave} disabled={saving}
          className="mt-3 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-60">
          {saving ? 'Saving…' : '💾 Save rate'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? <p className="text-center py-10 text-sm text-gray-400">Loading…</p>
        : rates.length === 0 ? <p className="text-center py-10 text-sm text-gray-400">No rates set yet</p>
        : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                {['Class','Term','Academic Year','Daily Rate'].map(h=>(
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rates.map(r=>(
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{r.class_name}{r.section?' '+r.section:''}</td>
                  <td className="px-4 py-3 text-gray-500">{r.term}</td>
                  <td className="px-4 py-3 text-gray-500">{r.academic_year}</td>
                  <td className="px-4 py-3 font-semibold text-green-700">GH₵ {parseFloat(r.daily_rate).toFixed(2)}/day</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── PAYMENTS TAB ──────────────────────────────────────────
function PaymentsTab() {
  const [students,  setStudents]  = useState([]);
  const [classes,   setClasses]   = useState([]);
  const [receipt,   setReceipt]   = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [payments,  setPayments]  = useState([]);
  const [form, setForm] = useState({
    student_id:'', fee_type:'feeding', amount:'',
    payment_method:'cash', term:'Term 1',
    academic_year: CURRENT_YEAR, notes:'',
  });
  const [selClass, setSelClass] = useState('');

  useEffect(() => {
    api.get('/classes').then(({data})=>setClasses(data.data||[])).catch(()=>{});
    loadPayments();
  }, []);

  async function loadPayments() {
    try { const {data} = await api.get('/daily-fees/payments?'); setPayments(data.data||[]); } catch {}
  }

  useEffect(() => {
    if (!selClass) { setStudents([]); return; }
    api.get(`/students?class_id=${selClass}`)
      .then(({data}) => setStudents(data.data?.students || data.data || []))
      .catch(() => {});
  }, [selClass]);

  async function handleRecord() {
    if (!form.student_id || !form.fee_type || !form.amount) return toast.error('Fill all required fields');
    setSaving(true);
    try {
      const { data } = await api.post('/daily-fees/payments', form);
      toast.success('Payment recorded');
      setReceipt(data.data);
      setForm(f=>({...f, student_id:'', amount:'', notes:''}));
      loadPayments();
    } catch (err) { toast.error(err.response?.data?.message||'Failed'); }
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Record advance payment</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <select value={selClass} onChange={e=>setSelClass(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select class…</option>
            {classes.map(c=><option key={c.id} value={c.id}>{c.name}{c.section?' '+c.section:''}</option>)}
          </select>
          <select value={form.student_id} onChange={e=>setForm(f=>({...f,student_id:e.target.value}))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select student…</option>
            {students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={form.fee_type} onChange={e=>setForm(f=>({...f,fee_type:e.target.value}))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="feeding">🍽️ Feeding</option>
            <option value="transport">🚌 Transport</option>
          </select>
          <input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}
            placeholder="Amount (GH₵)"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={form.payment_method} onChange={e=>setForm(f=>({...f,payment_method:e.target.value}))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {METHODS.map(m=><option key={m} value={m}>{m.replace('_',' ').replace(/\b\w/g,l=>l.toUpperCase())}</option>)}
          </select>
          <select value={form.term} onChange={e=>setForm(f=>({...f,term:e.target.value}))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {TERMS.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <div className="col-span-2 sm:col-span-3">
            <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
              placeholder="Notes (optional)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <button onClick={handleRecord} disabled={saving}
          className="mt-3 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
          {saving ? 'Recording…' : '💳 Record Payment'}
        </button>
      </div>

      {/* Recent payments */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">Recent payments</p>
        </div>
        {payments.length === 0
          ? <p className="text-center py-8 text-sm text-gray-400">No payments yet</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                    {['Receipt','Student','Class','Type','Amount','Date',''].map(h=>(
                      <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payments.map(p=>(
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.receipt_number}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{p.student_name}</td>
                      <td className="px-4 py-3 text-gray-500">{p.class_name}{p.section?' '+p.section:''}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.fee_type==='feeding' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>{p.fee_type==='feeding'?'🍽️ Feeding':'🚌 Transport'}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800">GH₵ {parseFloat(p.amount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{new Date(p.payment_date).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-3">
                        <button onClick={()=>setReceipt(p)}
                          className="text-xs text-blue-600 hover:underline whitespace-nowrap">🖨️ Receipt</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {receipt && <PrintableReceipt receipt={receipt} onClose={()=>setReceipt(null)} />}
    </div>
  );
}

// ── DAILY TRACK TAB ───────────────────────────────────────
function DailyTrackTab() {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [filters, setFilters] = useState({ date: new Date().toISOString().split('T')[0], fee_type:'', class_id:'', term:'Term 1' });

  useEffect(() => {
    api.get('/classes').then(({data})=>setClasses(data.data||[])).catch(()=>{});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v])=>v)));
      const { data: res } = await api.get(`/daily-fees/daily-status?${q}`);
      setData(res.data || []);
    } catch {}
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const covered   = data.filter(s => (s.feeding?.covered || !s.feeding) && (s.transport?.covered || !s.transport));
  const uncovered = data.filter(s => (s.feeding && !s.feeding.covered) || (s.transport && !s.transport.covered));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex gap-3 flex-wrap">
        <input type="date" value={filters.date} onChange={e=>setFilters(f=>({...f,date:e.target.value}))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={filters.fee_type} onChange={e=>setFilters(f=>({...f,fee_type:e.target.value}))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All types</option>
          <option value="feeding">Feeding</option>
          <option value="transport">Transport</option>
        </select>
        <select value={filters.class_id} onChange={e=>setFilters(f=>({...f,class_id:e.target.value}))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All classes</option>
          {classes.map(c=><option key={c.id} value={c.id}>{c.name}{c.section?' '+c.section:''}</option>)}
        </select>
        <select value={filters.term} onChange={e=>setFilters(f=>({...f,term:e.target.value}))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {TERMS.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <Stat icon="👥" label="Total students" value={data.length} />
        <Stat icon="✅" label="Fully covered" value={covered.length} color="text-green-600" />
        <Stat icon="⚠️" label="Not covered" value={uncovered.length} color="text-red-500" />
      </div>

      {/* Student list */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? <p className="text-center py-10 text-sm text-gray-400">Loading…</p>
        : data.length === 0 ? <p className="text-center py-10 text-sm text-gray-400">No data for selected filters</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                  {['Student','Class','Feeding','Days left','Transport','Days left'].map(h=>(
                    <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map(s => (
                  <tr key={s.student_id} className={`hover:bg-gray-50 ${
                    ((s.feeding && !s.feeding.covered)||(s.transport && !s.transport.covered)) ? 'bg-red-50/30' : ''
                  }`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{s.student_name}</p>
                      <p className="text-xs text-gray-400">{s.student_number}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{s.class_name}{s.section?' '+s.section:''}</td>
                    <td className="px-4 py-3">
                      {s.feeding
                        ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.feeding.covered?'bg-green-100 text-green-700':'bg-red-100 text-red-600'}`}>
                            {s.feeding.covered?'✅ Covered':'❌ Unpaid'}
                          </span>
                        : <span className="text-xs text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {s.feeding ? <span className={s.feeding.days_remaining<=2?'text-red-500 font-bold':'text-gray-600'}>{s.feeding.days_remaining}d</span> : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {s.transport
                        ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.transport.covered?'bg-green-100 text-green-700':'bg-red-100 text-red-600'}`}>
                            {s.transport.covered?'✅ Covered':'❌ Unpaid'}
                          </span>
                        : <span className="text-xs text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {s.transport ? <span className={s.transport.days_remaining<=2?'text-red-500 font-bold':'text-gray-600'}>{s.transport.days_remaining}d</span> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── REPORTS TAB ───────────────────────────────────────────
function ReportsTab() {
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState({ date_from: today, date_to: today, fee_type:'' });

  async function load() {
    setLoading(true);
    try {
      const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v])=>v)));
      const {data} = await api.get(`/daily-fees/report?${q}`);
      setReport(data.data);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const totalCollected = report?.payments?.reduce((s,p)=>s+parseFloat(p.total_collected||0),0) || 0;

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex gap-3 flex-wrap items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" value={filters.date_from} onChange={e=>setFilters(f=>({...f,date_from:e.target.value}))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" value={filters.date_to} onChange={e=>setFilters(f=>({...f,date_to:e.target.value}))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filters.fee_type} onChange={e=>setFilters(f=>({...f,fee_type:e.target.value}))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All types</option>
          <option value="feeding">Feeding</option>
          <option value="transport">Transport</option>
        </select>
        <button onClick={load} disabled={loading}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
          {loading ? 'Loading…' : 'Generate Report'}
        </button>
      </div>

      {report && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Stat icon="💰" label="Total collected" value={`GH₵ ${totalCollected.toFixed(2)}`} color="text-green-600" />
            {report.payments?.map(p=>(
              <Stat key={p.fee_type}
                icon={p.fee_type==='feeding'?'🍽️':'🚌'}
                label={`${p.fee_type} payments`}
                value={`GH₵ ${parseFloat(p.total_collected).toFixed(2)}`}
                color="text-blue-600" />
            ))}
            {report.deductions?.map(d=>(
              <Stat key={d.fee_type+'_ded'}
                icon="📊"
                label={`${d.fee_type} students covered`}
                value={d.students_covered} />
            ))}
          </div>

          {/* Payment list */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Payments in period ({report.recentPayments?.length || 0})</p>
            </div>
            {!report.recentPayments?.length
              ? <p className="text-center py-8 text-sm text-gray-400">No payments in this period</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                        {['Receipt','Student','Class','Type','Amount','Method','Date'].map(h=>(
                          <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {report.recentPayments.map(p=>(
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-400">{p.receipt_number}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{p.student_name}</td>
                          <td className="px-4 py-3 text-gray-500">{p.class_name}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.fee_type==='feeding'?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>
                              {p.fee_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold">GH₵ {parseFloat(p.amount).toFixed(2)}</td>
                          <td className="px-4 py-3 text-gray-500 capitalize">{p.payment_method?.replace('_',' ')}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(p.payment_date).toLocaleDateString('en-GB')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        </>
      )}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────
const TABS = ['🚌 Zones', '🍽️ Feeding Rates', '💳 Payments', '📋 Daily Track', '📊 Reports'];

export default function FeedingTransport() {
  const [tab, setTab] = useState(2); // default to Payments

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Feeding & Transport Fees</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage daily fee payments, zones and tracking</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map((t,i) => (
          <TabBtn key={t} active={tab===i} onClick={()=>setTab(i)}>{t}</TabBtn>
        ))}
      </div>

      {tab === 0 && <ZonesTab />}
      {tab === 1 && <FeedingRatesTab />}
      {tab === 2 && <PaymentsTab />}
      {tab === 3 && <DailyTrackTab />}
      {tab === 4 && <ReportsTab />}
    </div>
  );
}