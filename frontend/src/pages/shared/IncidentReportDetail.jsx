import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import toast from 'react-hot-toast';

const API = process.env.REACT_APP_API_URL || 'https://educlass-api.onrender.com';

const SEV_COLOR = {
  low:'bg-green-100 text-green-700', medium:'bg-yellow-100 text-yellow-700',
  high:'bg-orange-100 text-orange-700', critical:'bg-red-100 text-red-700',
};
const STATUS_COLOR = {
  open:'bg-blue-100 text-blue-700', under_review:'bg-purple-100 text-purple-700',
  resolved:'bg-green-100 text-green-700', dismissed:'bg-gray-100 text-gray-500',
};
const FILE_ICON = { image:'🖼️', video:'🎥', audio:'🎵', document:'📄' };

function AttachmentCard({ att }) {
  return (
    <a href={att.file_url} target="_blank" rel="noreferrer"
      className="flex items-center gap-3 bg-gray-50 hover:bg-blue-50 border border-gray-100
                 hover:border-blue-200 transition-colors rounded-lg px-3 py-2.5 group">
      <span className="text-xl">{FILE_ICON[att.file_type] || '📎'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-700 truncate">{att.file_name || 'Attachment'}</p>
        <p className="text-xs text-gray-400 capitalize">{att.file_type} · click to open</p>
      </div>
      <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-500 flex-shrink-0"
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
      </svg>
    </a>
  );
}

function InfoRow({ label, children }) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      {children}
    </div>
  );
}

export default function IncidentReportDetail() {
  const { id }   = useParams();
  const user     = useSelector(selectUser);
  const navigate = useNavigate();
  const token    = sessionStorage.getItem('token');

  const [report,    setReport]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [updating,  setUpdating]  = useState(false);
  const [statusForm,setStatusForm]= useState({ status: '', action_taken: '' });

  useEffect(() => { fetchReport(); }, [id]);

  async function fetchReport() {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/incidents/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setReport(data.data);
      setStatusForm({ status: data.data?.status || 'open', action_taken: data.data?.action_taken || '' });
    } catch {}
    setLoading(false);
  }

  async function handleStatusUpdate() {
    setUpdating(true);
    try {
      const res  = await fetch(`${API}/incidents/${id}/status`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(statusForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Status updated');
      fetchReport();
    } catch (err) { toast.error(err.message); }
    setUpdating(false);
  }

  async function handleDelete() {
    if (!window.confirm('Delete this report permanently?')) return;
    const res = await fetch(`${API}/incidents/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) { toast.success('Report deleted'); navigate('/incidents'); }
    else toast.error('Failed to delete');
  }

  const canManage = ['admin','headmaster','teacher'].includes(user?.role);
  const canDelete = ['admin','headmaster'].includes(user?.role) || report?.reporter_id === user?.id;

  if (loading) return <div className="py-20 text-center text-sm text-gray-400">Loading report…</div>;
  if (!report) return <div className="py-20 text-center text-sm text-gray-400">Report not found</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/incidents')}
          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-gray-800">Incident Report #{report.id}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Filed {new Date(report.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}
          </p>
        </div>
        {canDelete && (
          <button onClick={handleDelete}
            className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 flex-shrink-0">
            Delete
          </button>
        )}
      </div>

      {/* Badges */}
      <div className="flex gap-2 flex-wrap">
        <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${SEV_COLOR[report.severity]}`}>
          {report.severity} severity
        </span>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[report.status]}`}>
          {report.status?.replace('_',' ')}
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
          {report.category}
        </span>
      </div>

      {/* Main details card */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="grid grid-cols-2 gap-5 mb-5">
          <InfoRow label="Reported against">
            <p className="text-sm font-semibold text-gray-800">{report.subject_name}</p>
            <p className="text-xs text-gray-400 capitalize">{report.subject_role?.replace('_',' ')}</p>
          </InfoRow>
          <InfoRow label="Reported by">
            <p className="text-sm font-semibold text-gray-800">{report.reporter_name}</p>
            <p className="text-xs text-gray-400 capitalize">{report.reporter_role?.replace('_',' ')}</p>
          </InfoRow>
          <InfoRow label="Date of incident">
            <p className="text-sm text-gray-700">
              {new Date(report.incident_date).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
            </p>
          </InfoRow>
          <InfoRow label="Date filed">
            <p className="text-sm text-gray-700">
              {new Date(report.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}
            </p>
          </InfoRow>
        </div>

        <InfoRow label="Description">
          <div className="mt-1 bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{report.description}</p>
          </div>
        </InfoRow>

        {report.action_taken && (
          <div className="mt-4">
            <InfoRow label="Action taken">
              <div className="mt-1 bg-green-50 border border-green-100 rounded-lg p-4">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{report.action_taken}</p>
              </div>
            </InfoRow>
            {report.actioned_by_name && (
              <p className="text-xs text-gray-400 mt-1.5">
                By {report.actioned_by_name} · {new Date(report.actioned_at).toLocaleDateString('en-GB')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Attachments */}
      {report.attachments?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">
            Attachments ({report.attachments.length})
          </p>
          <div className="space-y-2">
            {report.attachments.map(att => <AttachmentCard key={att.id} att={att} />)}
          </div>
        </div>
      )}

      {/* Status management */}
      {canManage && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-800 mb-4">Manage Report</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Update status</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {['open','under_review','resolved','dismissed'].map(s => (
                  <button key={s} onClick={() => setStatusForm(f=>({...f,status:s}))}
                    className={`py-2 rounded-lg text-xs font-medium capitalize transition-colors
                      ${statusForm.status === s
                        ? STATUS_COLOR[s] + ' ring-2 ring-offset-1 ring-current'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                    {s.replace('_',' ')}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Action taken <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea value={statusForm.action_taken}
                onChange={e => setStatusForm(f=>({...f,action_taken:e.target.value}))}
                rows={3} placeholder="Describe what action was taken..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <button onClick={handleStatusUpdate} disabled={updating}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {updating ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}