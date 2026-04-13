import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectUser, clearForceChange, logout } from '../../store/slices/authSlice';
import api from '../../api';
import { Button, Input } from '../../components/ui';
import toast from 'react-hot-toast';

export default function ForceChangePassword() {
  const user     = useSelector(selectUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [form,   setForm]   = useState({ current: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function validate() {
    const e = {};
    if (!form.current)                       e.current  = 'Enter your temporary password';
    if (!form.password)                      e.password = 'Enter a new password';
    if (form.password.length < 8)            e.password = 'Minimum 8 characters';
    if (form.password === form.current)      e.password = 'New password must be different from temporary password';
    if (form.password !== form.confirm)      e.confirm  = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        current_password: form.current,
        new_password:     form.password,
      });
      toast.success('Password changed successfully. Please log in with your new password.');
      dispatch(clearForceChange());
      await dispatch(logout());
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally { setSaving(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <img src="/logo.png" alt="EduClass" className="w-14 h-14 object-contain" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-800">EduClass</h1>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-100 rounded-2xl p-8">
          {/* Warning banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 flex items-start gap-3">
            <span className="text-amber-500 text-lg flex-shrink-0">⚠️</span>
            <div>
              <p className="text-xs font-medium text-amber-700">Password change required</p>
              <p className="text-xs text-amber-600 mt-0.5">
                You are using a temporary password. You must set a new password before continuing.
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-5">
            Welcome, <strong>{user?.name}</strong>. Please set a permanent password to continue.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Temporary password"
              type="password"
              placeholder="Enter your temporary password"
              value={form.current}
              onChange={e => setForm(p => ({ ...p, current: e.target.value }))}
              error={errors.current}
            />
            <Input
              label="New password"
              type="password"
              placeholder="Minimum 8 characters"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              error={errors.password}
            />
            <Input
              label="Confirm new password"
              type="password"
              placeholder="Repeat new password"
              value={form.confirm}
              onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
              error={errors.confirm}
            />
            <Button type="submit" variant="primary" loading={saving} className="w-full mt-2">
              Set new password
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          EduClass v1.0 · Faculty of Engineering
        </p>
      </div>
    </div>
  );
}