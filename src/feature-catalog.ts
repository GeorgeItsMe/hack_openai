import {
  Archive, BarChart3, BellOff, CalendarDays, CheckCheck, Cloud, Copy,
  FileText, FolderOpen, Globe2, Inbox, ListTodo, Mail, MessageCircle,
  MousePointer2, Network, Pin, RotateCcw, Search, ShieldCheck, Sparkles, Timer,
} from 'lucide-react';

export const mcpTools = [
  { name: 'tabby_get_session', description: 'Read the current goal, task, project, focus phase, and remaining time.' },
  { name: 'tabby_list_tasks', description: 'Read saved tasks, optionally filtered by status or project.' },
  { name: 'tabby_list_tabs', description: 'Read ordinary tabs in the connected Chrome profile, with cleaned URLs.' },
  { name: 'tabby_create_task', description: 'Create a task with steps, an optional due date, and a project.' },
  { name: 'tabby_complete_task', description: 'Mark an existing task done. Task changes need separate permission.' },
];

export const featureGroups = [
  {
    id: 'tasks', label: 'Tasks & projects',
    description: 'In the developer extension: a home for tasks, notes, and useful links. Chrome workspace sync is optional; the website demo keeps its own smaller task list.',
    items: [
      { icon: ListTodo, title: 'A task with a little more detail', description: 'Create and edit a title, up to eight steps, a due date, a source link, and a project. Move between Planned, In progress, and Done, or reopen a completed task.', tag: 'TASK EDITING & STATUS' },
      { icon: MousePointer2, title: 'Any selected text → a task', description: 'Capture a passage from a webpage. Ask AI for an editable draft and steps; an AI-suggested due date needs explicit source evidence. Review before saving.', tag: 'CAPTURE & REFINE' },
      { icon: Timer, title: 'Turn a to-do into focus', description: 'Start a focus session from a task. Its project is recorded on the session so your insights can follow the work.', tag: 'TASK-BASED FOCUS' },
      { icon: Archive, title: 'A home for every project', description: 'Create and edit projects, assign tasks, and keep their notes and links together. Archive a project without losing its contents, then restore it when you need it.', tag: 'PROJECTS & ARCHIVING' },
      { icon: FileText, title: 'Keep the thought, too', description: 'Write and edit multiline notes inside a project. Notes stay with the project; deleting one asks for confirmation.', tag: 'PROJECT NOTES' },
      { icon: Pin, title: 'Close the tab. Keep the thread.', description: 'Save a useful tab as a project link and reopen it later. Tabby switches to a matching open tab or opens the saved, cleaned URL when you ask.', tag: 'SAVED PROJECT LINKS' },
      { icon: Cloud, title: 'Your little workspace, in Chrome', description: 'Opt in to Chrome account sync for projects, tasks, notes, and saved links. Timers, history, connections, and permissions stay local. Delivery depends on Chrome sync and its storage limits.', tag: 'OPTIONAL CHROME SYNC' },
      { icon: BarChart3, title: 'Look beyond today', description: 'Explore 7-, 30-, or 90-day reports, filter by project, and export JSON. See daily observed time, task completions, reminders, returns, and your longest session.', tag: 'PROJECT REPORTS & EXPORT' },
    ],
  },
  {
    id: 'focus', label: 'Focus & tabs',
    description: 'Your sidekick alongside your real tabs. Context-aware assessment, group suggestions, next steps, and recaps use your configured AI connection.',
    items: [
      { icon: Sparkles, title: 'Focus that understands your goal', description: 'Assess a page against your task, get a reason, and correct the AI when it misses the point. The same website can be useful for one goal and distracting for another.', tag: 'CONTEXT-AWARE AI' },
      { icon: BellOff, title: 'Distractions, gently handled', description: 'Choose a soft reminder or a reversible cover. Return to work, take a break, or keep browsing. You control analysis, page-text access, and excluded sites.', tag: 'SOFT & STRICT MODES' },
      { icon: Search, title: 'Find that one open tab', description: 'Search tabs in the current window by title or address, then jump straight to the page you need.', tag: 'SEARCH & SWITCH' },
      { icon: FolderOpen, title: 'A little order in the tab strip', description: 'Let AI suggest related tabs and group names. Review the suggestion, then create real Chrome tab groups.', tag: 'SMART TAB GROUPING' },
      { icon: Copy, title: 'One less duplicate', description: 'Spot tabs with the same full address and choose which extras to close. Active and pinned tabs are protected, and a copy stays within reach.', tag: 'DUPLICATE CLEANUP' },
      { icon: Timer, title: 'Deep work, at your pace', description: 'Set your focus length, pause, resume, and take a timed break. Closing the panel preserves the session; finishing a break waits for you to continue.', tag: 'FOCUS & BREAK TIMERS' },
      { icon: RotateCcw, title: 'Pick up the thread', description: 'Come back to your goal, saved working tabs, and last confirmed step. Ask AI for one next move.', tag: 'RESUME & NEXT-STEP HELP' },
      { icon: BarChart3, title: 'See where your time went', description: 'Review focus, distractions, uncertain context, breaks, pauses, and time away, plus reminders, returns, and an optional AI session recap.', tag: 'SESSION INSIGHTS' },
    ],
  },
  {
    id: 'connections', label: 'AI & Google',
    description: 'Implemented in the local extension. DeepSeek AI is included; enable it once in Tabby. Google needs separate OAuth setup and consent; the live Google account sign-in flow is still awaiting verification.',
    items: [
      { icon: MessageCircle, title: 'Think it through with Tabby', description: 'Keep an ongoing chat about your tasks and goal. Use suggested prompts, get replies in your language, cancel a response, retry, or clear the saved conversation.', tag: 'PERSISTENT AI CHAT' },
      { icon: CheckCheck, title: 'A suggestion you can act on', description: 'Chat can propose creating a task, completing an existing task, or starting focus. Each action appears as a card for your confirmation; an applied card cannot run twice.', tag: 'CONFIRMED CHAT ACTIONS' },
      { icon: CalendarDays, title: 'A calmer view of the next two weeks', description: 'Read the next 14 days from your primary Google Calendar, see the next meeting, open an event, or import it as a task. The agenda refreshes while open; it does not edit events.', tag: 'GOOGLE CALENDAR · SETUP REQUIRED' },
      { icon: Mail, title: 'An email becomes a next step', description: 'View your latest 20 Gmail inbox previews. Import a message as a task or request an AI draft to review. Repeat imports reuse the task; Tabby does not send mail or mark it read.', tag: 'GMAIL TASKS · SETUP REQUIRED' },
      { icon: CalendarDays, title: 'Plan around the day you shared', description: 'Choose whether to include a fresh calendar snapshot in chat. It is off by default. An email preview goes to AI only through that message’s AI draft action.', tag: 'OPTIONAL CALENDAR CONTEXT' },
    ],
  },
  {
    id: 'mcp', label: 'MCP',
    description: 'Five tools connect a local stdio MCP client to the installed extension. The SDK client is verified; Claude Desktop has configuration instructions. Cloud-hosted ChatGPT cannot directly reach this local bridge.',
    items: [
      { icon: Network, title: 'Your assistant, up to speed', description: 'Read the live focus session, saved tasks, and ordinary tabs. Task reads support status and project filters. Private, internal, and excluded tabs stay out.', tag: 'MCP · 3 READ TOOLS' },
      { icon: ListTodo, title: 'From a conversation to a saved task', description: 'With separate task-write permission, your connected assistant can create tasks and mark them done. A task can include steps, a due date, and a project.', tag: 'MCP · 2 TASK ACTIONS' },
      { icon: ShieldCheck, title: 'Connected, with clear boundaries', description: 'MCP reading and task changes have separate switches. Task writes need no extra in-panel click once enabled. Retries avoid duplicate actions. MCP itself makes no AI-provider calls and never exports notes, page text, or connection keys.', tag: 'MCP ACCESS & RETRY PROTECTION' },
    ],
  },
  {
    id: 'demo', label: 'Try on this page', description: 'No install or account needed. A real little workspace to explore, with your tasks saved in this browser. Projects, connected apps, AI chat, and MCP belong to the extension.',
    items: [
      { icon: ListTodo, title: 'Get it out of your head', description: 'Add, search, filter, complete, and delete tasks. They stay here when you return to this browser.', tag: 'LOCAL TASK LISTS' },
      { icon: Timer, title: 'Make a little time', description: 'Try a 5, 25, or 45 minute focus session. Pause, resume, and reset whenever you need to.', tag: 'WORKING FOCUS TIMER' },
      { icon: FolderOpen, title: 'Try a calmer workspace', description: 'Explore three example tab spaces with working links. Your actual browser tabs stay under your control.', tag: 'EXAMPLE TAB SPACES' },
      { icon: CheckCheck, title: 'Notice your little wins', description: 'See completed tasks and finished focus sessions reflected in your preview’s progress view.', tag: 'LIVE PREVIEW PROGRESS' },
    ],
  },
  {
    id: 'roadmap', label: 'Coming next', description: 'Still on the roadmap: broader app connections and automatic collection. The current Google tools import only the items you choose.',
    items: [
      { icon: Inbox, title: 'More of your everyday tools', description: 'Planned task connections for Notion, Linear, Todoist, and TickTick, alongside the Google tools in the developer extension.', tag: 'MORE APP CONNECTIONS' },
      { icon: Globe2, title: 'Catch the to-dos in the conversation', description: 'Bring actionable messages from Slack, Telegram, and WhatsApp into your task list through connected services.', tag: 'MESSENGER INBOX' },
      { icon: Sparkles, title: 'Tasks that come to you', description: 'Automatic background collection across connected apps. Today, webpage capture and Google imports start with your choice.', tag: 'AUTOMATIC TASK COLLECTION' },
    ],
  },
];
