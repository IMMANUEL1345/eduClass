import React, { useEffect, useState } from 'react';
import { commsAPI } from '../../api';
import { useSelector } from 'react-redux';
import { selectRole } from '../../store/slices/authSlice';
import { PageHeader, Card, Button, Input, Select, Badge, Spinner, Empty } from '../../components/ui';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const ROLE_COLOR = { all: 'gray', teacher: 'blue', parent: 'pink', student: 'purple', admin: 'amber' };

export default function Announcements() {
  const role = useSelector(selectRole);
  const canCreate = role === 'admin' || role === 'teacher';

  const [announcements, setAnnouncements] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showForm,      setShowForm]       = useState(false);
  const [saving,        setSaving]         = useState(false);
  const [expanded,      setExpanded]       = useState(null);
  const [form, setForm] = useState({ title: '', body: '', target_role: 'all' });

  async function load() {
    setLoading(true);
    try {
      const { data } = await commsAPI.announcements();
      setAnnouncements(data.data);
    } catch { toast.error('Failed to load announcements'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.title || !form.body) return toast.error('Title and body required');
    setSaving(true);
    try {
      await commsAPI.createAnnouncement(form);
      toast.success('Announcement posted');
      setShowForm(false);
      setForm({ title: '', body: '', target_role: 'all' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post');
    } finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="School-wide notices and updates"
        action={canCreate
          ? <Button variant="primary" onClick={() => setShowForm(true)}>+ New announcement</Button>
          : null
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : announcements.length === 0 ? (
        <Empty message="No announcements yet" />
      ) : (
        <div className="flex flex-col gap-3 max-w-2xl">
          {announcements.map(a => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-gray-800">{a.title}</h3>
                    <Badge color={ROLE_COLOR[a.target_role] || 'gray'}>{a.target_role}</Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    {a.author_name} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </p>
                </div>
                <button
                  onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                  className="text-xs text-blue-600 hover:underline flex-shrink-0"
                >
                  {expanded === a.id ? 'Show less' : 'Read more'}
                </button>
              </div>

              <p className={`text-sm text-gray-600 leading-relaxed ${expanded === a.id ? '' : 'line-clamp-2'}`}>
                {a.body}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-base font-medium text-gray-800 mb-5">New announcement</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <Input
                label="Title *"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. End-of-term exam timetable"
              />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Message *</label>
                <textarea
                  rows={5}
                  value={form.body}
                  onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                  placeholder="Write your announcement…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white
                             text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500
                             resize-none placeholder:text-gray-400"
                />
              </div>
              <Select
                label="Audience"
                value={form.target_role}
                onChange={e => setForm(p => ({ ...p, target_role: e.target.value }))}
              >
                <option value="all">Everyone</option>
                <option value="teacher">Teachers only</option>
                <option value="parent">Parents only</option>
                <option value="student">Students only</option>
              </Select>
              <div className="flex justify-end gap-3 mt-2">
                <Button type="button" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" variant="primary" loading={saving}>Post announcement</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
