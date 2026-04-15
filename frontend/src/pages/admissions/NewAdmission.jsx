import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader, Card, Button, Input, Select } from '../../components/ui';
import toast from 'react-hot-toast';

const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;

export default function NewAdmission() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    applicant_name:'', email:'', phone:'', dob:'', gender:'',
    previous_school:'', class_applied:'', academic_year: CURRENT_YEAR,
    parent_name:'', parent_phone:'', parent_email:'', notes:'',
  });

  function set(field) { return e => setForm(p => ({ ...p, [field]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.applicant_name || !form.class_applied) return toast.error('Name and class are required');
    setSaving(true);
    try {
      const { data } = await api.post('/admissions', form);
      toast.success(`Application submitted — ${data.data.admission_number}`);
      navigate('/admissions/list');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit'); }
    finally { setSaving(false); }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="New application" subtitle="Fill in the applicant details"
        action={<Button onClick={() => navigate(-1)}>Back</Button>} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Card>
          <h3 className="text-sm font-medium text-gray-700 mb-4">Applicant information</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Full name *" value={form.applicant_name} onChange={set('applicant_name')} placeholder="e.g. Ama Mensah" />
            <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="Optional" />
            <Input label="Phone" value={form.phone} onChange={set('phone')} placeholder="+233 24 000 0000" />
            <Input label="Date of birth" type="date" value={form.dob} onChange={set('dob')} />
            <Select label="Gender" value={form.gender} onChange={set('gender')}>
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
            <Input label="Previous school" value={form.previous_school} onChange={set('previous_school')} placeholder="Optional" />
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-gray-700 mb-4">Enrollment details</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Class applying for *" value={form.class_applied} onChange={set('class_applied')} placeholder="e.g. JHS 1" />
            <Input label="Academic year" value={form.academic_year} onChange={set('academic_year')} placeholder="2025/2026" />
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-gray-700 mb-4">Parent / Guardian</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Parent name" value={form.parent_name} onChange={set('parent_name')} placeholder="Full name" />
            <Input label="Parent phone" value={form.parent_phone} onChange={set('parent_phone')} placeholder="+233 24 000 0000" />
            <div className="col-span-2">
              <Input label="Parent email" type="email" value={form.parent_email} onChange={set('parent_email')} placeholder="Optional" />
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Notes</h3>
          <textarea rows={3} value={form.notes} onChange={set('notes')}
            placeholder="Any additional information…"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>Submit application</Button>
        </div>
      </form>
    </div>
  );
}