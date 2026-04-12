import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../../api';
import { Button, Input } from '../../components/ui';
import toast from 'react-hot-toast';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirm: '', phone: '', occupation: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState({});

  function validate() {
    const e = {};
    if (!form.name)                        e.name     = 'Full name is required';
    if (!form.email)                       e.email    = 'Email is required';
    if (!form.password)                    e.password = 'Password is required';
    if (form.password.length < 8)          e.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirm)    e.confirm  = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await authAPI.register({
        name:       form.name,
        email:      form.email,
        password:   form.password,
        phone:      form.phone,
        occupation: form.occupation,
      });
      toast.success('Account created! You can now log in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  function f(field) {
    return {
      value:    form[field],
      onChange: e => setForm(p => ({ ...p, [field]: e.target.value })),
      error:    errors[field],
    };
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-10">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-800">EduClass</h1>
          <p className="text-sm text-gray-400 mt-1">Create a parent account</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-100 rounded-2xl p-8">
          <h2 className="text-base font-medium text-gray-700 mb-6">Register</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Full name *"    type="text"     placeholder="Kwame Asante"          {...f('name')} />
            <Input label="Email address *" type="email"  placeholder="kwame@example.com"      {...f('email')} />
            <Input label="Phone number"   type="tel"      placeholder="+233 24 000 0000"       {...f('phone')} />
            <Input label="Occupation"     type="text"     placeholder="e.g. Engineer"          {...f('occupation')} />
            <Input label="Password *"     type="password" placeholder="Min. 8 characters"      {...f('password')} />
            <Input label="Confirm password *" type="password" placeholder="Repeat password"   {...f('confirm')} />

            <p className="text-xs text-gray-400 -mt-1">
              After registering, contact the school admin to link your account to your child.
            </p>

            <Button type="submit" variant="primary" loading={loading} className="w-full mt-1">
              Create account
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </p>

        <p className="text-center text-xs text-gray-400 mt-3">
          <Link to="/" className="hover:underline">Back to home</Link>
        </p>
      </div>
    </div>
  );
}