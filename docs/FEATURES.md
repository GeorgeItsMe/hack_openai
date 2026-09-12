# Tabby feature coverage

Audited on September 12, 2026 against the current extension implementation. The landing presents eight main use cases and a 31-entry catalog: 24 implemented extension capabilities, four website-preview capabilities, and three roadmap areas. These are catalog entries, not individual command counts. Vercel serves only the landing; extension installation and optional local connections are separate steps.

## Tasks and projects — eight entries

| Capability | Implementation and limits | Landing coverage |
| --- | --- | --- |
| Create and edit tasks | Title, up to eight steps, due date, source URL, project, Planned/In progress/Done, reopening. Preview search/delete controls are not advertised as extension task controls. | Project card, Tasks & projects catalog, task FAQ |
| Capture selected text | Webpage selection; optional AI extraction gives an editable draft. AI dates need source evidence. | Capture card, catalog, capture FAQ |
| Focus from a task | Start a session with a task and preserve project attribution. | Timer/project cards, catalog |
| Projects | Create, edit, archive and restore; group tasks, notes and saved links. | Project card, catalog, task FAQ |
| Project notes | Multiline notes, editing, confirmed deletion. | Project card, catalog, task FAQ |
| Saved project links | Save cleaned ordinary tab URLs; explicitly reopen or switch to a matching tab. This is distinct from Chrome tab-strip pinning. | Project card, catalog, task FAQ |
| Optional Chrome sync | Projects, tasks, notes and saved links through chrome.storage.sync. Timers, history, connections and permissions remain local. Same Chrome account/extension ID required; storage limits apply. | Catalog, sync FAQ, installation guide |
| Project reports and export | 7/30/90-day ranges, project filter, daily observed time, completed tasks, reminders, returns, longest session and JSON export. At most 100 previous sessions retained; long reports can be incomplete. | Insights card, catalog, insights FAQ |

Sources: `src/extension/panel.tsx`, `projects-view.tsx`, `workspace-worker.ts`, `worker.ts`; `src/shared/projects.ts`, `sync.ts`, `analytics.ts`.

## Focus and tabs — eight entries

| Capability | Implementation and limits | Landing coverage |
| --- | --- | --- |
| Context-aware assessment | AI assesses allowed context against the goal; users can correct it. Requires configured AI, consent and site access. | Context card, Focus & tabs catalog, context FAQ |
| Soft and strict modes | Gentle reminder or reversible cover; exclusions and separate page-text consent. | Context card, catalog, context FAQ |
| Tab search/switch | Search title/address in the current window and switch. | Tabs card, catalog, tabs FAQ |
| AI tab groups | Review suggestions before creating Chrome groups. | Tabs card, catalog, tabs FAQ |
| Duplicate cleanup | Exact full-URL duplicates; selected extras, protecting active/pinned tabs. | Tabs card, catalog, tabs FAQ |
| Focus/break timers | Configurable duration, pause/resume, timed breaks. Panel closure preserves state; returning from a finished break is explicit. | Timer card, catalog, break FAQ |
| Resume/next step | Goal, working tabs, confirmed step and optional AI next-step help. | Timer card, catalog, break FAQ |
| Session insights | Observed categories, breaks, pauses, away time, reminders, returns and optional AI recap. Observed time is not proof of productivity. | Insights card, catalog, insights FAQ |

Sources: `src/extension/worker.ts`, `panel.tsx`, `content.ts`; `src/shared/engine.ts`, `privacy.ts`; `src/server/provider.ts`.

## AI and Google — five entries

| Capability | Implementation and limits | Landing coverage |
| --- | --- | --- |
| Persistent AI chat | Saved conversation, suggested prompts, response language, cancellation, retry and clear. Provider setup/consent required. | AI & Google catalog, chat FAQ |
| Confirmed chat actions | Propose task creation, completion or focus start. User confirmation and replay/stale-action protection; cannot replace active focus. | Catalog, chat FAQ |
| Google Calendar | Primary calendar's next 14 days, next meeting, event links, selected task imports, refresh while open. No event writes. | Collection card, integrations, catalog, Google FAQ, guide |
| Gmail tasks | Latest 20 inbox previews; chosen import or AI draft reviewed before saving. Duplicate imports reuse task. No sending, marking read, attachments or full-body reader. | Collection card, integrations, catalog, Google FAQ, guide |
| Optional calendar context | Separate opt-in for a fresh calendar snapshot in chat. Email preview goes to AI through its draft action. | Catalog, chat/Google FAQs |

Sources: `src/extension/workspace-panels.tsx`, `workspace-worker.ts`; `src/shared/workspace-actions.ts`; `src/server/google.ts`, `provider.ts`. Google requires desktop OAuth configuration and a local server. Fixtures cover UI/protocol; a real Google sign-in/data cycle remains unverified.

## MCP — three catalog entries, all five tools

The MCP card, catalog, two FAQs and installation-guide accordion cover reads, task actions and access controls. MCP is absent from the roadmap and Plus-only list.

| Registered tool | What the landing says |
| --- | --- |
| `tabby_get_session` | Read live goal, task, project, phase and remaining time. |
| `tabby_list_tasks` | Read saved tasks, optionally filtered by status or project. |
| `tabby_list_tabs` | Read ordinary tabs across windows in the connected profile with cleaned URLs. Private, internal and excluded tabs are omitted. |
| `tabby_create_task` | Create a task with steps, optional due date and project. |
| `tabby_complete_task` | Mark an existing task done. |

Reading is opt-in; writes require a separate switch. Enabled MCP writes need no extra in-panel confirmation. Request IDs protect against duplicate retries; conflicting reuse is rejected. MCP exports no note text, page text or credentials, and makes no AI-provider calls itself.

Sources: `src/shared/mcp.ts`, `src/mcp/index.ts`, `broker.ts`, `src/extension/mcp-bridge.ts`, `workspace-worker.ts`. The local stdio SDK client is verified. Claude Desktop setup is documented, but its application UI was not tested. Cloud-hosted ChatGPT cannot directly reach the local bridge. See [MCP setup](MCP.md).

## Website preview and roadmap

**Try on this page** contains four preview capabilities: local task add/search/filter/complete/delete; 5/25/45-minute timer; three example tab spaces; completion/session progress. Its storage is separate from the extension and it cannot read real Chrome tabs. Source: `src/Workspace.tsx`.

**Coming next** and Plus contain three unfinished areas: app connections (Notion, Linear, Todoist, TickTick); messenger inboxes (Slack, Telegram, WhatsApp); automatic background task collection. Current capture and Google imports are user initiated.

Context-switch examples, the project card and weekly chart are labeled illustrations. The footer humor, including “Made with care, and probably too many tabs,” is preserved.

## Verification for this audit

- Extension TypeScript, extension build and 39 unit/schema/protocol tests passed.
- `npm run test:workspace`: seven real Chrome + official MCP SDK scenarios passed: persisted projects/tasks/notes/links, all five tools, separate permissions, retries, exclusions, sync merging and worker restart. No AI calls.
- `npm run test:google-chat`: seven Chrome UI scenarios passed with explicit Google/AI fixtures: imports, confirmations, replay protection, opt-in context, cancellation, exclusions and disconnect. This is not live Google/model verification.
- Chrome sync storage and simulated remote-record merging were checked; delivery between two signed-in computers remains unverified.

The catalog lives in `src/feature-catalog.ts`. Descriptions of the reference product at [TabAI](https://tabai.dev/) do not establish implementation in Tabby.
