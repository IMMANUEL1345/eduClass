import React, { useEffect, useState, useCallback, useRef } from 'react';
import { virtualClassroomAPI, classAPI } from '../../api';
import { PageHeader, Card, Button, Input, Select, Badge, Spinner } from '../../components/ui';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';

const STATUS_COLOR = { scheduled:'blue', live:'green', ended:'gray' };
const MATERIAL_ICONS = { link:'🔗', note:'📝', youtube:'▶️', file:'📄' };

export default function VirtualClassroom() {
  const user     = useSelector(selectUser);
  const canHost  = !['student','parent'].includes(user?.role);

  const [sessions,  setSessions]  = useState([]);
  const [classes,   setClasses]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [active,    setActive]    = useState(null); // currently open session detail
  const [inCall,    setInCall]    = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [showJoin,  setShowJoin]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [joinCode,  setJoinCode]  = useState('');

  // Chat state
  const [chatMsg,   setChatMsg]   = useState('');
  const [messages,  setMessages]  = useState([]);
  const [question,  setQuestion]  = useState('');
  const [tab,       setTab]       = useState('chat'); // chat | qa | materials
  const chatEndRef  = useRef(null);
  const pollRef     = useRef(null);
  const lastMsgRef  = useRef(null);

  // Material form
  const [matForm, setMatForm] = useState({ title:'', type:'link', content:'' });
  const [showMat, setShowMat] = useState(false);

  const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear()+1}`;
  const [form, setForm] = useState({
    title:'', description:'', class_id:'', subject:'', scheduled_at:'',
  });

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await virtualClassroomAPI.list({});
      setSessions(data.data);
    } catch { toast.error('Failed to load sessions'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadSessions();
    if (canHost) classAPI.list({}).then(({ data }) => setClasses(data.data)).catch(() => {});
  }, []);

  // Poll messages when in a session
  useEffect(() => {
    if (!active) { clearInterval(pollRef.current); return; }
    async function poll() {
      try {
        const since = lastMsgRef.current;
        const { data } = await virtualClassroomAPI.getMessages(active.id, since);
        if (data.data?.length) {
          setMessages(prev => {
            const ids = new Set(prev.map(m => m.id));
            const newMsgs = data.data.filter(m => !ids.has(m.id));
            const updated = [...prev, ...newMsgs];
            if (newMsgs.length) {
              lastMsgRef.current = newMsgs[newMsgs.length-1].created_at;
            }
            return updated;
          });
        }
      } catch {}
    }
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => clearInterval(pollRef.current);
  }, [active]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [messages]);

  async function openSession(session) {
    try {
      const { data } = await virtualClassroomAPI.getOne(session.id);
      setActive(data.data);
      setMessages(data.data.messages || []);
      lastMsgRef.current = data.data.messages?.at(-1)?.created_at || null;
      setInCall(false);
      setTab('chat');
    } catch { toast.error('Failed to load session'); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.title) return toast.error('Title required');
    setSaving(true);
    try {
      await virtualClassroomAPI.create(form);
      toast.success('Session created');
      setShowForm(false);
      setForm({ title:'', description:'', class_id:'', subject:'', scheduled_at:'' });
      loadSessions();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  }

  async function handleStart() {
    try {
      await virtualClassroomAPI.startSession(active.id);
      toast.success('Session is now live!');
      setActive(p => ({ ...p, status:'live' }));
      setSessions(prev => prev.map(s => s.id===active.id ? {...s, status:'live'} : s));
      setInCall(true);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  }

  async function handleEnd() {
    if (!window.confirm('End this session?')) return;
    try {
      await virtualClassroomAPI.endSession(active.id);
      toast.success('Session ended');
      setActive(p => ({ ...p, status:'ended' }));
      setSessions(prev => prev.map(s => s.id===active.id ? {...s, status:'ended'} : s));
      setInCall(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!chatMsg.trim()) return;
    try {
      const { data } = await virtualClassroomAPI.sendMessage(active.id, chatMsg.trim());
      setMessages(prev => [...prev, data.data]);
      setChatMsg('');
    } catch { toast.error('Failed to send'); }
  }

  async function handleAskQuestion(e) {
    e.preventDefault();
    if (!question.trim()) return;
    try {
      await virtualClassroomAPI.askQuestion(active.id, question.trim());
      toast.success('Question submitted');
      setQuestion('');
      const { data } = await virtualClassroomAPI.getOne(active.id);
      setActive(p => ({ ...p, qa: data.data.qa }));
    } catch { toast.error('Failed'); }
  }

  async function handleAnswer(qaId, answer) {
    if (!answer?.trim()) return;
    try {
      await virtualClassroomAPI.answerQuestion(active.id, qaId, answer);
      toast.success('Answered');
      const { data } = await virtualClassroomAPI.getOne(active.id);
      setActive(p => ({ ...p, qa: data.data.qa }));
    } catch { toast.error('Failed'); }
  }

  async function handleUpvote(qaId) {
    try {
      await virtualClassroomAPI.upvoteQuestion(active.id, qaId);
      setActive(p => ({ ...p, qa: p.qa.map(q => q.id===qaId ? {...q, upvotes:q.upvotes+1} : q) }));
    } catch {}
  }

  async function handleAddMaterial(e) {
    e.preventDefault();
    if (!matForm.title || !matForm.content) return toast.error('Title and content required');
    try {
      await virtualClassroomAPI.addMaterial(active.id, matForm);
      toast.success('Material added');
      setShowMat(false);
      setMatForm({ title:'', type:'link', content:'' });
      const { data } = await virtualClassroomAPI.getOne(active.id);
      setActive(p => ({ ...p, materials: data.data.materials }));
    } catch { toast.error('Failed'); }
  }

  async function handleJoinByCode(e) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    try {
      const { data } = await virtualClassroomAPI.joinByCode(joinCode.trim());
      setShowJoin(false);
      setJoinCode('');
      openSession(data.data);
    } catch (err) { toast.error(err.response?.data?.message || 'Invalid room code'); }
  }

  const live      = sessions.filter(s => s.status==='live');
  const scheduled = sessions.filter(s => s.status==='scheduled');
  const ended     = sessions.filter(s => s.status==='ended');

  return (
    <div className="flex gap-5 h-full">
      {/* Left — session list */}
      <div className={`flex flex-col ${active ? 'w-80 flex-shrink-0' : 'flex-1'}`}>
        <PageHeader title="Virtual Classroom"
          subtitle="Live and scheduled online classes"
          action={
            <div className="flex gap-2">
              <Button onClick={() => setShowJoin(true)}>🔗 Join by code</Button>
              {canHost && <Button variant="primary" onClick={() => setShowForm(true)}>+ New session</Button>}
            </div>
          }
        />

        {loading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : (
          <div className="flex flex-col gap-4 overflow-y-auto">
            {/* Live sessions */}
            {live.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block" />
                  Live now
                </p>
                {live.map(s => <SessionCard key={s.id} session={s} onClick={() => openSession(s)} active={active?.id===s.id} />)}
              </div>
            )}
            {/* Scheduled */}
            {scheduled.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Upcoming</p>
                {scheduled.map(s => <SessionCard key={s.id} session={s} onClick={() => openSession(s)} active={active?.id===s.id} />)}
              </div>
            )}
            {/* Ended */}
            {ended.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Past sessions</p>
                {ended.map(s => <SessionCard key={s.id} session={s} onClick={() => openSession(s)} active={active?.id===s.id} />)}
              </div>
            )}
            {sessions.length === 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center">
                <p className="text-4xl mb-3">🎓</p>
                <p className="text-gray-600 text-sm font-medium mb-1">No sessions yet</p>
                {canHost && <p className="text-gray-400 text-xs">Create a session to get started</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right — session detail + call */}
      {active && (
        <div className="flex-1 flex flex-col min-w-0 bg-white border border-gray-100 rounded-2xl overflow-hidden">
          {/* Session header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Badge color={STATUS_COLOR[active.status]}>{active.status}</Badge>
                {active.subject && <span className="text-xs text-gray-400">{active.subject}</span>}
                {active.class_name && <span className="text-xs text-blue-500">{active.class_name} {active.section}</span>}
              </div>
              <h2 className="text-base font-semibold text-gray-800">{active.title}</h2>
              <p className="text-xs text-gray-400">Host: {active.host_name}</p>
            </div>
            <div className="flex gap-2 items-center">
              {active.status==='live' && !inCall && (
                <Button variant="primary" onClick={() => setInCall(true)}>📹 Join call</Button>
              )}
              {active.status==='live' && inCall && (
                <Button onClick={() => setInCall(false)}>⬇ Hide call</Button>
              )}
              {canHost && active.host_id===user?.id && active.status==='scheduled' && (
                <Button variant="primary" onClick={handleStart}>▶ Start session</Button>
              )}
              {canHost && active.host_id===user?.id && active.status==='live' && (
                <Button onClick={handleEnd}>⏹ End session</Button>
              )}
              <button onClick={() => { setActive(null); setInCall(false); }}
                className="text-gray-400 hover:text-gray-600 p-1">✕</button>
            </div>
          </div>

          {/* Jitsi video call */}
          {inCall && (
            <div className="border-b border-gray-100">
              <iframe
                src={`https://meet.jit.si/${active.room_code}#userInfo.displayName="${encodeURIComponent(user?.name || 'User')}"&config.startWithAudioMuted=false&config.startWithVideoMuted=false&interfaceConfig.TOOLBAR_BUTTONS=["microphone","camera","desktop","fullscreen","folio","chat","recording","livestreaming","etherpad","sharedvideo","settings","raisehand","videoquality","filmstrip","feedback","stats","shortcuts","tileview","select-background","download","help","mute-everyone","security"]`}
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                className="w-full"
                style={{ height: '420px', border: 'none' }}
                title="Virtual Classroom"
              />
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-gray-100 px-4">
            {[
              { key:'chat',      label:`💬 Chat (${messages.length})` },
              { key:'qa',        label:`❓ Q&A (${active.qa?.length || 0})` },
              { key:'materials', label:`📚 Materials (${active.materials?.length || 0})` },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2.5 text-xs font-medium transition-colors
                  ${tab===t.key
                    ? 'border-b-2 border-blue-600 text-blue-700 -mb-px'
                    : 'text-gray-400 hover:text-gray-600'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Chat */}
            {tab==='chat' && (
              <>
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                  {messages.length===0
                    ? <p className="text-xs text-gray-300 text-center py-8">No messages yet. Say hello!</p>
                    : messages.map(m => (
                        <div key={m.id} className={`flex gap-2 ${m.user_name===user?.name ? 'flex-row-reverse' : ''}`}>
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {m.user_name?.charAt(0)}
                          </div>
                          <div className={`max-w-xs ${m.user_name===user?.name ? 'items-end' : 'items-start'} flex flex-col`}>
                            <p className="text-xs text-gray-400 mb-0.5">{m.user_name} · {m.user_role}</p>
                            <div className={`px-3 py-2 rounded-xl text-sm ${
                              m.user_name===user?.name
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700'}`}>
                              {m.message}
                            </div>
                          </div>
                        </div>
                      ))
                  }
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-100 flex gap-2">
                  <input value={chatMsg} onChange={e => setChatMsg(e.target.value)}
                    placeholder="Type a message…"
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl
                               focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <Button type="submit" variant="primary" disabled={!chatMsg.trim()}>Send</Button>
                </form>
              </>
            )}

            {/* Q&A */}
            {tab==='qa' && (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {/* Ask question */}
                <form onSubmit={handleAskQuestion} className="flex gap-2">
                  <input value={question} onChange={e => setQuestion(e.target.value)}
                    placeholder="Ask a question…"
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl
                               focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <Button type="submit" disabled={!question.trim()}>Ask</Button>
                </form>
                {(active.qa||[]).length===0
                  ? <p className="text-xs text-gray-300 text-center py-8">No questions yet</p>
                  : (active.qa||[]).map(q => (
                      <QACard key={q.id} q={q} canAnswer={canHost}
                        onAnswer={(ans) => handleAnswer(q.id, ans)}
                        onUpvote={() => handleUpvote(q.id)} />
                    ))
                }
              </div>
            )}

            {/* Materials */}
            {tab==='materials' && (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {canHost && (
                  <Button onClick={() => setShowMat(true)} className="w-full">+ Add material</Button>
                )}
                {(active.materials||[]).length===0
                  ? <p className="text-xs text-gray-300 text-center py-8">No materials shared yet</p>
                  : (active.materials||[]).map(m => (
                      <div key={m.id}
                        className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-start gap-3">
                        <span className="text-xl mt-0.5">{MATERIAL_ICONS[m.type]||'📎'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700">{m.title}</p>
                          {(m.type==='link'||m.type==='youtube') ? (
                            <a href={m.content} target="_blank" rel="noreferrer"
                              className="text-xs text-blue-500 hover:underline truncate block">
                              {m.content}
                            </a>
                          ) : (
                            <p className="text-xs text-gray-500 mt-1">{m.content}</p>
                          )}
                          <p className="text-xs text-gray-300 mt-1">by {m.added_by_name}</p>
                        </div>
                        {canHost && (
                          <button onClick={async () => {
                            await virtualClassroomAPI.removeMaterial(active.id, m.id);
                            setActive(p => ({ ...p, materials: p.materials.filter(x => x.id!==m.id) }));
                          }} className="text-red-400 text-xs hover:text-red-600">✕</button>
                        )}
                      </div>
                    ))
                }
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create session modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-base font-medium text-gray-800 mb-5">Create virtual session</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <Input label="Session title *" value={form.title}
                onChange={e => setForm(p=>({...p,title:e.target.value}))}
                placeholder="e.g. Mathematics Chapter 5" />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Class" value={form.class_id}
                  onChange={e => setForm(p=>({...p,class_id:e.target.value}))}>
                  <option value="">All / Open session</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                </Select>
                <Input label="Subject" value={form.subject}
                  onChange={e => setForm(p=>({...p,subject:e.target.value}))}
                  placeholder="e.g. Mathematics" />
              </div>
              <Input label="Scheduled time (optional)" type="datetime-local"
                value={form.scheduled_at}
                onChange={e => setForm(p=>({...p,scheduled_at:e.target.value}))} />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Description</label>
                <textarea rows={3} value={form.description}
                  onChange={e => setForm(p=>({...p,description:e.target.value}))}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="What will you cover?" />
              </div>
              <div className="flex justify-end gap-3 mt-2">
                <Button type="button" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" variant="primary" loading={saving}>Create session</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join by code modal */}
      {showJoin && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-base font-medium text-gray-800 mb-2">Join by room code</h2>
            <p className="text-xs text-gray-400 mb-4">Enter the room code shared by your teacher</p>
            <form onSubmit={handleJoinByCode} className="flex flex-col gap-3">
              <Input label="Room code" value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                placeholder="educlass-xxxxxxxx" autoFocus />
              <div className="flex justify-end gap-3">
                <Button type="button" onClick={() => setShowJoin(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Join</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add material modal */}
      {showMat && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-base font-medium text-gray-800 mb-4">Share material</h2>
            <form onSubmit={handleAddMaterial} className="flex flex-col gap-3">
              <Input label="Title *" value={matForm.title}
                onChange={e => setMatForm(p=>({...p,title:e.target.value}))} />
              <Select label="Type" value={matForm.type}
                onChange={e => setMatForm(p=>({...p,type:e.target.value}))}>
                <option value="link">🔗 Website link</option>
                <option value="youtube">▶️ YouTube video</option>
                <option value="note">📝 Text note</option>
              </Select>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">
                  {matForm.type==='note' ? 'Note content' : 'URL / Link'}
                </label>
                {matForm.type==='note'
                  ? <textarea rows={4} value={matForm.content}
                      onChange={e => setMatForm(p=>({...p,content:e.target.value}))}
                      className="px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none
                                 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  : <Input value={matForm.content}
                      onChange={e => setMatForm(p=>({...p,content:e.target.value}))}
                      placeholder="https://…" />
                }
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" onClick={() => setShowMat(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Share</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SessionCard({ session, onClick, active }) {
  const isLive = session.status === 'live';
  return (
    <div onClick={onClick}
      className={`bg-white border rounded-2xl p-4 cursor-pointer transition-all hover:shadow-sm mb-2
        ${active ? 'border-blue-300 shadow-sm' : isLive ? 'border-green-200' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge color={isLive ? 'green' : session.status==='scheduled' ? 'blue' : 'gray'}>
              {isLive ? '● Live' : session.status}
            </Badge>
            {session.class_name && (
              <span className="text-xs text-blue-500">{session.class_name} {session.section}</span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-800 truncate">{session.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{session.host_name}
            {session.scheduled_at && ` · ${format(new Date(session.scheduled_at),'dd MMM, HH:mm')}`}
          </p>
        </div>
        <div className="text-right flex-shrink-0 text-xs text-gray-400">
          <div>💬 {session.message_count}</div>
          <div>📚 {session.material_count}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 text-xs text-gray-300">
        <span>🔑 {session.room_code}</span>
      </div>
    </div>
  );
}

function QACard({ q, canAnswer, onAnswer, onUpvote }) {
  const [ans, setAns] = useState('');
  const [showAns, setShowAns] = useState(false);
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-gray-700">{q.question}</p>
        <button onClick={onUpvote}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 flex-shrink-0">
          👍 {q.upvotes}
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-2">Asked by {q.asked_by_name}</p>
      {q.answer ? (
        <div className="bg-green-50 border border-green-100 rounded-lg p-2">
          <p className="text-xs font-medium text-green-600 mb-0.5">✓ Answered by {q.answered_by_name}</p>
          <p className="text-xs text-green-700">{q.answer}</p>
        </div>
      ) : canAnswer ? (
        showAns ? (
          <div className="flex gap-2 mt-2">
            <input value={ans} onChange={e => setAns(e.target.value)}
              placeholder="Type your answer…"
              className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <button onClick={() => { onAnswer(ans); setShowAns(false); setAns(''); }}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg">Answer</button>
          </div>
        ) : (
          <button onClick={() => setShowAns(true)}
            className="text-xs text-blue-600 hover:underline mt-1">Answer this</button>
        )
      ) : (
        <p className="text-xs text-amber-500 mt-1">Awaiting answer…</p>
      )}
    </div>
  );
}