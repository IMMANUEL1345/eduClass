import React, { useEffect, useState, useCallback } from 'react';
import api from '../../api';
import { PageHeader, Card, Table, Button, Input, Select, Badge, Spinner } from '../../components/ui';
import toast from 'react-hot-toast';

const ROLES      = ['admin','teacher','accountant','parent','student'];
const ROLE_COLOR = { admin:'blue', teacher:'teal', accountant:'amber', parent:'pink', student:'purple' };

export default function UserManagement() {
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [showReset, setShowReset] = useState(null);
  const [showDelete,setShowDelete]= useState(null);
  const [saving,    setSaving]    = useState(false);
  const [search,    setSearch]    = useState('');
  const [roleFilter,setRoleFilter]= useState('');
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
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally { setSaving(false); }
  }

  async function handleToggleActive(user) {
    try {
      await api.put(`/users/${user.id}`, { is_active: !user.is_active });
      toast.success(user.is_active ? 'User deactivated' : 'User activated');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update'); }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) return toast.error('Min 8 characters');
    setSaving(true);
    try {
      await api.post(`/users/${showReset.id}/reset-password`, { new_password: newPassword });
      toast.success('Password reset successfully');
      setShowReset(null);
      setNewPassword('');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to reset'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await api.delete(`/users/${showDelete.id}`);
      toast.success('User deleted');
      setShowDelete(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); }
    finally { setSaving(false); }
  }

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
                        u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole   = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const columns = [
    { key: 'name',       label: 'Name',    width: '160px' },
    { key: 'email',      label: 'Email',   width: '200px', render: v => <span className="text-xs text-gray-500">{v}</span> },
    { key: 'role',       label: 'Role',    width: '110px', render: v => <Badge color={ROLE_COLOR[v] || 'gray'}>{v}</Badge> },
    { key: 'is_active',  label: 'Status',  width: '90px',  render: v => <Badge color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Badge> },
    { key: 'created_at', label: 'Created', width: '110px', render: v => new Date(v).toLocaleDateString('en-GB') },
    { key: 'actions',    label: '',        width: '180px',
      render: (_, row) => (
        <div className="flex gap-2">
          <button onClick={() => handleToggleActive(row)}
            className={`text-xs hover:underline ${row.is_active ? 'text-amber-500' : 'text-green-600'}`}>
            {row.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={() => setShowReset(row)} className="text-xs text-blue-600 hover:underline">
            Reset pw
          </button>
          <button onClick={() => setShowDelete(row)} className="text-xs text-red-500 hover:underline">
            Delete
          </button>
        </div>
      )},
  ];

  return (
    <div>
      <PageHeader
        title="User management"
        subtitle={`${users.length} accounts`}
        action={<Button variant="primary" onClick={() => setShowForm(true)}>+ Create account</Button>}
      />

      <div className="flex gap-3 mb-5">
        <Input placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)} className="w-56" />
        <Select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="w-36">
          <option value="">All roles</option>
          {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
        </Select>
        <Button onClick={load}>Refresh</Button>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        {ROLES.map(r => {
          const count = users.filter(u => u.role === r).length;
          return (
            <div key={r} className="bg-white border border-gray-100 rounded-xl px-4 py-2 flex items-center gap-2">
              <Badge color={ROLE_COLOR[r]}>{r}</Badge>
              <span className="text-sm font-medium text-gray-700">{count}</span>
            </div>
          );
        })}
      </div>

      <Card>
        {loading
          ? <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          : <Table columns={columns} data={filtered} emptyText="No users found" />
        }
      </Card>

      {/* Create user modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-base font-medium text-gray-800 mb-5">Create account</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <Input label="Full name *" value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} placeholder="John Doe" />
              <Input label="Email *" value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))} placeholder="john@school.edu" type="email" />
              <Select label="Role *" value={form.role} onChange={e => setForm(p=>({...p,role:e.target.value}))}>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
              </Select>
              {form.role === 'teacher' && (
                <Input label="Specialization" value={form.specialization} onChange={e => setForm(p=>({...p,specialization:e.target.value}))} placeholder="Mathematics" />
              )}
              {(form.role === 'teacher' || form.role === 'parent') && (
                <Input label="Phone" value={form.phone} onChange={e => setForm(p=>({...p,phone:e.target.value}))} placeholder="+233 24 000 0000" />
              )}
              <Input label="Password (optional)" value={form.password} onChange={e => setForm(p=>({...p,password:e.target.value}))}
                placeholder="Leave blank for auto-generated" type="password" />
              <p className="text-xs text-gray-400">If left blank, a secure password is auto-generated and emailed to the user.</p>
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
            <h2 className="text-base font-medium text-gray-800 mb-2">Delete account</h2>
            <p className="text-sm text-gray-500 mb-1">
              Are you sure you want to permanently delete <strong>{showDelete.name}</strong>?
            </p>
            <p className="text-xs text-red-500 mb-5">
              This cannot be undone. All data associated with this account will be removed.
            </p>
            <div className="flex justify-end gap-3">
              <Button onClick={() => setShowDelete(null)}>Cancel</Button>
              <Button variant="danger" loading={saving} onClick={handleDelete}>Delete permanently</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}