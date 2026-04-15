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
  const dispatch    = useDispatch();
  const navigate    = useNavigate();
  const loading     = useSelector(selectAuthLoading);
  const authError   = useSelector(selectAuthError);
  const isLoggedIn  = useSelector(selectIsLoggedIn);
  const forceChange = useSelector(selectForceChange);

  const [form,     setForm]     = useState({ email: '', password: '' });
  const [showPw,   setShowPw]   = useState(false);
  const [slowConn, setSlowConn] = useState(false);

  useEffect(() => {
    if (isLoggedIn && forceChange) navigate('/change-password', { replace: true });
    else if (isLoggedIn)           navigate('/dashboard',       { replace: true });
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

  function EyeIcon({ open }) {
    return open ? (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
      </svg>
    ) : (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
      </svg>
    );
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
              label="Email address" type="email"
              placeholder="you@school.edu"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              autoFocus
            />

            {/* Password with show/hide toggle */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-200 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  <EyeIcon open={showPw} />
                </button>
              </div>
            </div>

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