import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import {
  login, clearError,
  selectAuthLoading, selectAuthError,
  selectIsLoggedIn, selectForceChange,
} from '../../store/slices/authSlice';
import { Button, Input } from '../../components/ui';
import toast from 'react-hot-toast';

export default function Login() {
  const dispatch     = useDispatch();
  const navigate     = useNavigate();
  const loading      = useSelector(selectAuthLoading);
  const authError    = useSelector(selectAuthError);
  const isLoggedIn   = useSelector(selectIsLoggedIn);
  const forceChange  = useSelector(selectForceChange);

  const [form,     setForm]     = useState({ email: '', password: '' });
  const [slowConn, setSlowConn] = useState(false);

  // Redirect based on state
  useEffect(() => {
    if (isLoggedIn && forceChange)  navigate('/change-password', { replace: true });
    else if (isLoggedIn)            navigate('/dashboard', { replace: true });
  }, [isLoggedIn, forceChange, navigate]);

  useEffect(() => {
    if (authError) { toast.error(authError); dispatch(clearError()); }
  }, [authError, dispatch]);

  useEffect(() => {
    let t;
    if (loading) t = setTimeout(() => setSlowConn(true), 5000);
    else setSlowConn(false);
    return () => clearTimeout(t);
  }, [loading]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error('Enter email and password');
    await dispatch(login(form));
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <img src="/logo.png" alt="EduClass" className="w-14 h-14 object-contain" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-800">EduClass</h1>
          <p className="text-sm text-gray-400 mt-1">School management system</p>
        </div>

        {/* Server waking up notice */}
        {slowConn && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-3">
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-700">Server is waking up...</p>
              <p className="text-xs text-amber-600 mt-0.5">This can take up to 60 seconds on first load. Please wait.</p>
            </div>
          </div>
        )}

        <div className="bg-white border border-gray-100 rounded-2xl p-8">
          <h2 className="text-base font-medium text-gray-700 mb-6">Sign in to your account</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email address" type="email" name="email"
              placeholder="you@school.edu"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              autoFocus
            />
            <Input
              label="Password" type="password" name="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
            />
            <div className="text-right">
              <Link to="/forgot-password" className="text-xs text-blue-600 hover:underline">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" variant="primary" loading={loading} className="w-full mt-1">
              {loading ? (slowConn ? 'Waking server...' : 'Signing in...') : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          New parent?{' '}
          <Link to="/register" className="text-blue-600 hover:underline">Create an account</Link>
        </p>
        <p className="text-center text-xs text-gray-400 mt-2">
          <Link to="/" className="hover:underline">Back to home</Link>
        </p>
        <p className="text-center text-xs text-gray-400 mt-5">EduClass v1.0 · Faculty of Engineering</p>
      </div>
    </div>
  );
}