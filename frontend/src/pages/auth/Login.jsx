import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login, clearError, selectAuthLoading, selectAuthError, selectIsLoggedIn } from '../../store/slices/authSlice';
import { Button, Input } from '../../components/ui';
import toast from 'react-hot-toast';

export default function Login() {
  const dispatch   = useDispatch();
  const navigate   = useNavigate();
  const loading    = useSelector(selectAuthLoading);
  const authError  = useSelector(selectAuthError);
  const isLoggedIn = useSelector(selectIsLoggedIn);

  const [form, setForm] = useState({ email: '', password: '' });

  useEffect(() => {
    if (isLoggedIn) navigate('/dashboard', { replace: true });
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    if (authError) { toast.error(authError); dispatch(clearError()); }
  }, [authError, dispatch]);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error('Enter email and password');
    const result = await dispatch(login(form));
    if (login.fulfilled.match(result)) {
      toast.success('Welcome back!');
      navigate('/dashboard');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-800">EduClass</h1>
          <p className="text-sm text-gray-400 mt-1">School management system</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-100 rounded-2xl p-8">
          <h2 className="text-base font-medium text-gray-700 mb-6">Sign in to your account</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email address"
              type="email"
              name="email"
              placeholder="you@school.edu"
              value={form.email}
              onChange={handleChange}
              autoFocus
            />
            <Input
              label="Password"
              type="password"
              name="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
            />
            <div className="text-right">
              <a href="/forgot-password" className="text-xs text-blue-600 hover:underline">
                Forgot password?
              </a>
            </div>
            <Button type="submit" variant="primary" loading={loading} className="w-full mt-1">
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          EduClass v1.0 · Faculty of Engineering
        </p>
      </div>
    </div>
  );
}
