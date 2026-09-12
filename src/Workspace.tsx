import { useEffect, useState } from 'react';
import {
  ArrowDown, ArrowUpRight, BarChart3, Check, ChevronDown, CircleHelp,
  Command, ExternalLink, FolderOpen, LayoutDashboard, ListTodo, MoreHorizontal,
  Pause, Play, Plus, RotateCcw, Search, Settings2, ShieldCheck, Sparkles,
  Timer, X,
} from 'lucide-react';
import { Cat, ToolIcon } from './components';

type Task = { id: string; text: string; source: string; done: boolean; label: string };
type View = 'overview' | 'tasks' | 'tabs' | 'insights';

const initialTasks: Task[] = [
  { id: '1', text: 'Make something worth sharing', source: 'notion', done: false, label: 'Creative work' },
  { id: '2', text: 'Review the new homepage', source: 'linear', done: false, label: 'Website' },
  { id: '3', text: 'Send a little project update', source: 'gmail', done: false, label: 'Personal' },
  { id: '4', text: 'Plan a day with room to breathe', source: 'calendar', done: true, label: 'Personal' },
];

function readTasks(): Task[] {
  try {
    const data = JSON.parse(localStorage.getItem('tabby-tasks') || 'null');
    if (Array.isArray(data) && data.every(t => typeof t.id === 'string' && typeof t.text === 'string' && typeof t.done === 'boolean' && typeof t.source === 'string' && typeof t.label === 'string')) return data;
  } catch { /* The preview also works when storage is unavailable. */ }
  return initialTasks;
}

export function useWorkspace() {
  const [tasks, setTasks] = useState<Task[]>(readTasks);
  const [duration, setDuration] = useState(25);
  const [seconds, setSeconds] = useState(25 * 60);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [focusedSeconds, setFocusedSeconds] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('tabby-tasks', JSON.stringify(tasks)); } catch { /* Keep in-memory tasks. */ }
  }, [tasks]);

  useEffect(() => {
    if (!deadline) return;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0) {
        setDeadline(null);
        setFocusedSeconds(value => value + duration * 60);
        setSessionComplete(true);
      }
    };
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [deadline, duration]);

  function toggleTimer() {
    setSessionComplete(false);
    if (deadline) {
      setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
      setDeadline(null);
    } else {
      const remaining = seconds || duration * 60;
      setSeconds(remaining);
      setDeadline(Date.now() + remaining * 1000);
    }
  }

  function changeDuration(value: number) {
    setDeadline(null);
    setDuration(value);
    setSeconds(value * 60);
    setSessionComplete(false);
  }

  function resetTimer() { changeDuration(duration); }
  function toggleTask(id: string) { setTasks(current => current.map(t => t.id === id ? { ...t, done: !t.done } : t)); }
  function addTask(text: string) {
    if (text.trim()) setTasks(current => [...current, { id: crypto.randomUUID(), text: text.trim(), source: 'tabby', done: false, label: 'Personal' }]);
  }
  function removeTask(id: string) { setTasks(current => current.filter(t => t.id !== id)); }

  return { tasks, toggleTask, addTask, removeTask, duration, seconds, running: deadline !== null, toggleTimer, changeDuration, resetTimer, focusedSeconds, sessionComplete };
}

export type WorkspaceState = ReturnType<typeof useWorkspace>;

const tabGroups = [
  { name: 'Creative work', color: 'purple', icon: 'figma', tabs: [
    { name: 'A little inspiration', url: 'https://www.are.na/' },
    { name: 'The design file', url: 'https://www.figma.com/' },
    { name: 'Fonts with personality', url: 'https://fonts.google.com/' },
  ] },
  { name: 'Website', color: 'orange', icon: 'linear', tabs: [
    { name: 'Project roadmap', url: 'https://linear.app/' },
    { name: 'The latest build', url: 'https://github.com/' },
  ] },
  { name: 'Read later', color: 'green', icon: 'notion', tabs: [
    { name: 'A space for good ideas', url: 'https://www.notion.so/' },
    { name: 'Something new to learn', url: 'https://www.wikipedia.org/' },
  ] },
];

export function Workspace({ state, expanded = false }: { state: WorkspaceState; expanded?: boolean }) {
  const [view, setView] = useState<View>('overview');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [showTimerOptions, setShowTimerOptions] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [tabGroupOpen, setTabGroupOpen] = useState('Creative work');
  const [helpOpen, setHelpOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all');
  const completed = state.tasks.filter(t => t.done).length;
  const displayedTasks = state.tasks.filter(t => t.text.toLowerCase().includes(query.toLowerCase()) && (!activeGroup || t.label === activeGroup) && (filter === 'all' || (filter === 'done' ? t.done : !t.done)));
  const minutes = String(Math.floor(state.seconds / 60)).padStart(2, '0');
  const seconds = String(state.seconds % 60).padStart(2, '0');
  const progress = state.tasks.length ? completed / state.tasks.length : 0;

  const changeView = (next: View) => { setView(next); setActiveGroup(null); setQuery(''); setFilter('all'); };

  return (
    <div className={`workspace ${expanded ? 'workspace-expanded' : ''}`}>
      <div className="browser-bar" aria-hidden="true">
        <div className="window-dots"><i /><i /><i /></div>
        <div className="browser-tab"><Cat size={14} /> Your happy place <X size={11} /></div>
        <Plus size={14} className="browser-plus" />
        <div className="browser-address"><ShieldCheck size={11} /> made for your peace of mind</div>
        <MoreHorizontal size={17} />
      </div>
      <div className="workspace-inner">
        <aside className="workspace-sidebar">
          <a className="workspace-brand" href="#" onClick={e => { e.preventDefault(); changeView('overview'); }} aria-label="Tabby workspace home"><Cat size={29} /> tabby<span>✳</span></a>
          <div className="workspace-person"><div className="person-avatar">A<span /></div><span>Your workspace<small>A little room to think</small></span><ChevronDown size={13} /></div>
          <nav className="workspace-nav" aria-label="Preview navigation">
            <button className={view === 'overview' ? 'active' : ''} onClick={() => changeView('overview')}><LayoutDashboard size={16} /> Overview</button>
            <button className={view === 'tasks' ? 'active' : ''} onClick={() => changeView('tasks')}><ListTodo size={16} /> My tasks <span>{state.tasks.filter(t => !t.done).length}</span></button>
            <button className={view === 'tabs' ? 'active' : ''} onClick={() => changeView('tabs')}><FolderOpen size={16} /> Tab spaces <span>3</span></button>
            <button className={view === 'insights' ? 'active' : ''} onClick={() => changeView('insights')}><BarChart3 size={16} /> My rhythm</button>
          </nav>
          <div className="sidebar-label">YOUR SPACES <span>↘</span></div>
          <div className="sidebar-spaces">{['Creative work', 'Website', 'Personal'].map((name, index) => <button className={activeGroup === name ? 'selected' : ''} key={name} onClick={() => { setView('tasks'); setActiveGroup(name); setFilter('all'); setQuery(''); }}><i className={`space-dot dot-${index}`} />{name}</button>)}</div>
          <div className="sidebar-bottom"><Cat size={40} sleepy /><p>Big ideas need<br />a little headspace.</p><span>Make yourself at home.</span></div>
          <button className="workspace-help" onClick={() => setHelpOpen(!helpOpen)} aria-expanded={helpOpen}><CircleHelp size={15} /> A little help <ArrowUpRight size={13} /></button>
        </aside>

        <div className="workspace-main">
          <div className="workspace-toolbar"><span>{view === 'overview' ? 'Your day, a little lighter' : view === 'tasks' ? activeGroup || 'Your next good thing' : view === 'tabs' ? 'A place for every idea' : 'Find your own rhythm'} <span className="toolbar-slash">/</span> <span className="toolbar-current">{view === 'overview' ? 'Overview' : view === 'tasks' ? 'Tasks' : view === 'tabs' ? 'Tab spaces' : 'Insights'}</span></span><div><span className="live-label"><i /> Interactive preview</span><div className="toolbar-avatar">A</div></div></div>
          <div className="workspace-content">
            {helpOpen && <div className="workspace-tip"><Sparkles size={17} /><p>This is your space to explore. Check off a task, add your own, or start a focus session. Your tasks stay in this browser.</p><button aria-label="Close help" onClick={() => setHelpOpen(false)}><X size={16} /></button></div>}
            <div className="dashboard-heading"><div><span className="dashboard-date">{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</span><h3>{view === 'overview' ? <>Hello, curious mind<span className="sun-symbol">☀</span></> : view === 'tasks' ? activeGroup || 'One thing at a time.' : view === 'tabs' ? 'Your tabs. All tucked in.' : 'Small steps. Real progress.'}</h3><p>{view === 'overview' ? 'A fresh start. A clear head. What will you make today?' : view === 'tasks' ? 'Make a little space for the things that matter.' : view === 'tabs' ? 'Three thoughtful spaces, instead of seven open loops.' : 'Good work is a rhythm, not a race.'}</p></div><span className="dashboard-sparkle" aria-hidden="true">✳</span></div>

            {view !== 'tabs' && <div className="dashboard-stats">
              <div><span><Timer size={15} /> Time well spent</span><strong>{Math.floor(state.focusedSeconds / 60)}<small> min</small><i className="stat-caption">of deep work</i></strong></div>
              <div><span><Check size={15} /> Little wins</span><strong>{completed}<small> / {state.tasks.length}</small><i className="stat-caption">tasks complete</i></strong></div>
              <div><span><FolderOpen size={15} /> Room to think</span><strong>3<small> spaces</small><i className="stat-caption">nicely organized</i></strong></div>
            </div>}

            {view === 'tabs' ? <div className="tab-spaces-grid">{tabGroups.map(group => <div className={`tab-space-card ${group.color}`} key={group.name}><button className="tab-space-heading" onClick={() => setTabGroupOpen(tabGroupOpen === group.name ? '' : group.name)} aria-expanded={tabGroupOpen === group.name}><div><FolderOpen size={20} /><strong>{group.name}</strong><small>{group.tabs.length} tabs</small></div><ChevronDown size={17} className={tabGroupOpen === group.name ? 'rotated' : ''} /></button>{tabGroupOpen === group.name && <div className="tab-space-links">{group.tabs.map(tab => <a href={tab.url} target="_blank" rel="noreferrer" key={tab.name}><ToolIcon name={group.icon} size={22} /><span>{tab.name}<small>{new URL(tab.url).hostname}</small></span><ExternalLink size={13} /></a>)}</div>}</div>)}<p className="preview-note">Explore a few example spaces. Links open in a new tab.</p></div>
            : view === 'insights' ? <div className="rhythm-panel"><div className="rhythm-header"><div><h4>Look at you go.</h4><p>Every little win makes room for the next.</p></div><span className="soft-badge">This preview session</span></div><div className="rhythm-body"><div className="progress-ring" style={{ '--progress': `${progress * 360}deg` } as React.CSSProperties}><div><strong>{Math.round(progress * 100)}<small>%</small></strong><span>of tasks complete</span></div></div><div className="rhythm-totals"><p><span><Check size={17} /> Tasks completed</span><strong>{completed}</strong></p><p><span><Timer size={17} /> Completed focus time</span><strong>{Math.floor(state.focusedSeconds / 60)} min</strong></p><p><span><ListTodo size={17} /> Up next</span><strong>{state.tasks.length - completed} tasks</strong></p><div className="rhythm-message"><Sparkles size={20} /><span>{progress === 1 ? 'All clear. Go enjoy that well-earned break.' : 'No perfect streaks needed. Just a little progress.'}</span></div></div></div></div>
            : <div className="dashboard-columns"><section className="task-panel"><div className="panel-heading"><h4>{view === 'tasks' ? 'Your tasks' : 'A little to-do. A lot of possibility.'} <span>{state.tasks.length}</span></h4><button className="icon-button" aria-label="Add a task" onClick={() => setAdding(true)}><Plus size={17} /></button></div><div className="task-filters"><div>{(['all', 'open', 'done'] as const).map(f => <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f === 'all' ? 'All tasks' : f === 'open' ? 'To do' : 'Done'}</button>)}</div><label className="task-search"><Search size={13} /><input aria-label="Search tasks" placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
              <div className="task-list">{displayedTasks.map(task => <div className={`task-row ${task.done ? 'done' : ''}`} key={task.id}><button className="task-check" role="checkbox" aria-checked={task.done} aria-label={`Mark ${task.text} ${task.done ? 'incomplete' : 'complete'}`} onClick={() => state.toggleTask(task.id)}>{task.done && <Check size={11} strokeWidth={3} />}</button><div className="task-copy"><span>{task.text}</span><small><i className={`space-dot dot-${task.label === 'Creative work' ? 0 : task.label === 'Website' ? 1 : 2}`} />{task.label}</small></div><ToolIcon name={task.source} size={19} />{view === 'tasks' && <button className="remove-task" aria-label={`Delete ${task.text}`} onClick={() => state.removeTask(task.id)}><X size={13} /></button>}</div>)}{displayedTasks.length === 0 && <p className="empty-tasks">{query ? 'No tasks match that search.' : filter === 'done' ? 'Your first little win is just ahead.' : 'All clear. Take a little breath.'}</p>}</div>
              {adding ? <form className="add-task-form" onSubmit={e => { e.preventDefault(); if (newTask.trim()) { state.addTask(newTask); setNewTask(''); setAdding(false); setFilter('all'); setActiveGroup(null); setQuery(''); } }}><input autoFocus aria-label="New task" maxLength={140} placeholder="What’s on your mind?" value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setAdding(false); }} /><button type="submit" aria-label="Save task"><Check size={16} /></button><button type="button" aria-label="Cancel new task" onClick={() => setAdding(false)}><X size={16} /></button></form> : <button className="add-task-button" onClick={() => setAdding(true)}><Plus size={14} /> Add a little to-do <span>↵</span></button>}
              <div className="task-panel-footer"><span><span className="tiny-sparkle">✳</span> A calmer kind of productive.</span><span>{completed} / {state.tasks.length} done</span></div>
            </section>
            <aside className={`focus-panel ${state.running ? 'is-focusing' : ''}`}><div className="focus-heading"><span><span className="focus-dot" /> {state.running ? 'In your element' : 'Time to tune in'}</span><button aria-label="Focus timer settings" className="icon-button" onClick={() => setShowTimerOptions(!showTimerOptions)} aria-expanded={showTimerOptions}><Settings2 size={14} /></button></div>{showTimerOptions && <div className="timer-options">{[5, 25, 45].map(duration => <button key={duration} onClick={() => state.changeDuration(duration)} className={state.duration === duration ? 'active' : ''}>{duration} min</button>)}</div>}<div className="focus-cat"><Cat size={59} sleepy={state.running} /></div><div className="focus-time" aria-label={`${minutes} minutes ${seconds} seconds`}>{minutes}<span>:</span>{seconds}</div><p aria-live="polite">{state.sessionComplete ? 'You did it. Take a little break.' : state.running ? 'Just you and your next great idea.' : 'One thing. Your full attention.'}</p><button className="focus-start" onClick={state.toggleTimer}>{state.running ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}{state.running ? 'Pause for a moment' : 'Start focusing'}<span>{state.running ? 'Ⅱ' : '↗'}</span></button><button className="timer-reset" onClick={state.resetTimer}><RotateCcw size={10} /> Reset session</button></aside>
            </div>}
            <div className="workspace-footer"><span><ShieldCheck size={12} /> Your space. Your pace.</span><span>Take a breath. You’re doing great. <span>✦</span></span></div>
          </div>
        </div>
      </div>
      {expanded && <div className="expanded-footnote"><Command size={12} /> Tasks are saved on this device. <span><ArrowDown size={12} /> Explore the sidebar for tab spaces and your progress.</span></div>}
    </div>
  );
}
