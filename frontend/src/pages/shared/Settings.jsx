import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, logout } from '../../store/slices/authSlice';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader, Card, Button, Input } from '../../components/ui';
import toast from 'react-hot-toast';

export default function Settings() {
  const user     = useSelector(selectUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [pwForm, setPwForm] = useState({ current: '', password: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [savingPw,  setSavingPw]  = useState(false);

  function validatePw() {
    const e = {};
    if (!pwForm.current)                          e.current  = 'Current password required';
    if (!pwForm.password)                         e.password = 'New password required';
    if (pwForm.password.length < 8)               e.password = 'Minimum 8 characters';
    if (pwForm.password !== pwForm.confirm)        e.confirm  = 'Passwords do not match';
    setPwErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleChangePw(e) {
    e.preventDefault();
    if (!validatePw()) return;
    setSavingPw(true);
    try {
      await api.post('/auth/change-password', {
        current_password: pwForm.current,
        new_password:     pwForm.password,
      });
      toast.success('Password changed. Please log in again.');
      await dispatch(logout());
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally { setSavingPw(false); }
  }

  const ROLE_COLOR = {
    admin:      'bg-blue-100 text-blue-700',
    teacher:    'bg-teal-100 text-teal-700',
    parent:     'bg-pink-100 text-pink-700',
    student:    'bg-purple-100 text-purple-700',
    accountant: 'bg-amber-100 text-amber-700',
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="max-w-xl">
      <PageHeader title="Settings" subtitle="Manage your account" />

      {/* Profile card */}
      <Card className="mb-5">
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-base font-medium flex-shrink-0 ${ROLE_COLOR[user?.role]}`}>
            {initials}
          </div>
          <div>
            <p className="text-base font-medium text-gray-800">{user?.name}</p>
            <p className="text-sm text-gray-400">{user?.email}</p>
            <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded capitalize ${ROLE_COLOR[user?.role]}`}>
              {user?.role}
            </span>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-3">
          <table className="w-full text-sm">
            {[
              ['Name',  user?.name],
              ['Email', user?.email],
              ['Role',  user?.role],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-gray-50 last:border-0">
                <td className="py-1.5 text-gray-400 w-20">{k}</td>
                <td className="py-1.5 text-gray-700 capitalize">{v}</td>
              </tr>
            ))}
          </table>
        </div>
      </Card>

      {/* Change password */}
      <Card>
        <h3 className="text-sm font-medium text-gray-700 mb-4">Change password</h3>
        <form onSubmit={handleChangePw} className="flex flex-col gap-3">
          <Input
            label="Current password"
            type="password"
            placeholder="Enter current password"
            value={pwForm.current}
            onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
            error={pwErrors.current}
          />
          <Input
            label="New password"
            type="password"
            placeholder="Min. 8 characters"
            value={pwForm.password}
            onChange={e => setPwForm(p => ({ ...p, password: e.target.value }))}
            error={pwErrors.password}
          />
          <Input
            label="Confirm new password"
            type="password"
            placeholder="Repeat new password"
            value={pwForm.confirm}
            onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
            error={pwErrors.confirm}
          />
          <div className="flex justify-end mt-1">
            <Button type="submit" variant="primary" loading={savingPw}>
              Update password
            </Button>
          </div>
        </form>
      </Card>

      {/* Danger zone */}
      <div className="mt-6 p-4 border border-red-100 rounded-xl bg-red-50">
        <p className="text-sm font-medium text-red-700 mb-1">Sign out</p>
        <p className="text-xs text-red-500 mb-3">This will end your current session.</p>
        <Button
          variant="danger"
          size="sm"
          onClick={async () => {
            await dispatch(logout());
            navigate('/login');
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}