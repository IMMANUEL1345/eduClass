import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import toast from 'react-hot-toast';

const API = process.env.REACT_APP_API_URL || 'https://educlass-api.onrender.com';

const CATEGORIES = [
  'Misconduct','Bullying','Violence','Insubordination',
  'Academic Dishonesty','Harassment','Lateness / Truancy',
  'Vandalism','Substance Abuse','Cyberbullying','Other',
];
const ACCEPTED = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.txt';

function fileCategory(mime) {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
}
function fmt(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1048576).toFixed(1) + ' MB';
}
const FILE_ICON = { image:'🖼️', video:'🎥', audio:'🎵', document:'📄' };

export default function NewIncidentReport() {
  const user     = useSelector(selectUser);
  const navigate = useNavigate();
  const token    = sessionStorage.getItem('token');

  const [form, setForm] = useState({
    subject_id: '', category: '', severity: 'medium',
    description: '', incident_date: new Date().toISOString().split('T')[0],
  });
  const [subjectQuery,   setSubjectQuery]   = useState('');
  const [subjectResults, setSubjectResults] = useState([]);
  const [selectedSubject, setSelected]      = useState(null);
  const [searching, setSearching]           = useState(false);
  const [files,  setFiles]                  = useState([]);
  const [drag,   setDrag]                   = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const searchTimer = useRef(null);

  function handleSubjectInput(val) {
    setSubjectQuery(val);
    setSelected(null);
    clearTimeout(searchTimer.current);
    if (!val.trim()) { setSubjectResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await fetch(`${API}/incidents/search-subjects?q=${encodeURIComponent(val)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setSubjectResults(data.data || []);
      } catch {}
      setSearching(false);
    }, 350);
  }

  function pickSubject(s) {
    setSelected(s);
    setSubjectQuery(s.name);
    setSubjectResults([]);
    setForm(f => ({ ...f, subject_id: s.id }));
  }

  function addFiles(incoming) {
    const valid = Array.from(incoming).filter(f => {
      const ok = /^(image|video|audio)\//i.test(f.type)
        || /pdf|msword|officedocument|text\/plain/.test(f.type);
      if (!ok) toast.error(`${f.name}: unsupported type`);
      return ok;
    });
    setFiles(prev => {
      const next = [...prev, ...valid].slice(0, 5);
      if (prev.length + valid.length > 5) toast.error('Max 5 attachments');
      return next;
    });
  }

  async function handleSubmit() {
    if (!form.subject_id)         return toast.error('Select who you are reporting');
    if (!form.category)           return toast.error('Select a category');
    if (!form.description.trim()) return toast.error('Write a description');
    if (!form.incident_date)      return toast.error('Select incident date');

    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      files.forEach(f => fd.append('files', f));

      const res  = await fetch(`${API}/incidents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      toast.success('Report filed successfully');
      navigate('/incidents');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/incidents')}
          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-800">File an Incident Report</h1>
          <p className="text-sm text-gray-500">All reports are confidential and reviewed by administration</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">

        {/* Subject search */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Who are you reporting? <span className="text-red-500">*</span>
          </label>
          <input type="text" value={subjectQuery}
            onChange={e => handleSubjectInput(e.target.value)}
            placeholder="Search by name..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />

          {subjectResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
              {subjectResults.map(s => (
                <button key={s.id} onClick={() => pickSubject(s)}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {s.name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.name}</p>
                    <p className="text-xs text-gray-400 capitalize">
                      {s.role?.replace('_',' ')}{s.class_name ? ` · ${s.class_name}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {searching && <p className="text-xs text-gray-400 mt-1">Searching...</p>}
          {selectedSubject && (
            <div className="mt-2 flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
              Reporting against <strong className="ml-1">{selectedSubject.name}</strong>
              <span className="text-green-500 ml-1 capitalize">({selectedSubject.role?.replace('_',' ')})</span>
            </div>
          )}
        </div>

        {/* Category + Severity */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Category <span className="text-red-500">*</span>
            </label>
            <select value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Severity</label>
            <select value={form.severity} onChange={e => setForm(f=>({...f,severity:e.target.value}))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="low">🟢 Low</option>
              <option value="medium">🟡 Medium</option>
              <option value="high">🟠 High</option>
              <option value="critical">🔴 Critical</option>
            </select>
          </div>
        </div>

        {/* Incident date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Date of incident <span className="text-red-500">*</span>
          </label>
          <input type="date" value={form.incident_date}
            max={new Date().toISOString().split('T')[0]}
            onChange={e => setForm(f=>({...f,incident_date:e.target.value}))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea value={form.description} rows={5}
            onChange={e => setForm(f=>({...f,description:e.target.value}))}
            placeholder="Describe what happened in detail — when, where, what occurred, any witnesses..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          <p className="text-xs text-gray-400 mt-1">{form.description.length} characters</p>
        </div>

        {/* Attachments */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Evidence / Attachments
            <span className="text-gray-400 font-normal ml-1">(optional · max 5 · images, video, audio, documents)</span>
          </label>

          <div
            onDragOver={e=>{e.preventDefault();setDrag(true)}}
            onDragLeave={()=>setDrag(false)}
            onDrop={e=>{e.preventDefault();setDrag(false);addFiles(e.dataTransfer.files)}}
            onClick={()=>document.getElementById('inc-files').click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
              ${drag ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
          >
            <div className="text-3xl mb-2">📎</div>
            <p className="text-sm font-medium text-gray-600">Drop files here or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Images · Videos · Audio · PDF · Word · Text — up to 100 MB each</p>
            <input id="inc-files" type="file" multiple accept={ACCEPTED} className="hidden"
              onChange={e=>{addFiles(e.target.files);e.target.value='';}} />
          </div>

          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-lg">{FILE_ICON[fileCategory(file.type)]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{file.name}</p>
                    <p className="text-xs text-gray-400">{fmt(file.size)}</p>
                  </div>
                  {file.type.startsWith('image/') && (
                    <img src={URL.createObjectURL(file)} alt="" className="w-10 h-10 object-cover rounded flex-shrink-0" />
                  )}
                  <button onClick={()=>setFiles(p=>p.filter((_,j)=>j!==i))}
                    className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button onClick={()=>navigate('/incidents')}
            className="flex-1 py-2.5 border border-gray-200 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed">
            {submitting ? 'Submitting…' : '🚩 Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
}