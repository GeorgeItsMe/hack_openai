import type { AppState, Task } from './types';
import { createSession, event } from './engine';
import { chatActionSchema, type ChatProposal } from './workspace';

export function applyProposal(state: AppState, proposal: ChatProposal, now = Date.now()): boolean {
  if (proposal.state !== 'pending') return false;
  if (now - proposal.createdAt > 30 * 60000) throw new Error('PROPOSAL_EXPIRED');
  const action = chatActionSchema.parse(proposal.action);
  if (action.type === 'create_task') {
    if (state.tasks.length >= 500) throw new Error('TASK_LIMIT');
    const task: Task = { id: crypto.randomUUID(), title: action.title, steps: action.steps, due: action.due, source: '', status: 'planned', createdAt: now, updatedAt: now };
    state.tasks.unshift(task);
  } else if (action.type === 'complete_task') {
    const task = state.tasks.find(t => t.id === action.taskId);
    if (!task || JSON.stringify(task) !== proposal.taskSnapshot) throw new Error('TASK_CHANGED');
    if (task.status !== 'done') {
      task.status = 'done'; task.completedAt = now; task.updatedAt = Math.max(now, (task.updatedAt || 0) + 1);
      if (state.session) event(state.session, 'task-completed', task.title, now);
    }
    if (state.session?.taskId === task.id) { state.session.revision++; state.session.category = 'unknown'; state.session.corrections = {}; state.session.workTabs = []; state.assessment = null; }
  } else {
    if (state.session && state.session.phase !== 'finished') throw new Error('SESSION_ALREADY_RUNNING');
    if (action.taskId && !state.tasks.some(t => t.id === action.taskId && JSON.stringify(t) === proposal.taskSnapshot)) throw new Error('TASK_CHANGED');
    const session = createSession(action.goal, action.taskId, action.minutes, now);
    if (state.session) state.history = [state.session, ...state.history].slice(0, 100);
    session.ambiguous = state.tasks.find(t => t.id === action.taskId)?.ambiguous;
    session.projectId = state.tasks.find(t => t.id === action.taskId)?.projectId;
    state.session = session; state.page = null; state.assessment = null;
  }
  proposal.state = 'applied'; return true;
}
