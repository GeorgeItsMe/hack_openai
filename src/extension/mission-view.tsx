import { useState } from 'react';
import { ArrowRight, Check, CheckCheck, CircleHelp, Clock3, Coffee, ExternalLink, ListChecks, LoaderCircle, Pause, Play, Search, Sparkles, Square, Target } from 'lucide-react';
import type { AppState, Session } from '../shared/types';
import { currentMissionStep } from '../shared/missions';
import { errorText } from './errors';
import './mission.css';

interface Props { state: AppState; session: Session | null; busy: string; enabled: boolean; act(type: string, payload?: Record<string, unknown>): Promise<unknown>; onFocus(): void }
const clock = (ms: number) => `${Math.floor(Math.max(0, ms) / 60000).toString().padStart(2, '0')}:${Math.floor(Math.max(0, ms) / 1000 % 60).toString().padStart(2, '0')}`;
export function MissionView({ state, session, busy, enabled, act, onFocus }: Props) {
  const m = state.missions; const mission = m.current; const draft = m.draft;
  const [goal, setGoal] = useState(draft?.goal || ''); const [minutes, setMinutes] = useState(draft?.minutes || 25); const [groupTabs, setGroupTabs] = useState(true);
  const locked = !!busy || !!m.pending; const step = mission && currentMissionStep(mission);
  const done = mission?.steps.filter(s => s.completedAt).length || 0;
  const ownSession = !!mission && session?.missionId === mission.id;
  const ticking = ownSession && session?.phase !== 'finished';
  const running = ticking && session?.phase === 'running';
  const assessment = running && !session?.away ? state.assessment : null;
  const task = step && state.tasks.find(t => t.id === step.taskId);
  const resource = step && mission?.resources.find(r => step.tabIds.includes(r.tabId));
  const relevantSessions = mission ? [...state.history, ...(session ? [session] : [])].filter(s => s.missionId === mission.id) : [];
  const focusedMs = relevantSessions.reduce((total, s) => total + s.totals.aligned + s.totals.distracting + s.totals.unknown, 0);
  const returnCount = relevantSessions.reduce((total, s) => total + s.returns, 0);
  const openResource = (tabId: number) => act('MISSION_OPEN_RESOURCE', { tabId });
  return <div className="mission-view">
    <div className="page-heading"><div><div className="eyebrow"><span />YOUR PRODUCTIVITY AGENT</div><h1>{mission?.status === 'completed' && !draft ? 'You followed through.' : mission && !draft ? 'One step. Then the next.' : 'Give Tabby a mission.'}</h1><p>A clear plan. The right tabs. A little help staying with it.</p></div><span className="heading-spark" aria-hidden="true">✳</span></div>
    {m.error && <p role="status" className="alert error">{errorText(m.error)}</p>}
    <div className="mission-layout"><div className="mission-main">
      {!draft && !mission && <section className="card mission-launch">
        <div className="kicker"><Target size={16} />FROM INTENTION TO DONE</div>
        <h2>What do you want to finish?</h2>
        <form onSubmit={e => { e.preventDefault(); void act('MISSION_PLAN', { goal, minutes }); }}>
          <label htmlFor="mission-goal">Your mission</label><textarea id="mission-goal" value={goal} onChange={e => setGoal(e.target.value)} minLength={5} maxLength={1000} rows={3} required placeholder="Build and test a React login form in 25 minutes" />
          <div className="mission-examples"><span>Try a goal</span>{['Prepare a 3-minute project pitch', 'Learn React state with a working example'].map(example => <button type="button" disabled={locked} onClick={() => setGoal(example)} key={example}>{example}<ArrowRight size={13} /></button>)}</div>
          <label htmlFor="mission-minutes">Time you have</label><select id="mission-minutes" value={minutes} onChange={e => setMinutes(Number(e.target.value))}>{[15, 25, 45, 60, 90, 120, 180].map(n => <option key={n} value={n}>{n} minutes</option>)}</select>
          <p className="mission-fine">Tabby uses your goal and eligible open tab titles and URLs to propose a plan. You review it before tasks, groups or a timer are created.</p>
          {session && session.phase !== 'finished' && <p className="mission-fine">Finish your current focus session before starting a mission. <button type="button" className="text-button" onClick={onFocus}>Open Focus</button></p>}
          <button type="submit" className="btn primary full" disabled={locked || !enabled || !state.settings.consent || goal.trim().length < 5}>{m.pending?.kind === 'plan' ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}{m.pending?.kind === 'plan' ? 'Preparing your plan…' : 'Plan my mission'}<ArrowRight size={16} /></button>
          {!enabled && <p className="mission-fine">Install the extension to plan with your real browser tabs.</p>}
          {!state.settings.consent && enabled && <p className="mission-fine">Choose Enable AI above to get started.</p>}
        </form>
      </section>}
      {draft && <section className="card mission-plan" aria-label="Mission plan review">
        <div className="card-top"><span className="kicker"><ListChecks size={16} />YOUR PLAN</span><span className="pill">{draft.minutes} min budget</span></div>
        <h2>{draft.plan.title}</h2><p>{draft.plan.outcome}</p>
        <ol className="mission-steps">{draft.plan.steps.map((item, i) => <li key={i}><span className="mission-number">{i + 1}</span><div><div className="mission-step-title"><h3>{item.title}</h3><small>{item.minutes} min</small></div><p>{item.instruction}</p><p className="mission-criterion"><Check size={13} /><span>Done when: {item.doneWhen}</span></p>{item.tabIds.map(id => <span className="mission-source" key={id}><ExternalLink size={12} />{draft.resources.find(r => r.tabId === id)?.title}</span>)}{item.searchQuery && <p className="mission-query"><Search size={12} />Suggested search: {item.searchQuery}</p>}</div></li>)}</ol>
        {draft.resources.length > 0 && <label className="mission-check"><input type="checkbox" checked={groupTabs} onChange={e => setGroupTabs(e.target.checked)} />Group {draft.resources.length} selected tab{draft.resources.length === 1 ? '' : 's'} in orange</label>}
        <p className="mission-fine">Start creates {draft.plan.steps.length} linked tasks{groupTabs && draft.resources.length ? `, groups ${draft.resources.length} existing tabs` : ''}, starts a {draft.minutes}-minute focus session{draft.plan.steps[0].tabIds.length ? ' and opens the first resource' : ''}. Search suggestions are opened only when you click them.</p>
        <div className="button-row"><button className="btn primary" disabled={locked || !state.settings.consent || !!session && session.phase !== 'finished'} onClick={() => act('MISSION_START', { draftId: draft.id, groupTabs })}><Play size={16} />Start this plan</button><button className="btn secondary" disabled={locked} onClick={async () => { setGoal(draft.goal); setMinutes(draft.minutes); await act('MISSION_EDIT'); }}>Edit goal</button></div>
        {session && session.phase !== 'finished' && <button className="text-button" onClick={onFocus}>Finish the current focus session first</button>}
      </section>}
      {mission && !draft && <>
        <section className="card mission-progress"><div className="card-top"><span className="kicker"><Target size={16} />{mission.status === 'completed' ? 'MISSION COMPLETE' : mission.status === 'stopped' ? 'SAVED FOR LATER' : 'MISSION IN PROGRESS'}</span><span className="pill">{done} / {mission.steps.length} steps</span></div><h2>{mission.title}</h2><p>{mission.goal}</p><progress aria-label="Mission progress" value={done} max={mission.steps.length} />
          {mission.status !== 'active' && <p className="mission-outcome">{mission.status === 'completed' ? 'Every step confirmed. Your finished work is saved in Tasks.' : `${mission.steps.length - done} steps left. Continue when you’re ready.`}</p>}
          {mission.status !== 'active' && <div className="mission-metrics"><span><strong>{done}</strong>confirmed steps</span><span><strong>{Math.round(focusedMs / 60000)} min</strong>in focus sessions</span><span><strong>{returnCount}</strong>work-tab returns</span></div>}
          {mission.status !== 'active' && <div className="button-row">{mission.status === 'stopped' && <button className="btn primary" disabled={locked || !!session && session.phase !== 'finished'} onClick={() => act('MISSION_RESUME', { minutes: 15 })}><Play size={15} />Continue for 15 minutes</button>}<button className={`btn ${mission.status === 'completed' ? 'primary' : 'secondary'}`} disabled={locked} onClick={() => act('MISSION_NEW')}><Sparkles size={15} />New mission</button></div>}
        </section>
        {mission.status === 'active' && step && <section className="card mission-current" aria-label="Current mission step">
          <div className="card-top"><span className="kicker">STEP {mission.steps.indexOf(step) + 1} OF {mission.steps.length}</span><span className="mission-clock"><Clock3 size={14} />{ticking ? clock(session!.phase === 'break' ? (session!.breakUntil || Date.now()) - Date.now() : session!.remainingMs) : 'Session ended'}</span></div>
          <h2>{step.title}</h2><p>{step.instruction}</p><div className="mission-done-when"><CheckCheck size={18} /><div><strong>You’re done when</strong><p>{step.doneWhen}</p></div></div>
          <div className="mission-resources">{mission.resources.filter(r => step.tabIds.includes(r.tabId)).map(r => <button key={r.tabId} className="mission-resource" disabled={locked} onClick={() => openResource(r.tabId)}><ExternalLink size={14} /><span>{r.title}</span><ArrowRight size={14} /></button>)}{step.searchQuery && <button className="mission-resource" title={step.searchQuery} disabled={locked} onClick={() => act('MISSION_SEARCH', { stepId: step.id })}><Search size={14} /><span>Search resources</span><ArrowRight size={14} /></button>}</div>
          {assessment?.category === 'distracting' && <div className="mission-detour" role="status"><strong>A little detour?</strong><p>{assessment.reason}</p><p>{assessment.nextStep}</p><div className="button-row">{resource && <button className="btn secondary" disabled={locked} onClick={() => openResource(resource.tabId)}>Back to this step</button>}<button className="text-button" disabled={locked} onClick={() => act('CORRECT')}>This is relevant</button></div></div>}
          {mission.coach?.stepId === step.id && <div className="mission-coach" role="status"><span className="kicker"><Sparkles size={14} />JUST THE NEXT TWO MINUTES</span><p>{mission.coach.text}</p></div>}
          {!task && <p className="alert error">The linked task was removed. Stop this mission and make a fresh plan to restore its steps.</p>}
          <div className="button-row mission-actions"><button className="btn primary" disabled={locked || !task} onClick={() => act('MISSION_COMPLETE_STEP', { stepId: step.id, expectedUpdatedAt: task?.updatedAt ?? task?.createdAt })}><Check size={17} />Mark step done</button><button className="btn secondary" disabled={locked || !state.settings.consent} onClick={() => act('MISSION_COACH')}><CircleHelp size={16} />{m.pending?.kind === 'coach' ? 'Finding a smaller step…' : 'I’m stuck'}</button></div>
          <div className="mission-session-controls">{ticking ? <><button disabled={locked} onClick={() => act(running ? 'PAUSE' : 'RESUME')}>{running ? <Pause size={14} /> : <Play size={14} />}{running ? 'Pause' : 'Resume'}</button>{running && <button disabled={locked} onClick={() => act('BREAK', { minutes: 5 })}><Coffee size={14} />5-minute break</button>}<span>{session?.away ? 'Away' : session?.phase === 'break' ? 'On a break' : session?.phase === 'paused' ? 'Paused' : session?.phase === 'ready' ? 'Ready to return' : !state.settings.consent ? 'AI off' : assessment?.category === 'aligned' ? 'On track' : state.pendingAt ? 'Checking page context…' : 'Page context needs a few seconds'}</span></> : <><p>Your progress is saved. The timer does not complete steps for you.</p><button className="text-button" disabled={locked || !!session && session.phase !== 'finished'} onClick={() => act('MISSION_RESUME', { minutes: 15 })}><Play size={14} />Continue for 15 minutes</button></>}</div>
          <div className="mission-bottom-actions"><button className="text-button" onClick={onFocus}>Focus details & site access</button><button className="text-button" disabled={locked} onClick={() => act('MISSION_STOP')}><Square size={12} />Stop mission</button></div>
        </section>}
        <section className="card mission-checklist"><span className="kicker"><ListChecks size={15} />THE WAY THROUGH</span><ol>{mission.steps.map((item, i) => <li key={item.id} className={item.completedAt ? 'complete' : item.id === step?.id ? 'current' : ''}><span className="mission-number">{item.completedAt ? <Check size={14} /> : i + 1}</span><span>{item.title}</span><small>{item.completedAt ? 'Done' : `${item.minutes} min`}</small></li>)}</ol></section>
      </>}
    </div><aside className="mission-aside">
      <section className="card mission-activity"><div className="kicker"><Sparkles size={15} />AGENT ACTIVITY</div><h2>See what Tabby does.</h2>{m.activity.length ? <ol>{m.activity.slice(-12).map(item => <li key={item.id} className={item.state}><span className="activity-dot">{item.state === 'done' ? <Check size={12} /> : '·'}</span><div><strong>{item.title}</strong>{item.detail && <p>{item.detail}</p>}<time dateTime={new Date(item.at).toISOString()}>{new Date(item.at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</time></div></li>)}</ol> : <p>Your plan, browser actions and confirmed progress will appear here as they happen.</p>}{m.pending && <div className="mission-pending" role="status"><LoaderCircle size={15} className="spin" /><span>{m.pending.kind === 'plan' ? 'DeepSeek is preparing your plan…' : 'DeepSeek is suggesting a smaller action…'}</span><button className="text-button" onClick={() => act('MISSION_CANCEL')}>Cancel</button></div>}</section>
      {!mission && !draft && <div className="mission-promise"><span>01</span><p><strong>Make it doable.</strong> A few steps, each with a clear finish.</p><span>02</span><p><strong>Set up your space.</strong> Related tabs and linked tasks, with your approval.</p><span>03</span><p><strong>Stay with it.</strong> Context-aware nudges and a smaller next action when you’re stuck.</p></div>}
    </aside></div>
  </div>;
}
