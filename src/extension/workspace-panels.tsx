import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, CalendarDays, Check, CheckCheck, Clock3, ExternalLink, Link2, LoaderCircle, Mail, MessageCircle, Plus, RefreshCw, Sparkles, Square, Target, Trash2, Unplug, X } from 'lucide-react';
import type { AppState } from '../shared/types';
import { googleLink, type CalendarEvent, type ChatProposal, type GoogleService } from '../shared/workspace';
import { isExtension } from './bridge';
import { errorText } from './errors';
import cat from '../../public/brand/tabby/tabby-mark-task.svg';
import './workspace-panels.css';

type Command = (type: string, payload?: Record<string, unknown>) => Promise<any>;
interface Props { state: AppState; busy: boolean; command: Command; openSettings: () => void }
function Heading({ title, description, label }: { title: string; description: string; label: string }) {
  return <div className="page-heading"><div><div className="eyebrow"><span />{label}</div><h1>{title}</h1><p>{description}</p></div><span className="heading-spark" aria-hidden="true">✳</span></div>;
}
const localDate = (value: string) => new Date(value.length === 10 ? value + 'T12:00:00' : value);
const eventTime = (event: CalendarEvent) => event.allDay ? 'All day' : localDate(event.start).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
const dayKey = (value: string) => { const d = localDate(value); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const synced = (at?: number) => at ? `Updated ${new Date(at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}` : 'Not synced yet';

export function GooglePanel({ state, busy, command, openSettings, openTasks, openChat }: Props & { openTasks: () => void; openChat: () => void }) {
  const [tab, setTab] = useState<GoogleService>('calendar'); const [confirmDisconnect, setConfirmDisconnect] = useState(false); const [feedback, setFeedback] = useState('');
  const g = state.google; const connected = g.status[tab];
  useEffect(() => {
    if (!isExtension || !state.settings.pairToken) return;
    void command('GOOGLE_STATUS').then(async result => {
      if (result?.calendar) await command('GOOGLE_SYNC', { service: 'calendar' });
      if (result?.gmail) await command('GOOGLE_SYNC', { service: 'gmail' });
    });
  }, []);
  useEffect(() => {
    if (!g.status.pending) return;
    const pending = g.status.pending;
    const timer = setInterval(() => { void command('GOOGLE_STATUS').then(async result => { if (result && !result.pending && result[pending]) await command('GOOGLE_SYNC', { service: pending }); }); }, 8000);
    return () => clearInterval(timer);
  }, [g.status.pending]);
  useEffect(() => {
    if (!g.status.calendar) return;
    const timer = setInterval(() => { if (!busy) void command('GOOGLE_SYNC', { service: 'calendar' }); }, 300000);
    return () => clearInterval(timer);
  }, [g.status.calendar, busy]);
  const today = dayKey(new Date().toISOString());
  const next = g.events.find(e => !e.allDay && Date.parse(e.start) > Date.now());
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of g.events) { const key = dayKey(event.start); groups.set(key, [...(groups.get(key) || []), event]); }
  async function importTask(service: GoogleService, id: string) {
    const result = await command('GOOGLE_IMPORT', { service, id });
    if (result) setFeedback(result.existing ? 'This item is already in your tasks.' : 'Added to your tasks. Ready when you are.');
  }
  return <>
    <Heading label="YOUR CONNECTED DAY" title="Make room for what’s next." description="Your calendar and inbox, a little closer to your work." />
    <div className="connected-tabs" role="tablist" aria-label="Google apps">
      <button role="tab" aria-selected={tab === 'calendar'} onClick={() => setTab('calendar')}><CalendarDays size={17} />Calendar {g.status.calendar && <i />}</button>
      <button role="tab" aria-selected={tab === 'gmail'} onClick={() => setTab('gmail')}><Mail size={17} />Gmail {g.status.gmail && <i />}</button>
    </div>
    {feedback && <div className="alert success" role="status"><Check size={16} /><span>{feedback}</span><button className="text-button" onClick={openTasks}>View tasks</button><button className="icon-button" aria-label="Dismiss Google notice" onClick={() => setFeedback('')}><X size={15} /></button></div>}
    {!state.settings.pairToken ? <div className="card connection-intro"><Link2 size={28} /><h2>Connect your local companion.</h2><p>Save your Tabby connection token in Settings, then connect Google here.</p><button className="btn primary" onClick={openSettings}>Open settings</button></div> : <>
      {g.status.pending && <div className="card google-pending" role="status"><LoaderCircle size={21} className="spin" /><div><h3>Finish connecting in Google.</h3><p>Choose your account and grant {g.status.pending === 'calendar' ? 'calendar' : 'Gmail'} read access. This panel checks automatically.</p></div><button className="text-button" disabled={busy} onClick={() => command('GOOGLE_CANCEL')}>Cancel</button></div>}
      {g.status.error && <div className="alert error" role="alert">{errorText(g.status.error)}</div>}
      {!connected ? <section className="card connection-intro">
        <div className="google-app-icon">{tab === 'calendar' ? <CalendarDays size={32} /> : <Mail size={32} />}</div>
        <span className="kicker">{tab === 'calendar' ? 'GOOGLE CALENDAR' : 'GMAIL'}</span>
        <h2>{tab === 'calendar' ? 'A calmer view of your day.' : 'Turn follow-ups into next steps.'}</h2>
        <p>{tab === 'calendar' ? 'See the next two weeks from your primary calendar. Bring meeting preparation into your task list and plan focus around your schedule.' : 'Browse your latest 20 inbox messages. Save a task in one click, or ask AI to extract a draft from a message preview.'}</p>
        <div className="connection-points"><span><Check size={14} />Read-only access</span><span><Check size={14} />Disconnect anytime</span><span><Check size={14} />AI only when you ask</span></div>
        <button className="btn primary" disabled={busy || !!g.status.pending || !g.status.configured || !isExtension} onClick={() => command('GOOGLE_CONNECT', { service: tab })}><Link2 size={16} />Connect {tab === 'calendar' ? 'Google Calendar' : 'Gmail'}</button>
        {!g.status.configured && <details className="google-setup" open><summary>One-time Google setup</summary><p>This local build needs a Google OAuth client before sign-in is available.</p><ol><li>Create a <strong>Desktop app</strong> OAuth client in your Google Cloud project and add your Google account as a test user.</li><li>Enable the Calendar API and Gmail API, then download the client JSON.</li><li>In the project terminal, run <code>npm run setup:google -- /path/to/client.json</code> and restart the Tabby server.</li></ol><a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Open Google Cloud <ExternalLink size={12} /></a><button className="text-button" disabled={busy} onClick={() => command('GOOGLE_STATUS')}><RefreshCw size={13} />Check setup</button></details>}
      </section> : <>
        <div className="section-toolbar google-toolbar"><span><i className="connected-dot" />Connected · {synced(tab === 'calendar' ? g.calendarSyncedAt : g.gmailSyncedAt)}</span><button className="btn secondary" disabled={busy} onClick={() => command('GOOGLE_SYNC', { service: tab })}><RefreshCw size={14} className={busy ? 'spin' : ''} />Refresh</button></div>
        {g.errors[tab] && <div className="alert error" role="alert">{errorText(g.errors[tab]!)} Showing the last saved view.</div>}
        {tab === 'calendar' ? <>
          <div className="calendar-overview"><div><span className="kicker">ON YOUR CALENDAR</span><strong>{g.events.filter(e => dayKey(e.start) === today).length}<span> events today</span></strong><p>Times in {Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll('_', ' ')}</p></div><button className="btn secondary" onClick={openChat}><Sparkles size={15} />Plan with AI</button></div>
          {next && <div className="next-meeting"><Clock3 size={19} /><div><span className="kicker">NEXT UP · {eventTime(next)}</span><h3>{next.title}</h3><p>{localDate(next.start).toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}{next.location ? ` · ${next.location}` : ''}</p></div></div>}
          {g.calendarTruncated && <p className="muted">Showing the first 250 events in the next 14 days.</p>}
          {!g.events.length && <div className="empty-state"><div><CalendarDays size={32} /></div><h2>{g.calendarSyncedAt ? 'A little breathing room.' : 'Your calendar is connected.'}</h2><p>{g.calendarSyncedAt ? 'No upcoming events in your primary calendar over the next two weeks.' : 'Refresh to bring your upcoming events here.'}</p></div>}
          <div className="agenda">{[...groups].map(([key, events]) => <section className="agenda-day" key={key}><h2>{key === today ? 'Today' : localDate(events[0].start).toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}<span>{events.length}</span></h2>{events.map(item => <article className="card agenda-event" key={item.id}><div className="agenda-time">{eventTime(item)}{!item.allDay && item.end && <small>{localDate(item.end).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</small>}</div><div className="agenda-detail"><h3>{item.title}</h3>{item.location && <p>{item.location}</p>}<div className="button-row"><button className="text-button" disabled={busy || state.tasks.some(t => t.external?.service === 'calendar' && t.external.id === item.id)} onClick={() => importTask('calendar', item.id)}><Plus size={13} />{state.tasks.some(t => t.external?.service === 'calendar' && t.external.id === item.id) ? 'In tasks' : 'Add task'}</button>{googleLink(item.url, 'calendar') && <a className="text-button" href={googleLink(item.url, 'calendar')} target="_blank" rel="noreferrer"><ExternalLink size={12} />Open event</a>}</div></div></article>)}</section>)}</div>
        </> : <>
          <p className="inbox-disclosure">Showing subject, sender and a short preview. “AI draft” sends that message’s subject and preview to your selected model.</p>
          {!g.messages.length && <div className="empty-state"><div><Mail size={32} /></div><h2>{g.gmailSyncedAt ? 'An open inbox, a clear mind.' : 'Gmail is connected.'}</h2><p>{g.gmailSyncedAt ? 'There are no messages in your inbox.' : 'Refresh to load your latest inbox messages.'}</p></div>}
          <div className="mail-list">{g.messages.map(item => <article className="card mail-item" key={item.id}><div className="mail-meta"><span>{item.from || 'Sender unavailable'}</span><time>{item.receivedAt ? new Date(item.receivedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : ''}</time></div><h3>{item.title}</h3><p>{item.snippet}</p><div className="button-row"><button className="text-button" disabled={busy || state.tasks.some(t => t.external?.service === 'gmail' && t.external.id === item.id)} onClick={() => importTask('gmail', item.id)}><Plus size={13} />{state.tasks.some(t => t.external?.service === 'gmail' && t.external.id === item.id) ? 'In tasks' : 'Add task'}</button><button className="text-button" disabled={busy || !state.settings.consent} onClick={async () => { if (await command('GOOGLE_DRAFT', { id: item.id })) await command('AI', { kind: 'task' }); }}><Sparkles size={13} />AI draft</button>{googleLink(item.url, 'gmail') && <a className="text-button" href={googleLink(item.url, 'gmail')} target="_blank" rel="noreferrer"><ExternalLink size={12} />Open email</a>}</div></article>)}</div>
        </>}
      </>}
      {(g.status.calendar || g.status.gmail) && <div className="google-disconnect"><span><Link2 size={13} />Google access stays on this computer.</span>{confirmDisconnect ? <div><p>Disconnect Calendar and Gmail, clear their cached views and chat, and revoke Google access? Tasks you saved will stay.</p><div className="button-row"><button className="btn danger" disabled={busy} onClick={async () => { const result = await command('GOOGLE_DISCONNECT'); if (result) { setConfirmDisconnect(false); setFeedback(result.revoked ? 'Google disconnected.' : 'Local access removed. Google revocation could not finish; remove Tabby access in your Google account.'); } }}>Disconnect Google</button><button className="btn secondary" onClick={() => setConfirmDisconnect(false)}>Keep connected</button></div></div> : <button className="text-button danger-text" onClick={() => setConfirmDisconnect(true)}><Unplug size={13} />Disconnect Google</button>}</div>}
    </>}
  </>;
}

function ProposalCard({ proposal, state, busy, command }: { proposal: ChatProposal; state: AppState; busy: boolean; command: Command }) {
  const a = proposal.action; const task = 'taskId' in a ? state.tasks.find(t => t.id === a.taskId) : undefined;
  const label = a.type === 'create_task' ? 'CREATE TASK' : a.type === 'complete_task' ? 'COMPLETE TASK' : 'START FOCUS';
  return <div className={`chat-proposal ${proposal.state}`}><div className="kicker">{a.type === 'start_focus' ? <Target size={14} /> : <CheckCheck size={14} />}{label}</div><h3>{a.type === 'create_task' ? a.title : a.type === 'start_focus' ? a.goal : task?.title || 'Task no longer available'}</h3>{a.type === 'create_task' && a.steps.length > 0 && <ol>{a.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>}{a.type === 'create_task' && a.due && <p><CalendarDays size={12} /> Due {a.due}</p>}{a.type === 'start_focus' && <p>{a.minutes} minutes · {task?.title || 'New focus session'}</p>}{proposal.state === 'pending' ? <div className="button-row"><button className="btn primary" disabled={busy} onClick={() => command('CHAT_APPLY', { proposalId: proposal.id })}><Check size={14} />{a.type === 'create_task' ? 'Create task' : a.type === 'complete_task' ? 'Mark complete' : 'Start focus'}</button><button className="text-button" disabled={busy} onClick={() => command('CHAT_DISMISS', { proposalId: proposal.id })}>Dismiss</button></div> : <span className="proposal-status">{proposal.state === 'applied' ? <><Check size={13} />Applied</> : 'Dismissed'}</span>}</div>;
}
export function ChatPanel({ state, busy, command, enableAI }: Props & { enableAI: () => Promise<void> }) {
  const [text, setText] = useState(''); const [includeCalendar, setIncludeCalendar] = useState(false); const [confirmClear, setConfirmClear] = useState(false);
  const bottom = useRef<HTMLDivElement>(null); const input = useRef<HTMLTextAreaElement>(null);
  const pending = !!state.chat.pendingId;
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [state.chat.messages.length, pending]);
  async function submit(e?: FormEvent) {
    e?.preventDefault(); if (!text.trim() || pending || busy) return;
    const result = await command('CHAT_SEND', { text, includeCalendar }); if (result) setText('');
  }
  return <>
    <Heading label="YOUR AI COMPANION" title="Think it through with Tabby." description="A little structure for everything on your mind." />
    <div className="chat-topline"><span><i className="connected-dot" />{state.ai.model || 'DeepSeek 3.2'}<span className="chat-divider">·</span>Tasks + your goal</span>{state.chat.messages.length > 0 && (confirmClear ? <div className="button-row"><button className="text-button danger-text" onClick={async () => { await command('CHAT_CLEAR'); setConfirmClear(false); }}>Clear conversation</button><button className="text-button" onClick={() => setConfirmClear(false)}>Cancel</button></div> : <button className="icon-button" aria-label="Clear chat" onClick={() => setConfirmClear(true)}><Trash2 size={15} /></button>)}</div>
    {!state.settings.consent && <div className="card chat-consent"><Sparkles size={20} /><div><h3>Make space for a little help.</h3><p>AI is included. Your messages, task titles and current goal go through Tabby Cloud to GPT Tunnel (DeepSeek). Calendar context is optional.</p><button className="btn primary" disabled={busy} onClick={enableAI}>Enable AI</button></div></div>}
    <div className="chat-conversation" role="log" aria-label="Conversation" aria-live="polite">
      {!state.chat.messages.length && <div className="chat-welcome"><img src={cat} alt="" width="78" height="78" /><h2>A busy mind deserves a little company.</h2><p>Bring an idea, a messy list, or one thing you’re putting off. We’ll find a place to start.</p><div className="chat-starters">{[{ icon: CalendarDays, label: 'Make a plan for today', text: 'Help me plan today around my tasks and any calendar events I shared. Suggest a realistic order and one first step.' }, { icon: CheckCheck, label: 'Break a task into steps', text: 'Help me break my most important task into small, concrete steps. Ask me which task if it is not clear.' }, { icon: Target, label: 'Find my next focus', text: 'Based on my tasks, suggest one useful 25-minute focus session and explain why.' }].map(item => <button key={item.label} onClick={() => { setText(item.text); input.current?.focus(); }}><item.icon size={17} /><span>{item.label}</span><Plus size={13} /></button>)}</div></div>}
      {state.chat.messages.map(message => <article className={`chat-message ${message.role}`} key={message.id}><div className="chat-message-label">{message.role === 'assistant' ? <><img src={cat} alt="" width="20" height="20" />Tabby</> : <><MessageCircle size={14} />You</>}<time>{new Date(message.at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</time></div><div className="chat-bubble">{message.content}</div>{message.error && <div className="chat-message-error"><p>{errorText(message.error)}</p><button className="text-button" disabled={pending} onClick={() => { setText(message.content); input.current?.focus(); }}>Try again</button></div>}{message.proposals?.map(proposal => <ProposalCard key={proposal.id} proposal={proposal} state={state} busy={busy || pending} command={command} />)}</article>)}
      {pending && <div className="chat-thinking" role="status"><span /><span /><span /><p>Finding a useful next step…</p></div>}
      <div ref={bottom} />
    </div>
    <form className="chat-composer" onSubmit={submit}><label className="calendar-context"><input type="checkbox" checked={includeCalendar} disabled={!state.google.status.calendar || pending} onChange={e => setIncludeCalendar(e.target.checked)} /><CalendarDays size={14} />Include calendar<span>{state.google.status.calendar ? 'Optional' : 'Connect Google first'}</span></label><div className="chat-input-wrap"><textarea ref={input} aria-label="Message Tabby" placeholder="What’s on your mind?" rows={3} maxLength={3000} value={text} disabled={pending} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } }} />{pending ? <button className="chat-send stop" type="button" aria-label="Stop response" onClick={() => command('CHAT_CANCEL')}><Square size={16} /></button> : <button className="chat-send" type="submit" aria-label="Send message" disabled={busy || !text.trim() || !state.settings.consent || !isExtension}><ArrowUp size={21} /></button>}</div><p>Changes appear as cards for you to confirm. Enter to send · Shift+Enter for a new line.</p></form>
  </>;
}
