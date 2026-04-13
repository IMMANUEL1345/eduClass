import React, { useState, useEffect } from 'react';
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

  const [pwForm,   setPwForm]   = useState({ current:'', password:'', confirm:'' });
  const [pwErrors, setPwErrors] = useState({});
  const [savingPw, setSavingPw] = useState(false);

  const [twoFA,       setTwoFA]       = useState({ enabled: false, loading: true });
  const [qrCode,      setQrCode]      = useState(null);
  const [otpToken,    setOtpToken]    = useState('');
  const [setupStep,   setSetupStep]   = useState(null); // null | 'scan' | 'disable'
  const [saving2FA,   setSaving2FA]   = useState(false);

  useEffect(() => {
    api.get('/2fa/status')
      .then(({ data }) => setTwoFA({ enabled: data.data.enabled, loading: false }))
      .catch(() => setTwoFA({ enabled: false, loading: false }));
  }, []);

  function validatePw() {
    const e = {};
    if (!pwForm.current)                       e.current  = 'Current password required';
    if (!pwForm.password)                      e.password = 'New password required';
    if (pwForm.password.length < 8)            e.password = 'Minimum 8 characters';
    if (pwForm.password !== pwForm.confirm)    e.confirm  = 'Passwords do not match';
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

  async function handle2FASetup() {
    setSaving2FA(true);
    try {
      const { data } = await api.post('/2fa/setup');
      setQrCode(data.data.qr_code);
      setSetupStep('scan');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start 2FA setup');
    } finally { setSaving2FA(false); }
  }

  async function handle2FAVerify(e) {
    e.preventDefault();
    if (!otpToken) return toast.error('Enter the 6-digit code');
    setSaving2FA(true);
    try {
      await api.post('/2fa/verify', { token: otpToken });
      toast.success('2FA enabled successfully');
      setTwoFA({ enabled: true, loading: false });
      setSetupStep(null);
      setOtpToken('');
      setQrCode(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid code');
    } finally { setSaving2FA(false); }
  }

  async function handle2FADisable(e) {
    e.preventDefault();
    if (!otpToken) return toast.error('Enter your authenticator code to confirm');
    setSaving2FA(true);
    try {
      await api.post('/2fa/disable', { token: otpToken });
      toast.success('2FA disabled');
      setTwoFA({ enabled: false, loading: false });
      setSetupStep(null);
      setOtpToken('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid code');
    } finally { setSaving2FA(false); }
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

      {/* Profile */}
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
      </Card>

      {/* Change password */}
      <Card className="mb-5">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Change password</h3>
        <form onSubmit={handleChangePw} className="flex flex-col gap-3">
          <Input label="Current password"     type="password" placeholder="Current password"
            value={pwForm.current}   onChange={e => setPwForm(p=>({...p,current:e.target.value}))}   error={pwErrors.current} />
          <Input label="New password"          type="password" placeholder="Min 8 characters"
            value={pwForm.password}  onChange={e => setPwForm(p=>({...p,password:e.target.value}))}  error={pwErrors.password} />
          <Input label="Confirm new password"  type="password" placeholder="Repeat new password"
            value={pwForm.confirm}   onChange={e => setPwForm(p=>({...p,confirm:e.target.value}))}   error={pwErrors.confirm} />
          <div className="flex justify-end mt-1">
            <Button type="submit" variant="primary" loading={savingPw}>Update password</Button>
          </div>
        </form>
      </Card>

      {/* 2FA */}
      <Card className="mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700">Two-factor authentication</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {twoFA.enabled
                ? 'Your account is protected with 2FA.'
                : 'Add an extra layer of security to your account.'}
            </p>
          </div>
          <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${twoFA.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {twoFA.loading ? '...' : twoFA.enabled ? 'Enabled' : 'Disabled'}
          </div>
        </div>

        {!setupStep && (
          <Button
            onClick={() => twoFA.enabled ? setSetupStep('disable') : handle2FASetup()}
            loading={saving2FA}
            variant={twoFA.enabled ? 'danger' : 'primary'}
            size="sm">
            {twoFA.enabled ? 'Disable 2FA' : 'Enable 2FA'}
          </Button>
        )}

        {/* Setup — scan QR */}
        {setupStep === 'scan' && qrCode && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-3">
              1. Install <strong>Google Authenticator</strong> or <strong>Authy</strong> on your phone.<br />
              2. Scan the QR code below.<br />
              3. Enter the 6-digit code shown in the app.
            </p>
            <div className="flex justify-center mb-4">
              <img src={qrCode} alt="2FA QR Code" className="w-40 h-40 border border-gray-200 rounded-xl p-2" />
            </div>
            <form onSubmit={handle2FAVerify} className="flex gap-2">
              <Input
                placeholder="Enter 6-digit code"
                value={otpToken}
                onChange={e => setOtpToken(e.target.value)}
                className="flex-1"
                maxLength={6}
              />
              <Button type="submit" variant="primary" loading={saving2FA}>Verify</Button>
              <Button type="button" onClick={() => { setSetupStep(null); setQrCode(null); setOtpToken(''); }}>Cancel</Button>
            </form>
          </div>
        )}

        {/* Disable 2FA */}
        {setupStep === 'disable' && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-3">
              Enter the 6-digit code from your authenticator app to confirm disabling 2FA.
            </p>
            <form onSubmit={handle2FADisable} className="flex gap-2">
              <Input
                placeholder="Enter 6-digit code"
                value={otpToken}
                onChange={e => setOtpToken(e.target.value)}
                className="flex-1"
                maxLength={6}
              />
              <Button type="submit" variant="danger" loading={saving2FA}>Confirm disable</Button>
              <Button type="button" onClick={() => { setSetupStep(null); setOtpToken(''); }}>Cancel</Button>
            </form>
          </div>
        )}
      </Card>

      {/* Sign out */}
      <div className="p-4 border border-red-100 rounded-xl bg-red-50">
        <p className="text-sm font-medium text-red-700 mb-1">Sign out</p>
        <p className="text-xs text-red-500 mb-3">This will end your current session.</p>
        <Button variant="danger" size="sm" onClick={async () => { await dispatch(logout()); navigate('/login'); }}>
          Sign out
        </Button>
      </div>
    </div>
  );
}