import React, { useEffect, useState, useCallback, useRef } from 'react';
import { commsAPI } from '../../api';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import { PageHeader, Card, Button, Input, Spinner } from '../../components/ui';
import { formatDistanceToNow } from 'date-fns';
import api from '../../api';
import toast from 'react-hot-toast';

function UserSearch({ value, onChange }) {
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState([]);
  const [searching,setSearching]= useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const ref = useRef();

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setShowDrop(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleSearch(q) {
    setQuery(q);
    if (q.length < 2) { setResults([]); setShowDrop(false); return; }
    setSearching(true);
    try {
      const { data } = await api.get('/users/search', { params: { q } });
      setResults(data.data || []);
      setShowDrop(true);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }

  function select(user) {
    onChange(user);
    setQuery(user.name);
    setShowDrop(false);
  }

  return (
    <div className="relative" ref={ref}>
      <label className="text-xs font-medium text-gray-500 block mb-1">Recipient *</label>
      <div className="relative">
        <input
          type="text"
          value={value?.name ? `${value.name} (${value.role})` : query}
          onChange={e => { onChange(null); handleSearch(e.target.value); }}
          placeholder="Search by name or email…"
          className="w-full px-3 py-2.5 pr-8 text-sm border border-gray-200 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>
      {showDrop && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100
                        rounded-xl shadow-lg z-50 overflow-hidden max-h-48 overflow-y-auto">
          {results.map(u => (
            <button key={u.id} onClick={() => select(u)}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
              <p className="text-sm font-medium text-gray-700">{u.name}</p>
              <p className="text-xs text-gray-400 capitalize">{u.role.replace('_',' ')} · {u.email}</p>
            </button>
          ))}
        </div>
      )}
      {showDrop && results.length === 0 && !searching && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-50 p-3">
          <p className="text-sm text-gray-400 text-center">No users found</p>
        </div>
      )}
    </div>
  );
}

export default function Messages() {
  const user = useSelector(selectUser);
  const [view,     setView]     = useState('inbox');
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [compose,  setCompose]  = useState(false);
  const [sending,  setSending]  = useState(false);
  const [form, setForm] = useState({ receiver: null, subject: '', body: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = view === 'inbox'
        ? await commsAPI.inbox()
        : await commsAPI.sent();
      setMessages(view === 'inbox' ? data.data.messages : data.data);
    } catch { toast.error('Failed to load messages'); }
    finally { setLoading(false); }
  }, [view]);

  useEffect(() => { setSelected(null); load(); }, [load]);

  async function openMessage(msg) {
    setSelected(msg);
    if (view === 'inbox' && !msg.is_read) {
      commsAPI.markMessageRead(msg.id).catch(() => {});
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!form.receiver?.id || !form.subject || !form.body)
      return toast.error('Recipient, subject and message are required');
    setSending(true);
    try {
      await commsAPI.send({
        receiver_id: form.receiver.id,
        subject:     form.subject,
        body:        form.body,
      });
      toast.success(`Message sent to ${form.receiver.name}`);
      setCompose(false);
      setForm({ receiver: null, subject: '', body: '' });
      if (view === 'sent') load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message');
    } finally { setSending(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this message?')) return;
    try {
      await commsAPI.deleteMessage(id);
      toast.success('Deleted');
      setSelected(null);
      load();
    } catch { toast.error('Failed to delete'); }
  }

  const unreadCount = messages.filter(m => !m.is_read).length;

  return (
    <div>
      <PageHeader
        title="Messages"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        action={<Button variant="primary" onClick={() => setCompose(true)}>+ Compose</Button>}
      />

      <div className="flex gap-5">
        {/* Message list */}
        <div className="w-72 flex-shrink-0">
          <div className="flex gap-1 mb-3">
            {['inbox','sent'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`flex-1 py-1.5 text-xs rounded-lg capitalize transition-colors border
                  ${view === v
                    ? 'bg-white border-gray-200 font-medium text-gray-800'
                    : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                {v}
                {v === 'inbox' && unreadCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-blue-600 text-white rounded-full text-xs">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <Card>
            {loading
              ? <div className="flex justify-center py-10"><Spinner /></div>
              : messages.length === 0
                ? <p className="text-sm text-gray-400 text-center py-8">No {view} messages</p>
                : messages.map(msg => (
                    <button key={msg.id} onClick={() => openMessage(msg)}
                      className={`w-full text-left p-3 rounded-lg mb-1 transition-colors
                        ${selected?.id === msg.id ? 'bg-blue-50' : 'hover:bg-gray-50'}
                        ${!msg.is_read && view === 'inbox' ? 'border-l-2 border-blue-500 pl-2.5' : ''}`}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className={`text-sm truncate ${!msg.is_read && view === 'inbox' ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
                          {view === 'inbox' ? msg.sender_name : msg.receiver_name}
                        </p>
                        <span className="text-xs text-gray-300 flex-shrink-0">
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: false })}
                        </span>
                      </div>
                      <p className={`text-xs truncate ${!msg.is_read && view === 'inbox' ? 'text-gray-700' : 'text-gray-400'}`}>
                        {msg.subject}
                      </p>
                    </button>
                  ))
            }
          </Card>
        </div>

        {/* Message detail */}
        <div className="flex-1 min-w-0">
          {!selected ? (
            <div className="flex items-center justify-center h-64 text-gray-400">
              <div className="text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                </div>
                <p className="text-sm">Select a message to read</p>
              </div>
            </div>
          ) : (
            <Card>
              <div className="flex items-start justify-between mb-5 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-base font-medium text-gray-800 mb-1">{selected.subject}</h3>
                  <p className="text-xs text-gray-400">
                    {view === 'inbox' ? `From: ${selected.sender_name}` : `To: ${selected.receiver_name}`}
                    {' · '}
                    {formatDistanceToNow(new Date(selected.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => {
                    setCompose(true);
                    setForm({ receiver: { id: selected.sender_id, name: selected.sender_name, role: '' }, subject: `Re: ${selected.subject}`, body: '' });
                  }}>Reply</Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(selected.id)}>Delete</Button>
                </div>
              </div>
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {selected.body}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Compose modal */}
      {compose && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-base font-medium text-gray-800 mb-5">New message</h2>
            <form onSubmit={handleSend} className="flex flex-col gap-3">

              <UserSearch
                value={form.receiver}
                onChange={receiver => setForm(p => ({ ...p, receiver }))}
              />

              <Input
                label="Subject *"
                value={form.subject}
                onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                placeholder="Subject"
              />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Message *</label>
                <textarea rows={5} value={form.body}
                  onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                  placeholder="Write your message…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="flex justify-end gap-3 mt-2">
                <Button type="button" onClick={() => { setCompose(false); setForm({ receiver:null, subject:'', body:'' }); }}>Cancel</Button>
                <Button type="submit" variant="primary" loading={sending}>Send message</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}