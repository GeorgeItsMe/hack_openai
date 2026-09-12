import { useId, useState, type KeyboardEvent } from 'react';
import {
  ArrowDown, ArrowRight, ArrowUpRight, BarChart3, BellOff, Check,
  CheckCheck, CircleHelp, Cloud, Code2, Copy, FileText, FolderOpen,
  Globe2, Inbox, ListTodo, MessageCircle, MousePointer2, Network,
  RotateCcw, Search, ShieldCheck, Sparkles, Timer, X,
} from 'lucide-react';
import { Cat, ToolIcon } from './components';
import './product-features.css';

export function ExtraFeatureCards({ onExtension }: { onExtension: () => void }) {
  const [context, setContext] = useState<'learning' | 'scrolling'>('learning');
  return <>
    <article className="feature-card capture-card reveal">
      <div className="feature-copy">
        <div className="feature-top"><span className="feature-number">05 / CATCH THE GOOD STUFF</span><span className="small-pill">IN THE EXTENSION</span></div>
        <h3>See it. Select it.<br />Consider it a to-do.</h3>
        <p>Turn a line from a page or message into a task.<br />Keep the source, add steps, and make it yours.</p>
      </div>
      <div className="capture-visual">
        <div className="capture-message"><div><ToolIcon name="gmail" size={17} /><span>A little note from your team</span><span>just now</span></div><p>Love where this is going. <mark>Review the homepage<br className="capture-break" /> and send your feedback.</mark></p><span className="capture-selection-cursor" aria-hidden="true"><MousePointer2 size={18} fill="currentColor" /></span></div>
        <div className="capture-connector" aria-hidden="true"><ArrowDown size={17} /></div>
        <div className="capture-result"><span className="capture-check"><Check size={12} /></span><div><strong>Review the homepage</strong><span>Source attached <i /> Ready for your review</span></div><Cat size={24} variant="task" /></div>
        <button className="feature-text-link" onClick={onExtension}>From a passing thought to a next step <ArrowUpRight size={13} /></button>
      </div>
    </article>
    <article className="feature-card context-card reveal">
      <div className="feature-copy">
        <div className="feature-top"><span className="feature-number">06 / KEEP YOUR NORTH STAR</span><span className="small-pill">IN THE EXTENSION</span></div>
        <h3>A nudge that gets<br />what you’re doing.</h3>
        <p>A tutorial can be work. A rabbit hole can wait.<br />Get a gentle nudge or a distraction cover you control.</p>
      </div>
      <div className="context-visual">
        <div className="context-example-label"><span><i /> YOUR GOAL: LEARN REACT</span><span>ILLUSTRATED EXAMPLE</span></div>
        <div className="context-switch" role="group" aria-label="Context example"><button onClick={() => setContext('learning')} aria-pressed={context === 'learning'}><Code2 size={13} /> A React tutorial</button><button onClick={() => setContext('scrolling')} aria-pressed={context === 'scrolling'}><Cat size={14} /> Cat videos</button></div>
        <div className={`context-assessment ${context}`} aria-live="polite"><span className="context-assessment-icon">{context === 'learning' ? <CheckCheck size={21} /> : <RotateCcw size={21} />}</span><div><strong>{context === 'learning' ? 'Looks like you’re in your element.' : 'A little detour? Let’s find your way back.'}</strong><p>{context === 'learning' ? 'This tutorial fits your goal. Keep going.' : 'Your React project is right where you left it.'}</p></div></div>
        <div className="context-bottom"><span><ShieldCheck size={12} /> Your goal gives the page its context.</span><button onClick={onExtension} aria-label="Learn about context-aware focus"><ArrowUpRight size={15} /></button></div>
      </div>
    </article>
  </>;
}

const featureGroups = [
  {
    id: 'extension', label: 'Chrome extension', description: 'Your sidekick alongside your real tabs. AI features work when the extension’s AI connection is set up.',
    items: [
      { icon: Sparkles, title: 'Focus that understands your goal', description: 'Assess a page against your task, get a reason, and correct the AI when it misses the point.', tag: 'CONTEXT-AWARE AI' },
      { icon: BellOff, title: 'Distractions, gently handled', description: 'Choose a soft reminder or a reversible cover. Return to work, take a break, or keep browsing.', tag: 'SOFT & STRICT MODES' },
      { icon: MousePointer2, title: 'Any selected text → a task', description: 'Capture a passage from a webpage. Ask AI for an editable draft, steps, and a source-backed due date.', tag: 'CAPTURE & REFINE' },
      { icon: Search, title: 'Find that one open tab', description: 'Search your current tabs by title or address, then jump straight to the page you need.', tag: 'SEARCH & SWITCH' },
      { icon: FolderOpen, title: 'A space for every project', description: 'Let AI suggest related tabs and group names. Review the suggestion, then create real Chrome groups.', tag: 'SMART TAB GROUPING' },
      { icon: Copy, title: 'One less duplicate', description: 'Spot tabs with the same full address and choose which extras to close. Keep a copy within reach.', tag: 'DUPLICATE CLEANUP' },
      { icon: Timer, title: 'Deep work, at your pace', description: 'Set your focus length, pause when you need to, and take a timed break. Your session survives closing the panel.', tag: 'FOCUS & BREAK TIMERS' },
      { icon: RotateCcw, title: 'Pick up the thread', description: 'Come back to your goal, saved working tabs, and last confirmed step. Ask AI for one next move.', tag: 'RESUME & NEXT-STEP HELP' },
      { icon: BarChart3, title: 'See where your time went', description: 'Review focus, distractions, breaks, and time away, plus reminders, returns, and an AI session recap.', tag: 'SESSION INSIGHTS' },
    ],
  },
  {
    id: 'demo', label: 'Try on this page', description: 'No install or account needed. A real little workspace to explore, with your tasks saved in this browser.',
    items: [
      { icon: ListTodo, title: 'Get it out of your head', description: 'Add, search, filter, complete, and delete tasks. They stay here when you return to this browser.', tag: 'LOCAL TASK LISTS' },
      { icon: Timer, title: 'Make a little time', description: 'Try a 5, 25, or 45 minute focus session. Pause, resume, and reset whenever you need to.', tag: 'WORKING FOCUS TIMER' },
      { icon: FolderOpen, title: 'Try a calmer workspace', description: 'Explore three example tab spaces with working links. Your actual browser tabs stay under your control.', tag: 'EXAMPLE TAB SPACES' },
      { icon: CheckCheck, title: 'Notice your little wins', description: 'See completed tasks and finished focus sessions reflected in your preview’s progress view.', tag: 'LIVE PREVIEW PROGRESS' },
    ],
  },
  {
    id: 'roadmap', label: 'Coming next', description: 'A look at what we’re planning. These connections and features are not available in the current preview or extension.',
    items: [
      { icon: Inbox, title: 'Tasks that come to you', description: 'Bring tasks from Gmail, Google Calendar, Notion, Linear, Todoist, and TickTick into one connected inbox.', tag: 'AUTOMATIC TASK COLLECTION' },
      { icon: MessageCircle, title: 'A conversation with your workspace', description: 'Ask questions, talk through a plan, and work with your tasks through an ongoing AI chat.', tag: 'AI CHAT' },
      { icon: Network, title: 'Your favorite agents, connected', description: 'Use MCP to share task context with AI assistants and coding agents, and keep task statuses in step.', tag: 'MCP & CODING AGENTS' },
      { icon: Globe2, title: 'Catch the to-dos in the conversation', description: 'Bring actionable messages from Slack, Telegram, and WhatsApp into your task list through connected services.', tag: 'MESSENGER INBOX' },
      { icon: Cloud, title: 'Your flow, wherever you go', description: 'Keep your tasks, preferences, and saved spaces in sync across your devices.', tag: 'CROSS-DEVICE SYNC' },
      { icon: FileText, title: 'The bigger picture', description: 'Go beyond a single session with longer-term trends, richer reports, and insights you can take with you.', tag: 'ADVANCED REPORTS' },
    ],
  },
];

export function FeatureExplorer({ onDemo, onExtension }: { onDemo: () => void; onExtension: () => void }) {
  const [selected, setSelected] = useState(0);
  const id = useId();
  const group = featureGroups[selected];
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % featureGroups.length;
    else if (event.key === 'ArrowLeft') next = (index + featureGroups.length - 1) % featureGroups.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = featureGroups.length - 1;
    else return;
    event.preventDefault(); setSelected(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };
  return <section className="feature-explorer section-wrap" id="all-features" aria-labelledby={`${id}-title`}>
    <div className="section-heading reveal"><div><div className="eyebrow"><span>✳</span> SMALL SIDEKICK. BIG TOOLKIT.</div><h2 id={`${id}-title`}>A little help.<br /><span className="serif-word">In all the right places.</span></h2></div><p>From your first to-do to your last open tab.<br />Here’s the whole little world of Tabby.</p></div>
    <div className="feature-catalog-tabs" role="tablist" aria-label="Explore Tabby features">{featureGroups.map((item, index) => <button key={item.id} role="tab" id={`${id}-tab-${index}`} aria-selected={selected === index} aria-controls={`${id}-panel-${index}`} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={event => onKeyDown(event, index)}>{item.label}<span>{item.items.length}</span></button>)}</div>
    {featureGroups.map((item, index) => <div key={item.id} id={`${id}-panel-${index}`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`} hidden={selected !== index} tabIndex={0}><p className="feature-catalog-description">{item.description}</p><div className="feature-catalog-grid">{item.items.map(feature => <article className="catalog-feature" key={feature.title}><feature.icon size={22} strokeWidth={1.4} /><span>{feature.tag}</span><h3>{feature.title}</h3><p>{feature.description}</p></article>)}</div></div>)}
    <div className="feature-catalog-footer"><span><ShieldCheck size={15} /> Local by default. Connected AI by choice.</span><button onClick={selected === 1 ? onDemo : onExtension}>{group.id === 'demo' ? 'Make yourself at home' : 'Explore the Chrome extension'}<ArrowUpRight size={15} /></button></div>
  </section>;
}

export function ExtensionDetails({ onDemo }: { onDemo: () => void }) {
  return <>
    <div className="info-modal-symbol"><Cat size={35} variant="workspace" /></div><span className="eyebrow">A SIDEKICK IN YOUR ACTUAL BROWSER</span><h2>Your tabs.<br /><span className="serif-word">A little more together.</span></h2><p>The Chrome extension brings Tabby alongside your work. Tasks and timers are local; contextual focus, task drafts, grouping suggestions, and recaps use a connected AI service.</p>
    <div className="extension-detail-list"><div><ListTodo size={18} /><span><strong>Make a little room</strong>Tasks, tab search, duplicate cleanup, focus sessions, and breaks.</span></div><div><Sparkles size={18} /><span><strong>Connect a little help</strong>Goal-aware nudges, text-to-task drafts, AI grouping, next steps, and session summaries.</span></div><div><ShieldCheck size={18} /><span><strong>Keep the choice yours</strong>Choose whether to share context. Correct a suggestion or dismiss a distraction cover whenever you need.</span></div></div>
    <div className="extension-setup-note"><CircleHelp size={17} /><p>This version is installed manually from the project. AI features need the local companion service and your own provider connection.</p></div>
    <a className="button button-dark" href="https://github.com/GeorgeItsMe/hack_openai#extension-and-local-server" target="_blank" rel="noreferrer">Get the extension & setup steps <ArrowUpRight size={17} /></a><button className="extension-demo-link" onClick={onDemo}>Or try the no-install preview <ArrowRight size={14} /></button>
  </>;
}

export function UpcomingDetails({ onDemo }: { onDemo: () => void }) {
  return <>
    <div className="info-modal-symbol"><Sparkles size={30} /></div><span className="eyebrow">A LITTLE LOOK AHEAD</span><h2>More connected.<br /><span className="serif-word">Still wonderfully you.</span></h2><p>Today’s extension handles focus, tasks, and tabs. These are the next connections we’re planning.</p>
    <div className="upcoming-details">{featureGroups[2].items.map(feature => <div key={feature.tag}><feature.icon size={18} /><div><strong>{feature.title}</strong><p>{feature.description}</p></div></div>)}</div><div className="upcoming-note"><X size={12} /> These features are not available yet.</div><button className="button button-orange" onClick={onDemo}>Try what’s here today <ArrowUpRight size={17} /></button>
  </>;
}
