import { useId, useState, type KeyboardEvent } from 'react';
import {
  ArrowDown, ArrowUpRight, Check, CheckCheck, Code2, FolderOpen,
  ListTodo, MousePointer2, Network, RotateCcw, ShieldCheck, Sparkles, X,
} from 'lucide-react';
import { Cat, ToolIcon } from './components';
import './product-features.css';
import { featureGroups, mcpTools } from './feature-catalog';

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
    <article className="feature-card project-feature-card reveal">
      <div className="feature-copy"><div className="feature-top"><span className="feature-number">07 / KEEP THE PIECES TOGETHER</span><span className="small-pill">DEVELOPER EXTENSION</span></div><h3>Big idea.<br />All the little pieces.</h3><p>Tasks, steps, due dates, notes, and saved links.<br />Give them a project. Pick up where you left off.</p></div>
      <div className="project-feature-visual" aria-hidden="true"><div className="workspace-example-label">ILLUSTRATED PROJECT</div><div className="project-example-heading"><FolderOpen size={20} /><strong>The next big thing</strong></div><div className="project-example-task"><CheckCheck size={17} /><span>Sketch the first idea<small>Done · Creative work</small></span></div><div className="project-example-task"><ListTodo size={17} /><span>Make something worth sharing<small>In progress · One good step at a time</small></span></div><div className="project-example-footer"><span>2 notes</span><span>3 saved links</span><span>A little headspace</span></div></div>
    </article>
    <article className="feature-card mcp-feature-card reveal" id="mcp">
      <div className="feature-copy"><div className="feature-top"><span className="feature-number">08 / KEEP YOUR ASSISTANT IN THE LOOP</span><span className="small-pill">LOCAL MCP</span></div><h3>Your tasks. Your assistant.<br />Same page.</h3><p>Read real tasks, tabs, and your focus session.<br />Let your assistant create and complete tasks, with permission.</p></div>
      <div className="mcp-feature-visual"><div className="mcp-connection"><span><Network size={20} />MCP assistant</span><span aria-hidden="true">↔</span><span><Cat size={21} />Tabby</span></div><div className="mcp-capability"><span>READ ACCESS</span><p>Tasks · Tabs · Focus</p></div><div className="mcp-capability"><span>SEPARATE WRITE ACCESS</span><p>Create tasks · Mark done</p></div><button onClick={onExtension}>Five tools. Your choice to connect. <ArrowUpRight size={14} /></button><small>Local client setup required. MCP itself makes no AI calls.</small></div>
    </article>
  </>;
}

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
    <div className="feature-catalog-tabs" role="tablist" aria-label="Explore Tabby features">{featureGroups.map((item, index) => <button key={item.id} role="tab" id={`${id}-tab-${index}`} aria-selected={selected === index} aria-controls={`${id}-panel-${index}`} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={event => onKeyDown(event, index)}>{item.label}<span>{item.id === 'mcp' ? `${mcpTools.length} tools` : item.items.length}</span></button>)}</div>
    {featureGroups.map((item, index) => <div key={item.id} id={`${id}-panel-${index}`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`} hidden={selected !== index} tabIndex={0}><p className="feature-catalog-description">{item.description}</p><div className="feature-catalog-grid">{item.items.map(feature => <article className="catalog-feature" key={feature.title}><feature.icon size={22} strokeWidth={1.4} /><span>{feature.tag}</span><h3>{feature.title}</h3><p>{feature.description}</p></article>)}</div>{item.id === 'mcp' && <div className="mcp-tool-list"><h3>The five tools, by name.</h3><dl>{mcpTools.map(tool => <div key={tool.name}><dt><code>{tool.name}</code></dt><dd>{tool.description}</dd></div>)}</dl></div>}{item.id === 'tasks' && <p className="catalog-scope-note">Chrome sync needs the same account and extension on each computer. Delivery between two computers is not yet verified. Reports use the retained session history, capped at 100 previous sessions.</p>}</div>)}
    <div className="feature-catalog-footer"><span><ShieldCheck size={15} /> Local by default. Connected AI by choice.</span><button onClick={group.id === 'demo' ? onDemo : onExtension}>{group.id === 'demo' ? 'Make yourself at home' : 'Explore the Chrome extension'}<ArrowUpRight size={15} /></button></div>
  </section>;
}

export function UpcomingDetails({ onDemo }: { onDemo: () => void }) {
  return <>
    <div className="info-modal-symbol"><Sparkles size={30} /></div><span className="eyebrow">A LITTLE LOOK AHEAD</span><h2>More connected.<br /><span className="serif-word">Still wonderfully you.</span></h2><p>The developer extension already includes projects, AI chat, MCP, Chrome workspace sync, and reports. These app connections are still on our wishlist.</p>
    <div className="upcoming-details">{featureGroups.find(group => group.id === 'roadmap')!.items.map(feature => <div key={feature.tag}><feature.icon size={18} /><div><strong>{feature.title}</strong><p>{feature.description}</p></div></div>)}</div><div className="upcoming-note"><X size={12} /> These features are not available yet.</div><button className="button button-orange" onClick={onDemo}>Try what’s here today <ArrowUpRight size={17} /></button>
  </>;
}
