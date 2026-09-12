import { initialState, normalizeLanguage, type AppState, type PageContext, type Assessment, type Usage, type Task } from '../shared/types';
import { createSession, settle, transition, event, cacheKey, requestCurrent } from '../shared/engine';
import { cleanUrl, contextKey, excluded, redact } from '../shared/privacy';
import { assessmentSchema, groupSchema, nextSchema, summarySchema, taskSchema, type AIRequest } from '../shared/schemas';

let state: AppState; let queue: Promise<unknown> = Promise.resolve(); let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0; let controller: AbortController | undefined;
const cache = new Map<string, Assessment>(); const pendingRequests = new Set<AbortController>();
const ready = chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).then(async () => {
  const stored = (await chrome.storage.local.get('app')).app as AppState | undefined;
  state = stored?.version === 1 ? stored : initialState();
  normalizeLanguage(state);
  if (state.session && state.session.phase !== 'finished') {
    const s = state.session;
    // After an unobserved long sleep, do not attribute the gap to a website.
    if (Date.now() - s.accountedAt > 75000 && s.phase === 'running') { s.away = true; event(s, 'unobserved-gap'); }
    settle(s);
    s.away = await chrome.idle.queryState(60) !== 'active' || !(await chrome.windows.getLastFocused()).focused;
    s.category = 'unknown'; state.assessment = null;
  }
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  chrome.idle.setDetectionInterval(60);
  await save(); await alarms();
});
function serial<T>(fn: () => Promise<T> | T): Promise<T> {
  const next = queue.then(() => ready).then(fn); queue = next.catch(() => {}); return next;
}
async function save() { await chrome.storage.local.set({ app: state }); }
function invalidate() { generation++; controller?.abort(); controller = undefined; clearTimeout(timer); }
async function stopScripts() {
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.filter(t => t.id !== undefined).map(t => chrome.tabs.sendMessage(t.id!, { type: 'STOP_OBSERVING' })));
}
async function alarms() {
  const s = state.session;
  if (!s || s.phase === 'finished') { await chrome.alarms.clear('checkpoint'); await chrome.alarms.clear('deadline'); await chrome.alarms.clear('evaluate'); return; }
  if (!await chrome.alarms.get('checkpoint')) await chrome.alarms.create('checkpoint', { periodInMinutes: 0.5 });
  const at = s.phase === 'break' ? s.breakUntil : s.phase === 'running' && !s.away ? Date.now() + s.remainingMs : undefined;
  if (at) await chrome.alarms.create('deadline', { when: Math.max(Date.now() + 100, at) }); else await chrome.alarms.clear('deadline');
}
function observing() { return state.session?.phase === 'running' && !state.session.away; }
function permitted(url: string) { return cleanUrl(url) && !excluded(url, state.settings.excludedSites); }
async function activeTab() { return (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]; }
async function inject(tabId: number) {
  try { await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }); return true; } catch { return false; }
}
async function readPage(tab: chrome.tabs.Tab, readText: boolean): Promise<PageContext> {
  const url = cleanUrl(tab.url || ''); let text: string | undefined;
  if (readText && permitted(tab.url || '') && await inject(tab.id!)) {
    try { const result = await chrome.tabs.sendMessage(tab.id!, { type: 'READ_PAGE' }); if (typeof result?.text === 'string') text = redact(result.text); } catch { /* Page may navigate while reading. */ }
  }
  return { tabId: tab.id!, windowId: tab.windowId, url, title: redact(tab.title || '', 300), ...(text ? { text } : {}), key: contextKey(tab.url || '', tab.title || '', text), enteredAt: Date.now() };
}
async function observe(force = false) {
  await serial(async () => {
    if (!observing()) return;
    const s = state.session!; settle(s);
    if (!observing()) { await stopScripts(); await save(); return; }
    const tab = await activeTab();
    if (!tab?.id || !permitted(tab.url || '') || tab.incognito) {
      invalidate(); s.category = 'unknown'; state.page = null; state.assessment = null; state.pendingAt = undefined; await stopScripts(); await save(); return;
    }
    const page = await readPage(tab, state.settings.consent && state.settings.readText);
    if (!force && state.page?.tabId === page.tabId && state.page.key === page.key) return;
    invalidate(); await stopScripts();
    s.category = 'unknown'; state.page = page; state.assessment = null; state.pendingAt = undefined;
    event(s, 'page', page.title);
    if (state.settings.consent) {
      if (await inject(page.tabId)) await chrome.tabs.sendMessage(page.tabId, { type: 'OBSERVE', readText: state.settings.readText }).catch(() => {});
      state.pendingAt = Date.now() + 8000;
      timer = setTimeout(() => { void evaluate(); }, 8000);
      await chrome.alarms.create('evaluate', { when: state.pendingAt });
    }
    await save();
  });
}
function aiContext(): AIRequest['context'] {
  const s = state.session; const p = state.page; const task = state.tasks.find(t => t.id === s?.taskId);
  return { language: state.settings.language, goal: s?.goal ?? '', task: task ? `${task.title}\n${task.steps.join('\n')}`.slice(0, 2000) : '',
    ...(p && permitted(p.url) ? { page: { title: p.title, url: p.url, ...(state.settings.readText && p.text ? { text: p.text } : {}), seconds: Math.min(1e8, Math.max(0, (Date.now() - p.enteredAt) / 1000)) } } : {}),
    ...(s ? { session: JSON.stringify({ phase: s.phase, totals: s.totals, confirmedStep: s.lastConfirmedStep, events: s.events.slice(-12), completedTasks: state.tasks.filter(t => t.completedAt && t.completedAt >= s.startedAt).map(t => t.title) }).slice(0, 5000), corrections: Object.entries(s.corrections).slice(-40).map(([context, v]) => ({ context, reason: v.reason })) } : {}) };
}
async function api(path: string, payload: unknown, signal?: AbortSignal) {
  const token = state.settings.pairToken;
  if (!token) throw Object.assign(new Error('PAIRING_REQUIRED'), { code: 'PAIRING_REQUIRED' });
  const abort = new AbortController(); pendingRequests.add(abort);
  try {
    const response = await fetch(`http://127.0.0.1:4318/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tabby-Token': token }, body: JSON.stringify(payload), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(29000), ...(signal ? [signal] : [])]) });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error?.code || 'API_UNAVAILABLE'), data.error);
    return data;
  } catch (e: any) { if (e.code) throw e; throw Object.assign(new Error(signal?.aborted || abort.signal.aborted ? 'REQUEST_CANCELLED' : 'SERVER_OFFLINE'), { code: signal?.aborted || abort.signal.aborted ? 'REQUEST_CANCELLED' : 'SERVER_OFFLINE' }); }
  finally { pendingRequests.delete(abort); }
}
async function failure(e: any) {
  if (e.usage) addUsage(e.usage);
  state.ai = { connected: false, code: e.code || 'SERVER_OFFLINE', available: e.available, at: Date.now() };
  if (state.session) { settle(state.session); state.session.category = 'unknown'; }
  state.assessment = null; state.pendingAt = undefined; await stopScripts(); await save();
}
function addUsage(usage: Usage) { for (const key of ['total_tokens', 'prompt_tokens', 'completion_tokens', 'total_cost'] as const) if (typeof usage?.[key] === 'number') state.usage[key] = (state.usage[key] ?? 0) + usage[key]!; }
async function applyAssessment(a: Assessment) {
  if (!observing() || !state.page) return;
  const s = state.session!; settle(s); if (!observing()) return;
  state.assessment = a; state.pendingAt = undefined; s.category = a.category;
  if (a.category === 'aligned') {
    s.workTabs = [{ tabId: state.page.tabId, title: state.page.title, url: state.page.url, key: state.page.key }, ...s.workTabs.filter(t => t.tabId !== state.page!.tabId)].slice(0, 30);
  }
  if (a.category === 'distracting') {
    s.reminders++; event(s, 'reminder', a.reason);
    if (await inject(state.page.tabId)) await chrome.tabs.sendMessage(state.page.tabId, { type: 'REMIND', strict: state.settings.mode === 'strict', goal: s.goal, reason: a.reason, language: state.settings.language, expiresAt: Date.now() + 40000 }).catch(() => {});
  } else await chrome.tabs.sendMessage(state.page.tabId, { type: 'UNBLOCK' }).catch(() => {});
  await save();
}
async function evaluate() {
  const prepared = await serial(async () => {
    if (!observing() || !state.settings.consent || !state.page || !state.pendingAt || state.pendingAt > Date.now() + 100) return;
    await chrome.alarms.clear('evaluate'); state.pendingAt = undefined;
    const s = state.session!; const p = state.page; const key = cacheKey(s, p.key);
    if (s.corrections[p.key]) { await applyAssessment({ category: 'aligned', reason: 'You marked this material as relevant.', nextStep: s.lastConfirmedStep || ('Continue your current task.'), source: 'user', at: Date.now(), key: p.key }); return; }
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < 120000) { await applyAssessment(cached); return; }
    const token = generation; controller = new AbortController(); state.ai.code = 'ANALYZING'; await save();
    return { id: s.id, revision: s.revision, page: p, token, key, signal: controller.signal, context: aiContext() };
  });
  if (!prepared) return;
  try {
    const response = await api('ai', { kind: 'classify', context: prepared.context }, prepared.signal);
    const result = assessmentSchema.parse(response.result);
    await serial(async () => {
      addUsage(response.usage); // Paid responses count even when stale.
      if (generation !== prepared.token || !requestCurrent(state.session, prepared.id, prepared.revision, prepared.page.key, state.page?.key)) { await save(); return; }
      state.ai = { connected: true, model: response.model, code: 'READY', at: Date.now() };
      const a: Assessment = { ...result, source: 'ai', at: Date.now(), key: prepared.page.key }; cache.set(prepared.key, a);
      if (cache.size > 150) cache.delete(cache.keys().next().value!);
      await applyAssessment(a);
    });
  } catch (e) { await serial(async () => { if (generation === prepared.token) await failure(e); }); }
}
async function returnToWork() {
  const s = state.session; if (!s) return;
  for (const work of s.workTabs) {
    try { const tab = await chrome.tabs.get(work.tabId); if (!permitted(tab.url || '') || cleanUrl(tab.url || '') !== work.url) continue;
      const currentPage = await readPage(tab, state.settings.consent && state.settings.readText);
      if (currentPage.key !== work.key) continue;
      await chrome.windows.update(tab.windowId, { focused: true }); await chrome.tabs.update(tab.id!, { active: true }); s.returns++; event(s, 'return', work.title); await save(); return;
    } catch { /* Closed tab: try the next known work tab, never reopen or redirect automatically. */ }
  }
  throw new Error('WORK_TAB_CLOSED');
}
async function runAI(kind: AIRequest['kind']) {
  const snapshot = await serial(async () => {
    if (!state.settings.consent) throw new Error('CONSENT_REQUIRED');
    const context = aiContext(); const s = state.session; let groupSnapshot: Record<number, string> | undefined;
    if ((kind === 'next' || kind === 'summary') && !s) throw new Error('NO_SESSION');
    if (kind === 'groups') {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      groupSnapshot = Object.fromEntries(tabs.filter(t => t.id).map(t => [t.id!, contextKey(t.url || '', t.title || '')]));
      context.tabs = tabs.filter(t => t.id && !t.incognito && permitted(t.url || '')).slice(0, 100).map(t => ({ tabId: t.id!, title: redact(t.title || '', 300), url: cleanUrl(t.url || '') }));
      context.tasks = state.tasks.filter(t => t.status !== 'done').slice(0, 100).map(t => t.title);
    }
    if (kind === 'task') {
      const tab = await activeTab(); if (!tab?.id || tab.incognito || !permitted(tab.url || '')) throw new Error('PAGE_UNAVAILABLE');
      const page = await readPage(tab, state.settings.readText);
      context.page = { title: page.title, url: page.url, text: page.text, seconds: 0 };
      if (state.taskDraft?.selectedText) { context.selection = state.taskDraft.selectedText; context.page = { title: '', url: state.taskDraft.source, seconds: 0 }; }
    }
    return { context, sessionId: s?.id, revision: s?.revision, pageKey: state.page?.key, generation, groupSnapshot, source: kind === 'task' ? (context.page?.url ?? '') : '' };
  });
  try {
    const data = await api('ai', { kind, context: snapshot.context });
    return await serial(async () => {
      addUsage(data.usage);
      if (!state.settings.consent || (['next', 'summary'].includes(kind) && (snapshot.sessionId !== state.session?.id || snapshot.revision !== state.session?.revision)) || (kind === 'next' && snapshot.pageKey !== state.page?.key)) { await save(); throw new Error('STALE_RESPONSE'); }
      state.ai = { connected: true, code: 'READY', model: data.model, at: Date.now() };
      if (kind === 'task') { const task = taskSchema.parse(data.result); state.taskDraft = { title: task.title, steps: task.steps, due: task.due, source: snapshot.source }; }
      if (kind === 'groups') { state.groupDraft = groupSchema.parse(data.result).groups; state.groupSnapshot = snapshot.groupSnapshot; }
      if (kind === 'next') { const n = nextSchema.parse(data.result); if (state.assessment) state.assessment.nextStep = n.nextStep; else if (state.page) state.assessment = { category: 'unknown', reason: '', nextStep: n.nextStep, source: 'ai', at: Date.now(), key: state.page.key }; }
      if (kind === 'summary') state.session!.summary = summarySchema.parse(data.result);
      await save(); return data.result;
    });
  } catch (e) { if ((e as Error).message !== 'STALE_RESPONSE') await serial(() => failure(e)); throw e; }
}
async function command(message: any) {
  if (message.type === 'AI') return runAI(message.kind);
  if (message.type === 'CONNECT') {
    try { const data = await api('status', {}); await serial(async () => { state.ai = { ...data, at: Date.now() }; await save(); }); void observe(true); return data; }
    catch (e) { await serial(() => failure(e)); throw e; }
  }
  const result = await serial(async () => {
    const s = state.session; if (s) settle(s);
    switch (message.type) {
      case 'GET': return state;
      case 'START':
        if (s && s.phase !== 'finished') throw new Error('SESSION_ALREADY_RUNNING');
        if (s) state.history = [s, ...state.history].slice(0, 100);
        state.session = createSession(String(message.goal || ''), String(message.taskId || ''), Number(message.minutes));
        state.session.away = await chrome.idle.queryState(60) !== 'active' || !(await chrome.windows.getLastFocused()).focused;
        state.page = null; state.assessment = null; cache.clear(); break;
      case 'GOAL':
        if (s && s.phase !== 'finished' && typeof message.goal === 'string' && message.goal.trim() && message.goal.length <= 1000) { s.goal = message.goal.trim(); s.taskId = String(message.taskId || ''); s.revision++; s.category = 'unknown'; s.corrections = {}; s.workTabs = []; s.lastConfirmedStep = ''; state.assessment = null; event(s, 'goal-changed'); } break;
      case 'PAUSE': if (s) transition(s, 'paused'); break;
      case 'RESUME': if (s) transition(s, 'running'); break;
      case 'BREAK': if (s) transition(s, 'break', Date.now(), Number(message.minutes) || state.settings.breakMinutes); break;
      case 'STOP': if (s) transition(s, 'finished'); break;
      case 'CORRECT':
        if (s && observing() && state.page) {
          s.corrections[state.page.key] = { reason: 'User confirmed relevance for this exact page context', at: Date.now() }; s.revision++; event(s, 'correction', state.page.title); invalidate();
          await applyAssessment({ category: 'aligned', reason: 'You confirmed this is relevant.', nextStep: 'Continue your selected task.', source: 'user', at: Date.now(), key: state.page.key });
        } break;
      case 'RETURN': await returnToWork(); break;
      case 'CONFIRM_STEP': if (s) { s.lastConfirmedStep = String(message.step || '').slice(0, 600); event(s, 'confirmed-step', s.lastConfirmedStep); } break;
      case 'SETTINGS': {
        const x = message.settings || {};
        state.settings.language = 'en';
        if (['soft', 'strict'].includes(x.mode)) state.settings.mode = x.mode;
        for (const key of ['consent', 'readText'] as const) if (typeof x[key] === 'boolean') state.settings[key] = x[key];
        if (Array.isArray(x.excludedSites)) {
          state.settings.excludedSites = x.excludedSites.filter((v: unknown) => typeof v === 'string' && /^[a-z0-9.-]+$/i.test(v)).slice(0, 100);
          if (s) { s.workTabs = s.workTabs.filter(tab => !excluded(tab.url, state.settings.excludedSites)); s.events = s.events.filter(e => !['page', 'reminder', 'correction'].includes(e.type)); }
          if (state.taskDraft && excluded(state.taskDraft.source, state.settings.excludedSites)) state.taskDraft = undefined;
          state.groupDraft = undefined;
        }
        if (typeof x.pairToken === 'string' && x.pairToken.length <= 256) state.settings.pairToken = x.pairToken.trim();
        if (Number.isFinite(x.breakMinutes)) state.settings.breakMinutes = Math.max(1, Math.min(120, x.breakMinutes));
        if (s) { s.revision++; s.category = 'unknown'; } state.assessment = null; state.page = null;
        cache.clear(); for (const request of pendingRequests) request.abort();
        if (!state.settings.consent) state.ai.code = 'CONSENT_REQUIRED'; break;
      }
      case 'SAVE_TASK': {
        const t = message.task; if (!t || typeof t.title !== 'string' || !t.title.trim() || t.title.length > 180 || !['planned', 'doing', 'done'].includes(t.status) || !Array.isArray(t.steps)) throw new Error('INVALID_TASK');
        const old = state.tasks.find(x => x.id === t.id);
        const task: Task = { id: old?.id || crypto.randomUUID(), title: t.title.trim(), steps: t.steps.filter((x: unknown) => typeof x === 'string').slice(0, 8).map((x: string) => x.slice(0, 600)), source: cleanUrl(t.source || ''), due: /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : '', status: t.status, createdAt: old?.createdAt || Date.now(), ...(t.status === 'done' ? { completedAt: old?.completedAt || Date.now() } : {}) };
        state.tasks = [task, ...state.tasks.filter(x => x.id !== task.id)].slice(0, 500); state.taskDraft = undefined;
        if (s && task.status === 'done' && old?.status !== 'done') event(s, 'task-completed', task.title);
        if (s?.taskId === task.id) { s.revision++; s.category = 'unknown'; s.corrections = {}; s.workTabs = []; state.assessment = null; }
        break;
      }
      case 'CLEAR_DRAFT': state.taskDraft = undefined; break;
      case 'LIST_TABS': return (await chrome.tabs.query({ currentWindow: true })).map(t => ({ id: t.id, title: t.title, url: t.url, active: t.active, pinned: t.pinned, groupId: t.groupId }));
      case 'ACTIVATE_TAB': if (Number.isInteger(message.tabId)) await chrome.tabs.update(message.tabId, { active: true }); break;
      case 'CLOSE_DUPLICATES': {
        const tabs = await chrome.tabs.query({ currentWindow: true }); const ids = new Set<number>(Array.isArray(message.tabIds) ? message.tabIds : []);
        const selected = tabs.filter(t => ids.has(t.id!) && !t.pinned && !t.active && /^https?:/.test(t.url || ''));
        for (const tab of selected) {
          // Retain at least one unselected exact URL match; never close a unique page after navigation.
          const keep = tabs.find(t => t.id !== tab.id && !ids.has(t.id!) && t.url === tab.url);
          if (keep) { const current = await chrome.tabs.get(tab.id!); const survivor = await chrome.tabs.get(keep.id!); if (current.url === survivor.url && !current.pinned && !current.active) await chrome.tabs.remove(tab.id!); }
        } break;
      }
      case 'APPLY_GROUPS': {
        if (!state.groupDraft) throw new Error('NO_GROUPS');
        const groups = groupSchema.parse({ groups: state.groupDraft }).groups;
        const current = new Map((await chrome.tabs.query({ currentWindow: true })).map(t => [t.id, contextKey(t.url || '', t.title || '')]));
        if (groups.some(g => g.tabIds.some(id => !current.has(id) || current.get(id) !== state.groupSnapshot?.[id]))) throw new Error('TABS_CHANGED');
        for (const g of groups) { const id = await chrome.tabs.group({ tabIds: g.tabIds as [number, ...number[]] }); await chrome.tabGroups.update(id, { title: g.title, color: g.color }); }
        state.groupDraft = undefined; state.groupSnapshot = undefined; break;
      }
      case 'CLEAR_DATA':
        invalidate(); for (const request of pendingRequests) request.abort(); await stopScripts(); state = initialState(); cache.clear(); break;
      default: throw new Error('UNKNOWN_COMMAND');
    }
    if (['START', 'GOAL', 'PAUSE', 'RESUME', 'BREAK', 'STOP', 'SETTINGS', 'SAVE_TASK'].includes(message.type)) { invalidate(); state.pendingAt = undefined; await stopScripts(); }
    await alarms(); await save(); return state;
  });
  if (['START', 'GOAL', 'RESUME', 'SETTINGS', 'SAVE_TASK'].includes(message.type)) void observe(true);
  return result;
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  const trustedUI = !!sender.url?.startsWith(chrome.runtime.getURL(''));
  if (sender.tab && !trustedUI) {
    if (message?.type === 'PAGE_CHANGED') { if (sender.tab.id === state?.page?.tabId && observing()) { invalidate(); void observe(true); } reply({ ok: true }); return; }
    if (message?.type === 'LEASE') {
      const allowed = !!state && observing() && state.page?.tabId === sender.tab.id && state.assessment?.category === 'distracting' && state.settings.mode === 'strict' && state.ai.connected && Date.now() - (state.ai.at || 0) < 45000;
      reply({ allowed }); return;
    }
    if (!['CORRECT', 'BREAK', 'STOP'].includes(message?.type) || sender.tab.id !== state?.page?.tabId) { reply({ ok: false, error: 'FORBIDDEN' }); return; }
  } else if (!trustedUI) return;
  void ready.then(() => command(message)).then(data => reply({ ok: true, data }), e => reply({ ok: false, error: e.code || e.message || 'ERROR' }));
  return true;
});
chrome.tabs.onActivated.addListener(() => { invalidate(); void observe(true); });
chrome.tabs.onUpdated.addListener((tabId, change, tab) => { if ((tab.active || tabId === state?.page?.tabId) && (change.url || change.title || change.status === 'complete')) { invalidate(); void observe(true); } });
chrome.tabs.onRemoved.addListener(tabId => { invalidate(); void serial(async () => { if (state.session) state.session.workTabs = state.session.workTabs.filter(t => t.tabId !== tabId); if (state.page?.tabId === tabId) { if (state.session) { settle(state.session); state.session.category = 'unknown'; } state.page = null; state.assessment = null; } await save(); }).then(() => observe(true)); });
function presence() { invalidate(); void serial(async () => { const s = state.session; if (!s || s.phase === 'finished') return; settle(s); s.away = await chrome.idle.queryState(60) !== 'active' || !(await chrome.windows.getLastFocused()).focused; s.category = 'unknown'; state.assessment = null; state.page = null; event(s, s.away ? 'away' : 'present'); await stopScripts(); await alarms(); await save(); }).then(() => observe()); }
chrome.idle.onStateChanged.addListener(presence);
chrome.windows.onFocusChanged.addListener(presence);
chrome.permissions.onRemoved.addListener(() => { invalidate(); void serial(async () => { if (state.session) state.session.revision++; state.page = null; state.assessment = null; await stopScripts(); await save(); }).then(() => observe(true)); });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'evaluate') { void evaluate(); return; }
  void serial(async () => { if (state.session) settle(state.session); if (!observing()) { invalidate(); state.pendingAt = undefined; await stopScripts(); } await alarms(); await save(); }).then(async () => {
    // A short strict overlay lease requires fresh connectivity, never an indefinite block.
    if (observing() && state.settings.mode === 'strict' && state.assessment?.category === 'distracting') {
      try { await api('status', {}); await serial(async () => { state.ai.at = Date.now(); if (state.page) await chrome.tabs.sendMessage(state.page.tabId, { type: 'RENEW', expiresAt: Date.now() + 40000 }).catch(() => {}); }); }
      catch (e) { await serial(() => failure(e)); }
    }
  });
});
chrome.runtime.onInstalled.addListener(() => { void chrome.contextMenus.removeAll().then(() => chrome.contextMenus.create({ id: 'task-selection', title: 'Tabby: Create task', contexts: ['selection'] })); });
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'task-selection' || !tab?.id) return;
  void chrome.sidePanel.open({ windowId: tab.windowId });
  void serial(async () => { if (tab.incognito || !permitted(tab.url || '')) return;
    const selectedText = redact(String(info.selectionText || '')); state.taskDraft = { title: selectedText.slice(0, 180), steps: [], source: cleanUrl(info.pageUrl || ''), due: '', selectedText }; await save();
  });
});
chrome.runtime.onStartup.addListener(() => { void serial(async () => { if (state.session && state.session.phase !== 'finished') { state.session.away = true; settle(state.session); transition(state.session, 'paused'); event(state.session, 'browser-restored'); await save(); } }); });
void ready.then(() => observe(true));
