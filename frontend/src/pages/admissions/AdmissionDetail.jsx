import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectRole } from '../../store/slices/authSlice';
import api from '../../api';
import { PageHeader, Card, Badge, Button, Spinner } from '../../components/ui';
import toast from 'react-hot-toast';

const STATUS_COLOR = { pending:'amber', approved:'blue', rejected:'red', enrolled:'green' };

export default function AdmissionDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const role     = useSelector(selectRole);
  const [app,     setApp]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [showReject, setShowReject] = useState(false);

  useEffect(() => {
    api.get(`/admissions/${id}`)
      .then(({ data }) => setApp(data.data))
      .catch(() => toast.error('Failed to load application'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleApprove() {
    if (!window.confirm('Approve this application and create a student account?')) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/admissions/${id}/approve`);
      toast.success(`Student account created! Student number: ${data.data.student_number}`);
      navigate('/admissions/list');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to approve'); }
    finally { setSaving(false); }
  }

  async function handleReject(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/admissions/${id}/reject`, { reason: rejectNote });
      toast.success('Application rejected');
      navigate('/admissions/list');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to reject'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!app)    return <div className="text-center py-20 text-gray-400">Application not found</div>;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={app.applicant_name}
        subtitle={`${app.admission_number} · ${app.class_applied}`}
        action={<Button onClick={() => navigate(-1)}>Back</Button>}
      />

      <div className="flex items-center gap-3 mb-5">
        <Badge color={STATUS_COLOR[app.status]} size="lg">{app.status}</Badge>
        {app.status === 'pending' && (
          <>
            <Button variant="primary" loading={saving} onClick={handleApprove}>
              Approve & enroll
            </Button>
            <Button variant="danger" onClick={() => setShowReject(true)}>Reject</Button>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <Card title="Applicant details">
          {[
            ['Name',            app.applicant_name],
            ['Email',           app.email || '—'],
            ['Phone',           app.phone || '—'],
            ['Date of birth',   app.dob ? new Date(app.dob).toLocaleDateString('en-GB') : '—'],
            ['Gender',          app.gender || '—'],
            ['Previous school', app.previous_school || '—'],
          ].map(([k,v]) => (
            <div key={k} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0 text-sm">
              <span className="text-gray-400">{k}</span>
              <span className="text-gray-700 font-medium capitalize">{v}</span>
            </div>
          ))}
        </Card>

        <Card title="Enrollment & parent">
          {[
            ['Class applied',  app.class_applied],
            ['Academic year',  app.academic_year],
            ['Admission no.',  app.admission_number],
            ['Parent name',    app.parent_name || '—'],
            ['Parent phone',   app.parent_phone || '—'],
            ['Parent email',   app.parent_email || '—'],
          ].map(([k,v]) => (
            <div key={k} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0 text-sm">
              <span className="text-gray-400">{k}</span>
              <span className="text-gray-700 font-medium">{v}</span>
            </div>
          ))}
        </Card>
      </div>

      {app.notes && (
        <Card className="mt-5">
          <p className="text-xs text-gray-400 mb-1">Notes</p>
          <p className="text-sm text-gray-600 whitespace-pre-line">{app.notes}</p>
        </Card>
      )}

      {showReject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-base font-medium text-gray-800 mb-4">Reject application</h2>
            <form onSubmit={handleReject} className="flex flex-col gap-3">
              <textarea rows={3} value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                placeholder="Reason for rejection (optional)"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-red-400" />
              <div className="flex justify-end gap-3">
                <Button type="button" onClick={() => setShowReject(false)}>Cancel</Button>
                <Button type="submit" variant="danger" loading={saving}>Confirm reject</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}