# Projects, workspace sync and insights

## Project workspace

Create or edit a project in **Projects**. Tasks can be assigned to a project from the task editor, or created directly inside the project. Starting focus from a task saves its project ID on the session. Changing the session goal/task updates that attribution; subsequently moving a task does not rewrite past session history.

Projects contain multiline plain-text notes and pinned tabs. Pinning stores a cleaned HTTP(S) URL and page title; it does not pin a Chrome tab in the tab strip. Query strings and fragments are removed using Tabby's existing privacy rules, except supported YouTube video identifiers. Search-result URLs may therefore reopen without their original query. Opening a saved link is always an explicit action: Tabby activates an existing matching tab or opens the saved URL. Private, internal and excluded sites cannot be pinned or reopened.

Archive a project to hide it from active project selection while keeping its tasks, notes and links. Restore it to add or edit notes. Note removal asks for confirmation and retains a deletion marker for sync. Saved tab removal also retains a marker. Deletion clears the note body or saved URL; markers retain only identity and deletion metadata plus a generic label. Limits are 100 projects, 500 tasks, 500 note records and 500 saved tab records (including deletion markers). Exceeding a limit reports an error; older data is never silently dropped.

## Chrome account sync

Enable **Settings → Workspace sync → Sync workspace with Chrome** on each computer, with Chrome sync enabled for the same account and the same extension ID. Sync is off by default. [Chrome storage documentation](https://developer.chrome.com/docs/extensions/reference/api/storage).

Tabby sends only project, task, note and saved-link records to `chrome.storage.sync`. Notes and user-authored text are included as entered; do not enable this option for content you intend to keep only on the device. Pairing/MCP tokens, AI consent, account connections, live tab IDs, current timers, session history and analytics remain local.

Records have stable IDs and update timestamps. Concurrent changes to different records merge independently. For a single record, the newest timestamp wins; equal timestamps use a deterministic content comparison. This is last-write-wins sync, not collaborative text editing or version history. Keep device clocks reasonably aligned. A record dated over five minutes into the future is rejected. Deleted notes and links use retained markers so older copies cannot restore them.

Sync runs shortly after an edit, after a remote storage event, on worker startup and every five minutes while enabled. It checks per-item and total capacity before publishing. The Chrome API imposes item, total storage and write-rate quotas. Large workspaces or non-ASCII notes can exceed capacity. Tabby shows the error and preserves local data; it does not truncate content. Shorten affected notes or disable sync. Sync is intended for a small personal workspace.

**Saved to Chrome sync storage** confirms a successful local Chrome storage operation. It does not prove delivery to another computer or that Chrome is signed in. This release verifies real Chrome storage operations and a simulated second-device record, not real cross-account or cross-machine delivery.

Disabling sync leaves both copies intact. Clearing local data turns sync off and does not remove the remote copy. **Remove data from Chrome sync** disables sync on this computer and removes Tabby's sync keys while preserving local records. Turn off Tabby sync on other computers first; otherwise they can republish their local copies. Re-enabling sync merges existing local and remote records again.

## Extended insights

Insights supports rolling 7-, 30- and 90-day periods, project filters, daily totals, completed task counts, reminders, returns, longest observed session and a JSON report export.

- **Observed time:** on-track + distracting + unknown time, excluding breaks, pauses and absence.
- **Classification coverage:** classified time divided by observed time.
- **On track / classified time:** on-track time divided by classified time. Unknown time does not count as either productive or distracting.
- **Completed tasks:** tasks currently marked done with a completion timestamp inside the period.

Sessions are grouped by their start date in local time. A session crossing midnight belongs to its start day. Filtering uses session start timestamps, not an invented day-by-day subdivision. The store retains up to 100 previous sessions, so long-range reports can be incomplete. Older sessions without a project ID appear only under All projects. Reports are factual summaries of recorded intervals, not proof of productivity; no extra AI calls are made.
