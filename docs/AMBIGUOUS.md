# Ambiguous team chat → Tabby focus → thread reply

Tabby connects to **https://app.ambiguous.ai/mcp** using the official MCP SDK and Streamable HTTP. Choose a team message, review and save a task, focus on it, then review and explicitly send a factual session report to the original thread. Browsing chat, drafting without AI, and preparing reports do not call GPT Tunnel. DeepSeek remains the default for optional AI features.

## Connect on your computer

1. Use Node.js 24.x. Complete the existing `npm run setup` and local pairing-token setup. Build with `npm run build`, then reload Tabby in `chrome://extensions`.
2. Restart **your local Tabby server** with the updated source: `npm run server`. Do not launch a second process on occupied port 4318. The extension ZIP does not include this server.
3. In Tabby, open **Ambiguous → Connect Ambiguous**. Finish sign-in and consent in the Ambiguous tab. No API key needs to be pasted into Tabby. Wait for the connection status to update, then click **Load channels** and choose a channel.
4. Click **Review task** on a message. Edit the title, steps and project, then **Save task**. A message is not saved as a task just by reading it. Re-importing the same message is blocked.
5. Use **Focus on this → Start focusing**, then **Stop session** when finished. Mark the task done separately if it is complete. In **Insights**, click **Share to Ambiguous**, or open **Ambiguous → Completed focus sessions → Review session report**.
6. Review/edit **Session report** and click **Send report to Ambiguous**. The destination is the original message's thread; it cannot be replaced by chat instructions. A top-level message becomes the thread root. The report is never sent automatically on timer completion.

OAuth uses discovery, dynamic registration, PKCE S256 and a one-use callback bound to `127.0.0.1` on an ephemeral port. Sign-in expires after five minutes. Ambiguous currently advertises scope `*`; the consent screen governs account access. Tabby only invokes the three chat operations below. OAuth credentials stay in `.local/ambiguous-oauth.json` with owner-only permissions. They are not sent to Chrome, MCP clients of Tabby, sync, logs or the extension ZIP. **Disconnect** cancels pending sign-in, removes saved OAuth credentials, requests revocation and clears chat snapshots; confirmed tasks remain.

An existing Ambiguous API key is an alternative: set `AMBIGUOUS_API_KEY` in the server's private `.env`, restart the server and click **Connect Ambiguous**. This key takes precedence over OAuth. Disconnect disables the extension integration; remove an environment API key from `.env` and restart the server to remove that server credential. Never use an Ambiguous key as Tabby's pairing token or GPT Tunnel key.

## Transport and contract

| MCP operation | REST equivalent | Use |
| --- | --- | --- |
| `list_channels` | `GET /api/channels` | Read visible channels |
| `get_channel_messages` | `GET /api/channels/{channel_id}/messages` | Read a selected channel; 50 messages per page |
| `send_message` | `POST /api/channels/{channel_id}/messages` | Post reviewed `content` with original `thread_id` |

Tool names and input properties are checked using `tools/list`, including paginated discovery. The endpoint is fixed to Ambiguous; messages cannot specify a different server or execute arbitrary tools. A missing tool or invalid response produces an explicit error. `AMBIGUOUS_TRANSPORT=rest` selects the documented REST adapter with `API-Version: 1`; it is an explicit alternative, not an automatic write fallback.

Sources: [Ambiguous MCP setup](https://www.ambiguous.ai/agents/mcp), [REST API](https://www.ambiguous.ai/agents/api), [published OpenAPI contract](https://app.ambiguous.ai/api/openapi.json), [chat capabilities](https://www.ambiguous.ai/applications/chat).

The local `/ambiguous/*` API shares port 4318 and retains exact Host, extension Origin and pairing-token validation. Tabby's separate local **stdio MCP server** still uses port 4319. Ambiguous is an outbound remote MCP connection; it does not expose the user's computer publicly or make Tabby's stdio server remotely accessible.

## Delivery, data and limits

- A message snapshot is valid for task drafting for five minutes. Report previews expire after fifteen minutes. Channels are capped at 500; message pages at 50; each message/report at 6,000 characters. Attachments and full thread expansion are not imported.
- Imported task provenance and raw chat snapshots stay in `chrome.storage.local`. Optional Chrome sync may sync the **confirmed task's text**; it excludes channel/message IDs, raw chat snapshots, session history and credentials. Local provenance survives incoming task edits, but another computer cannot send a report for a source connection it did not import.
- Reports contain observed intervals, the goal, reminders, returns, the last confirmed step and task completion only when confirmed during that session. They contain no automatic AI recap, browsing URLs, note bodies or unrelated tasks. Changing goals during a session is disclosed in the report. Users can edit everything before sending.
- Each session's UUID identifies its single report intent. `.local/ambiguous-receipts.json` persists a content/destination hash **before** the remote write and records successful message IDs. Concurrent/repeated requests replay the result; changed requests are rejected. No report content or credentials are stored in this journal. Keep it when restarting the server.
- Ambiguous's chat contract does not document a general message idempotency key. If a write may have reached Ambiguous but its result is lost, Tabby records **unconfirmed delivery** and does not retry. Check the original thread; the report remains available to copy manually. The UI does not claim failure means nothing was sent. A worker restart during a send is also treated conservatively. Journal corruption/capacity (5,000 attempts) stops further writes rather than dropping duplicate protection.
- Adding `app.ambiguous.ai` to excluded sites clears snapshots and blocks reads/import/report actions. Explicit **Refine with AI** uses the normal AI consent and shares the selected draft text with the configured provider.

## Verification and remaining live check

```sh
npm run check
npm test
npm run build
npm run test:ambiguous
```

`tests/ambiguous.test.ts` checks OAuth through real ephemeral callback listeners against fixture auth endpoints, actual SDK HTTP transport, documented REST responses, response allowlists, fixed destinations, persisted retries, unknown delivery, HTTP authorization, worker cancellation/recovery and sync provenance.

`npm run test:ambiguous` runs an isolated real Chrome profile through **extension → authenticated local HTTP → official SDK MCP → test chat server**. Only the local server port changes in a temporary copy of the production bundle. It tests explicit reads, draft review/save, stale drafts, real focus completion, edited report sending, no duplicate retry, lost replies, persistence, exclusions/disconnect and 390px/desktop layouts. It does not touch the user's server, browser profile or real team chat. Results: `artifacts/ambiguous-browser-results.json`; screenshots use the `tabby-ambiguous-*-fixture.png` suffix.

The public endpoint, published contract and OAuth metadata were inspected. **Live extension OAuth/MCP authorization and real team-chat delivery remain unverified**: the extension's OAuth connection was not authorized during these tests. These fixture results must not be presented as live chat delivery. The video continues to show previously working focus features.

Separately, a signed-in Ambiguous browser workspace was used for actual final-delivery work: the Tabby — Hackathon project and TASK-001 record the website ZIP verification, its result and completion. See [the hackathon walkthrough](AMBIGUOUS_DEMO.md). This is verified use of Ambiguous's project/task UI, distinct from the extension's pending live MCP account check.
