# Mission Mode

Tabby is a personal productivity agent for work in Chrome. Its job is to turn an intention into a manageable sequence and keep the next step visible while you work.

## Try it

1. Install the latest [Tabby.zip](https://tabby-pi.vercel.app/downloads/Tabby.zip), open the side panel and choose **Enable AI**. Existing cloud users can start immediately.
2. Open useful resources, such as a React reference and your editor. In **Mission**, enter **Build and test a React login form** and choose 25 minutes.
3. Choose **Plan my mission**. Inspect the proposed steps, finish criteria and selected tabs. No tasks, groups or session are created yet.
4. Choose **Start this plan**. Tabby creates the linked tasks, optionally groups the selected tabs in orange, opens the first resource and starts focus.
5. Work on the current step. **I’m stuck** asks DeepSeek for one smaller action. Open a step's resource or suggested search when useful. Focus details provides site permissions for page text and in-page reminders.
6. Choose **Mark step done** when its criterion is met. Tabby updates the goal and task used for context assessments, keeping the same timer. The mission finishes when every step is confirmed.

For a short demo, show plan approval, the actual Chrome tab group and linked Tasks, a detour and return, a smaller action, then one confirmed step. Do not describe a fixture response or a suggested search as live research.

## Agent loop and implementation

`src/shared/mission-schema.ts` defines the bounded AI contract: one to five steps, a 5–180 minute budget, concrete instructions, observable finish criteria, supplied tab IDs and optional search queries. Both the server provider and worker validate the response, including time estimates and tab membership. New cloud imports must retain `.js` runtime specifiers for Node ESM.

`src/extension/mission-worker.ts` snapshots eligible tabs from the current window and coordinates planning, coaching and approved browser actions through the existing serialized worker. Start preflights every selected tab before changing the workspace. The accepted mission ID, tasks and session are persisted before grouping, so retries do not duplicate tasks or reapply a browser operation after an uncertain interruption. Partial browser failures have an explicit activity record.

`src/shared/missions.ts` links steps to real task IDs. Confirmations from Mission, Tasks, chat or an authorized MCP client converge through the worker's save hook. Updating the active step invalidates old page assessments. A completed mission preserves its historical record; stopping keeps incomplete work. Closing the panel or restarting the service worker preserves the mission. The timer expiring never completes a step.

`src/extension/mission-view.tsx` is the default screen. Focus remains available for ordinary sessions and detailed site controls. Mission records stay in local extension storage; linked tasks follow the existing optional Chrome sync policy. Full mission records and activity are not synced or exposed as a new MCP interface.

## Current boundaries

- Planning uses the user goal and eligible open tab titles and cleaned URLs. Private, pinned, excluded and internal browser tabs are omitted. Page text is a separate focus permission.
- Tabby does not fetch search results, research the web autonomously, write code in an editor or judge whether an external deliverable is correct. Search buttons open the suggested query only after a click.
- Completion means the linked steps were confirmed. Session time and a relevance assessment are observations, not proof of completed work.
- Plan approval covers linked task creation, the displayed tab grouping and starting focus. It never closes tabs or sends messages to external accounts.
- One mission runs at a time. Plans expire after 15 minutes. Up to ten earlier missions and sixty recent activity entries are retained. Deleted linked tasks require a new plan; completed missions remain a historical snapshot if a task is later reopened.
- DeepSeek `deepseek-v3.2` through GPT Tunnel is unchanged. Cloud AI needs internet access and respects the existing fair-use limits. Local AI users must restart their updated companion to support the new `mission` request kind.

## Verification

```sh
npm run build
npm test
npm run test:missions
```

The mission browser suite runs a real extension, HTTP boundary, Chrome tab groups, storage, task transitions and in-page nudges with explicitly identified model fixtures. It checks consent, reviewed actions, duplicate Start, changed tabs, stale task edits, coaching, timer preservation, confirmed completion and late-response cancellation.

The separate `tests/mission-live-browser.ts --live` check uses the published ZIP and paid shared DeepSeek service with a synthetic goal. It records actual plan/model results and confirms UI transitions; those confirmations do not claim that a real external project was completed.
