import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../api';
import { PageHeader, Card, Button, Input, Select, Badge, Spinner } from '../../components/ui';
import toast from 'react-hot-toast';

const ROLES      = ['admin','teacher','accountant','admissions_officer','cashier','parent','student'];
const ROLE_COLOR = { admin:'blue', teacher:'teal', accountant:'amber', parent:'pink', student:'purple', cashier:'orange', admissions_officer:'indigo' };

function ActionMenu({ user, onDeactivate, onActivate, onResetPw, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-8 bg-white border border-gray-100 rounded-xl shadow-lg py-1 w-44 z-50">
          {user.is_active
            ? <MenuItem label="Deactivate" color="amber" onClick={() => { onDeactivate(); setOpen(false); }} />
            : <MenuItem label="Activate"   color="green" onClick={() => { onActivate();   setOpen(false); }} />
          }
          <MenuItem label="Reset password" color="blue" onClick={() => { onResetPw(); setOpen(false); }} />
          <div className="border-t border-gray-100 my-1" />
          <MenuItem label="Delete account" color="red" onClick={() => { onDelete(); setOpen(false); }} />
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, color, onClick }) {
  const colors = { amber: 'text-amber-600 hover:bg-amber-50', green: 'text-green-600 hover:bg-green-50',
                   blue: 'text-blue-600 hover:bg-blue-50', red: 'text-red-500 hover:bg-red-50' };
  return (
    <button onClick={onClick}
      className={`w-full text-left px-4 py-2 text-sm transition-colors ${colors[color]}`}>
      {label}
    </button>
  );
}

export default function UserManagement() {
  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [showReset,  setShowReset]  = useState(null);
  const [showDelete, setShowDelete] = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'teacher', phone:'', specialization:'' });
  const [newPassword, setNewPassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data.data);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.role) return toast.error('Name, email and role required');
    setSaving(true);
    try {
      const { data } = await api.post('/users', form);
      toast.success(data.message);
      setShowForm(false);
      setForm({ name:'', email:'', password:'', role:'teacher', phone:'', specialization:'' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create user'); }
    finally { setSaving(false); }
  }

  async function handleToggle(user, active) {
    try {
      await api.put(`/users/${user.id}`, { is_active: active });
      toast.success(active ? 'User activated' : 'User deactivated');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) return toast.error('Min 8 characters');
    setSaving(true);
    try {
      await api.post(`/users/${showReset.id}/reset-password`, { new_password: newPassword });
      toast.success('Password reset successfully');
      setShowReset(null); setNewPassword('');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await api.delete(`/users/${showDelete.id}`);
      toast.success('User deleted');
      setShowDelete(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  }

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
                        u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole   = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div>
      <PageHeader
        title="User management"
        subtitle={`${users.length} accounts`}
        action={<Button variant="primary" onClick={() => setShowForm(true)}>+ Create account</Button>}
      />

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <Input placeholder="Search name or email…" value={search}
          onChange={e => setSearch(e.target.value)} className="w-56" />
        <Select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="w-40">
          <option value="">All roles</option>
          {ROLES.map(r => <option key={r} value={r} className="capitalize">{r.replace('_',' ')}</option>)}
        </Select>
        <Button onClick={load}>Refresh</Button>
      </div>

      {/* Role counts */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {ROLES.map(r => {
          const count = users.filter(u => u.role === r).length;
          if (!count) return null;
          return (
            <div key={r} className="bg-white border border-gray-100 rounded-xl px-4 py-2 flex items-center gap-2">
              <Badge color={ROLE_COLOR[r] || 'gray'}>{r.replace('_',' ')}</Badge>
              <span className="text-sm font-medium text-gray-700">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No users found</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Name','Email','Role','Status','Created',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0
                        ${ROLE_COLOR[u.role] === 'blue' ? 'bg-blue-100 text-blue-700' :
                          ROLE_COLOR[u.role] === 'teal' ? 'bg-teal-100 text-teal-700' :
                          ROLE_COLOR[u.role] === 'amber' ? 'bg-amber-100 text-amber-700' :
                          ROLE_COLOR[u.role] === 'pink' ? 'bg-pink-100 text-pink-700' :
                          ROLE_COLOR[u.role] === 'purple' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-600'}`}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge color={ROLE_COLOR[u.role] || 'gray'}>{u.role.replace('_',' ')}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={u.is_active ? 'green' : 'red'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(u.created_at).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-4 py-3">
                    <ActionMenu
                      user={u}
                      onDeactivate={() => handleToggle(u, false)}
                      onActivate={()   => handleToggle(u, true)}
                      onResetPw={()    => setShowReset(u)}
                      onDelete={()     => setShowDelete(u)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-base font-medium text-gray-800 mb-5">Create account</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <Input label="Full name *" value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} placeholder="John Doe" />
              <Input label="Email *" type="email" value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))} placeholder="john@school.edu" />
              <Select label="Role *" value={form.role} onChange={e => setForm(p=>({...p,role:e.target.value}))}>
                {ROLES.map(r => <option key={r} value={r}>{r.replace('_',' ').replace(/\b\w/g, l=>l.toUpperCase())}</option>)}
              </Select>
              {form.role === 'teacher' && (
                <Input label="Specialization" value={form.specialization} onChange={e => setForm(p=>({...p,specialization:e.target.value}))} placeholder="Mathematics" />
              )}
              {(form.role === 'teacher' || form.role === 'parent') && (
                <Input label="Phone" value={form.phone} onChange={e => setForm(p=>({...p,phone:e.target.value}))} placeholder="+233 24 000 0000" />
              )}
              <Input label="Password (optional)" type="password" value={form.password}
                onChange={e => setForm(p=>({...p,password:e.target.value}))} placeholder="Leave blank to auto-generate" />
              <p className="text-xs text-gray-400">A secure password is auto-generated and emailed if left blank.</p>
              <div className="flex justify-end gap-3 mt-2">
                <Button type="button" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" variant="primary" loading={saving}>Create account</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {showReset && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-base font-medium text-gray-800 mb-1">Reset password</h2>
            <p className="text-xs text-gray-400 mb-5">{showReset.name} · {showReset.email}</p>
            <form onSubmit={handleResetPassword} className="flex flex-col gap-3">
              <Input label="New password *" type="password" value={newPassword}
                onChange={e => setNewPassword(e.target.value)} placeholder="Min 8 characters" />
              <div className="flex justify-end gap-3 mt-2">
                <Button type="button" onClick={() => { setShowReset(null); setNewPassword(''); }}>Cancel</Button>
                <Button type="submit" variant="primary" loading={saving}>Reset password</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-xl mx-auto mb-4">🗑️</div>
            <h2 className="text-base font-medium text-gray-800 text-center mb-2">Delete account</h2>
            <p className="text-sm text-gray-500 text-center mb-1">
              Are you sure you want to permanently delete <strong>{showDelete.name}</strong>?
            </p>
            <p className="text-xs text-red-500 text-center mb-5">This cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => setShowDelete(null)}>Cancel</Button>
              <Button variant="danger" loading={saving} onClick={handleDelete}>Delete permanently</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}