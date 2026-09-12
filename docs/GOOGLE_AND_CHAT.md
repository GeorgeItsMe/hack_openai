# Google Calendar, Gmail and AI chat

This is the local Tabby extension, not the landing-page demo. Google integration requires a Google Cloud OAuth client and the running local Tabby server. The AI model remains `deepseek-v3.2` through GPT Tunnel.

## Connect Google

1. In [Google Cloud](https://console.cloud.google.com/apis/credentials), select a project and enable **Google Calendar API** and **Gmail API**.
2. Configure the Google Auth Platform consent screen. For an external app in testing, add the Google account you will use as a test user. Choose an appropriate publishing/verification path before distributing to other users.
3. Create an OAuth client of type **Desktop app** and download its JSON file. This server uses Google's desktop loopback flow with PKCE; a Chrome-extension client is a different flow and is not interchangeable.
4. From this repository, run:

   ```sh
   npm run setup:google -- /absolute/path/to/downloaded-client.json
   ```

   The helper stores only the needed client credentials in `.local/google-client.json` with owner-only file permissions. It does not print them or change the AI provider configuration. Alternatively, the server accepts `GOOGLE_OAUTH_CLIENT_FILE`, or `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from `.env`.
5. Restart your existing `npm run server` process. Do not start a second server on 4318. Run `npm run build`, then reload Tabby in `chrome://extensions`.
6. Save your normal Tabby pairing token in **Settings** if you have not already done so. Open **Calendar & mail**, connect **Google Calendar**, and finish Google's account/consent screen. Return to the panel; connection status is polled while sign-in is pending. Connect **Gmail** separately if desired.

`npm run setup:google -- --help` prints setup instructions without reading credentials. If Google shows an API-disabled or scope error, enable the corresponding API and reconnect. Google may require renewed consent while a project is in testing; Tabby refreshes valid tokens and reports when reconnection is required.

## What is implemented

- **Calendar:** the next 14 days from the primary calendar, at most 250 expanded events, all-day events, local display times, next meeting, original event links, task import and a refresh button. Calendar refreshes every five minutes while this screen remains open. A capped response is labelled. It is a read-only agenda, not a calendar editor or operating-system reminder service.
- **Gmail:** the latest 20 inbox messages, their subject, sender and short snippet, original message links, one-click task import and an AI task draft. Full bodies and attachments are not fetched. Import does not send mail or mark it read. Re-importing an already imported item returns the existing task.
- **AI chat:** persisted conversation, suggested prompts, responses in the user's language, cancel/retry, and cards to create tasks, complete an existing task or start a focus session. Every card requires a user click. Applied cards cannot execute twice; task edits invalidate old completion proposals, and proposals expire after 30 minutes. An active focus session is never replaced by a card.
- **Calendar context in chat:** off by default. The checkbox shares up to 50 cached events only when the snapshot is less than 15 minutes old and the last sync succeeded. Refresh Calendar if it is stale. Gmail snippets are sent to AI only through the selected email's **AI draft** action. Task titles saved by the user can subsequently be part of normal chat/task context.

## Data and architecture

The extension worker owns Google display snapshots and chat under `chrome.storage.local.app`. The Node server stores only Google credentials in `.local/google-tokens.json` (owner-only permissions), with atomic updates; no access/refresh token is returned to the extension. Existing website exclusions apply to importing and sharing Google data. Excluded-source tasks are omitted from chat context.

Authenticated `POST /google/status`, `/google/connect`, `/google/calendar`, `/google/gmail`, `/google/cancel` and `/google/disconnect` use the **same exact Host, extension Origin and pairing-token checks** as `/ai`. OAuth callbacks use a separate temporary loopback listener on a random port with one-use state, PKCE and a five-minute expiry. No unauthenticated callback exception was added to `/ai` or the server on 4318.

Calendar requests only `calendar.events.readonly`; Gmail requests `gmail.readonly`. Google sign-in and reads do not invoke the AI model. AI still requires the extension's analysis consent. Chat proposals are validated through Zod on the server and again in the worker; there is no arbitrary tool execution, email sending or calendar writing.

**Disconnect Google** clears Google snapshots and chat, removes server-side credentials and attempts Google revocation. User-confirmed tasks remain. If revocation fails due to connectivity, remove the application's access in your [Google account connections](https://myaccount.google.com/connections). Disconnect Google before using **Clear local data** if you also want to remove credentials on the local server; clearing extension storage alone cannot remove an offline server's files. OAuth credentials and chat are not included in Chrome workspace sync.

## Verification and limits

Verified in this pass: TypeScript check, 39 unit/protocol tests, production build, seven Google/chat browser scenarios, native Side Panel smoke, ZIP integrity and a check that configured local credentials are absent from the extension bundle. The legacy `test:browser` suite was not rerun because the existing user server occupied 4318; the new tests use isolated profiles and leave it running.

```sh
npm run check
npm test
npm run build
npm run test:google-chat
npm run test:smoke
```

`tests/google.test.ts` uses real temporary loopback listeners and mocked Google endpoints to verify PKCE, state rejection, token persistence, denied consent, disconnection races and authenticated HTTP routes. `tests/chat.test.ts` verifies schemas, task identity checks, replay prevention and provider behavior.

`test:google-chat` runs the actual production extension in a private temporary Chrome profile, injecting explicit Google/AI fixtures into its worker. It exercises import, AI drafting, review, persistence, optional context, cancellation and disconnect. It never stops the existing server or opens the demo profile. Screenshots with `fixture` in their names and `artifacts/google-chat-browser-results.json` are **not live Google verification**.

`node --import tsx scripts/live-chat.ts` makes **one potentially paid completion** using a synthetic Russian task request. Its report is `.local/live-chat-report.json`; it contains no Google data or provider credentials. A successful run confirms the model returned a validated chat proposal, not the Google connection.

This implementation was built and tested without a configured Google OAuth client/account. The full live Google consent and account-data cycle remains to be verified after setup. Notion and Slack are not implemented by this change.

Official references: [Google desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app), [Calendar events.list](https://developers.google.com/workspace/calendar/api/v3/reference/events/list), [Gmail messages.list](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list), [Gmail messages.get](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get).

## Files in this change

- Server: `src/server/google.ts`, `http.ts`, `index.ts`, `provider.ts`.
- Extension: `src/extension/workspace-worker.ts`, `workspace-panels.tsx`, `workspace-panels.css`, `worker.ts`, `panel.tsx`, `errors.ts`.
- Contracts and actions: `src/shared/workspace.ts`, `workspace-actions.ts`, `types.ts`, `schemas.ts`.
- Setup/check commands: `scripts/setup-google.mjs`, `scripts/live-chat.ts`, `package.json`, `.env.example`.
- Tests: `tests/google.test.ts`, `tests/chat.test.ts`, `tests/google-chat-browser.ts`.
- Documentation: this file, `README.md`, `AGENT_HANDOFF.md`, `docs/TESTING.md`.

Concurrent MCP/projects/sync edits were preserved. The landing app was not changed by the Google/chat implementation.
