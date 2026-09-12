# Tabby — project handoff

## Mission Mode, Tabby 1.0.5 — 12 September 2026

- Implemented the user's approved productivity-agent direction. **Mission** is the default screen: goal and time budget → real DeepSeek plan → **Start this plan** approval → linked tasks, optional orange tab group and focus → **I’m stuck** coaching → confirmed step progression → factual completion recap. The original Focus remains available. New product copy/docs are English.
- `src/shared/mission-schema.ts` is the cloud-safe AI contract; `missions.ts` owns persistent mission/task progression. `src/extension/mission-worker.ts` coordinates serialized commands and browser actions; `mission-view.tsx` / `mission.css` provide the UI. The worker save hook reconciles task confirmations, including existing chat/MCP task writes. `mission` is a new AI request kind; runtime cloud imports use `.js` paths. DeepSeek and shared-key server-only storage are unchanged.
- Before approval, planning changes no tasks, tab groups or timers. Start validates the selected tab snapshots and persists its mission ID/tasks/session before grouping. Replays do not duplicate work; a partial/uncertain browser operation is reported without automatic retry. Cancellation, consent changes and changed task identity reject stale results. Steps are never completed by page time or the timer expiring. Closing/restarting the worker preserves progress; stopped missions can continue.
- This prototype selects eligible existing tab titles/URLs and suggests searches the user can open. It does not autonomously fetch search results, research pages or perform the user's external deliverable. See [Mission architecture, demo and limits](docs/MISSIONS.md).
- Validation: extension and landing builds; 63 unit/protocol/runtime tests; 23 core Chrome checks; cloud onboarding, Google/chat (7), workspace/MCP (7) and Ambiguous (5) fixture groups. Mission's dedicated Chrome suite checks real groups/tasks/nudges/return, coaching, approval/idempotency, stale tabs and edits, cancellation, partial grouping failures and actual worker termination/recovery. Model responses in that suite are explicitly fixtures. Clean ZIP installation and native Side Panel checks also passed. Reports/screenshots: `artifacts/tabby-mission-*`.
- Live production verification passed from the downloaded **1.0.5** ZIP: real DeepSeek produced a validated 4-step plan and selected the actual open React state reference. Start created a real orange Chrome group and 4 linked tasks. Synthetic UI confirmations advanced/persisted completion; no external React implementation was claimed. There were no loopback AI calls, pairing credentials or page-text permissions. Report: `artifacts/tabby-mission-live.json`. Verified deployment: `dpl_FHrHXFTZj8qZA594E2E2KUqauvuS`.
- Download and website copy refreshed, including updating an existing unpacked install without removing it. `npm run test:missions` runs the new fixture suite. `tests/mission-live-browser.ts --live` is a separate paid published-ZIP check; its step confirmations are synthetic UI verification, not proof of external work. Existing user demo/browser/backend processes were left running. Local AI installations need an updated/restarted companion for the new `mission` kind; **Use included AI** avoids local setup.


## Included cloud AI, Tabby 1.0.4 — 12 September 2026

- User explicitly requested a simple install and shared use of their GPT Tunnel key. Implemented and published hosted AI at `https://tabby-pi.vercel.app/api/tabby`. The key is a production-only Vercel Secret named `TABBY_CLOUD_GPTUNNEL_KEY`; it is never embedded in the ZIP or browser code. Provider/model stay fixed to GPT Tunnel / `deepseek-v3.2`.
- Fresh installs choose cloud AI and require only **Enable AI** after a short disclosure. No account, local server or pairing token is needed. Settings starts with included AI; MCP and local-provider fields are collapsed under **Connected tools & advanced settings**. Page-text and site permissions remain separate. Old paired installs retain local AI until **Use included AI** is chosen, so no existing consent silently changes transport.
- `api/tabby.ts` / `src/server/cloud.ts` expose only bounded, validated status and AI operations with sanitized errors. Production WAF rule **Tabby shared AI rate limit** is enabled at 60 POST requests/minute/IP for `/api/tabby` (per region); process-local limits add backpressure. These are not a durable spending cap. Set `TABBY_CLOUD_ENABLED=0` and redeploy to disable service. See [Cloud AI](docs/CLOUD_AI.md).
- Corrected the hosted Node ESM import paths after the initial deployment exposed an import-resolution failure; the final function starts successfully. Added a compiled plain-Node runtime regression test. Live verified deployment: `dpl_C1NfidubvX5DYmfBbGDyD3VkKC2d`.
- Validation: extension/landing builds, 57 unit/protocol/runtime tests, 23 core browser checks, seven Google/chat, seven workspace/MCP and five Ambiguous fixture groups, plus the cloud onboarding browser test. Downloaded production ZIP passed clean installation. `tests/cloud-live-browser.ts --live` then connected real DeepSeek and created a reviewed/persisted task from a real response in a fresh Chromium profile, with no pairing credentials or loopback calls. This makes one paid synthetic completion. Report: `artifacts/tabby-cloud-live.json`; first-run/chat screenshots accompany it. The site's actual download button and updated instructions also passed.
- Local companion, Google/OAuth and MCP transport remain separate and authenticated; the local pairing token is never sent to cloud AI. Live Google/Ambiguous account delivery is still not verified. Existing user demo/browser/server processes were left running.

## Published download — 12 September 2026

- Published **Tabby 1.0.3** to https://tabby-pi.vercel.app/downloads/Tabby.zip. Production deployment: `dpl_Href6qCmWTT5EnJbJsfu4Lnjsj4Z`. ZIP: 319,517 bytes, SHA-256 `42e69bdc9f0f3d5184b8106f6e507ebc4f8b512ec82f41cd9f69ddb3fdbf032b`.
- The earlier manual deployment above used the landing at `883529d` with only the ZIP refreshed. The subsequent GitHub synchronization publishes the complete verified source and the current 60-second browser demo; Vercel builds the landing from main. Both packaging passes contained byte-identical extension files, differing only in ZIP timestamps. The committed archive preserves the release packaging output and metadata listed above.
- Verified the production download in a clean Chrome profile: tasks persist, task-based focus starts, native Side Panel opens, narrow layout fits, and no credentials or unexpected network calls are present. Also clicked **Try Tabby → Download Tabby** on the public website and verified the resulting filename, bytes, SHA-256 and metadata. Report: `artifacts/tabby-published-release.json`; screenshot: `artifacts/tabby-published-download.png`.
- A concurrent packaging pass produced identical extension contents with different ZIP timestamps. Compared every extracted file, then aligned the local public/dist archives and metadata with the exact published archive. AI and external accounts still require their documented companion setup.

## GitHub source and download synchronization (12 September 2026)

A fresh checkout-equivalent snapshot was installed with `npm ci` and verified with `npm run build`, 48 passing tests in `npm test`, and the landing production build. Separate Chrome checks passed: 23 core scenarios, seven project/MCP scenarios (including all five MCP tools), seven Google/chat scenarios, and five Ambiguous scenarios. Browser integrations use explicit fixtures; this verification made no paid AI calls and did not authorize a real Google or Ambiguous account.

The published `public/downloads/Tabby.zip` is version 1.0.3 and was rebuilt from the same source. `node scripts/verify-download.mjs` checks its complete file list, every built file, install instructions, manifest version, byte count and SHA-256 metadata. `.github/workflows/verify.yml` repeats dependency installation, extension build, unit tests, this archive check and landing build for pushes to main and pull requests. When extension source changes, rebuild and run `node scripts/package-extension.mjs --landing` before committing the download. Vercel continues to host only the static landing and public downloads.

## Runtime repair and recording handoff — 12 September 2026

- User took over video recording and requested functional verification. Recording automation/server was stopped. The old loopback process was serving obsolete code: `/google/status` and `/ambiguous/status` returned 404. Restarted the actual 4318 server with current source; both now return 200 and accurately report unconfigured accounts. DeepSeek remains connected.
- Fixed stale `ANALYZING`/dwell indicators after request cancellation, loss of focus and worker recovery. `RESUME` now checks current idle/window presence instead of retaining an old Away flag. The Focus card offers per-site permission directly when host access is missing. No permissions are granted automatically.
- `tests/browser.ts` now uses an ephemeral AI-fixture port and a private bundle copy, so it can run alongside the real server. Updated its English-only assertion; added regressions for resumed presence, cancelled requests and missing site access. Final core run: 23 Chrome checks plus native Side Panel smoke. Unit/protocol suite: 48 passing tests. Google/chat (7), workspace/MCP (7), Ambiguous (5) fixture scenario groups also passed. The refreshed ZIP passed clean installation, task persistence and native panel checks.
- `node scripts/live-extension-check.mjs` performed 7 checks through the installed production extension, real local backend and real DeepSeek, using two explicitly prepared local source pages: classification, actual in-page reminder, return, task draft/save, real Chrome groups and persistence. Report: `.local/live-extension-check.json`. A separate English chat request through the real backend returned a validated task proposal (`.local/live-chat-en-check.json`). These do not prove live Google or outbound Ambiguous account connectivity.
- Rebuilt `dist/extension` and refreshed `dist/Tabby.zip`, `dist/tabby-extension.zip`, and the landing download. `npm run demo -- --ready --web` is running with actual React/YouTube pages and the latest native panel; the user must grant those sites for text/reminders. The ready mode now really pauses an existing session, removes its temporary standalone panel tab, and reports the appropriate start/resume instruction. See [recording steps](docs/RECORDING.md).

## Real Ambiguous delivery workflow — 12 September 2026

The user clarified that hackathon judges need to see Ambiguous used in building/delivering Tabby. A signed-in Chrome tab was available in workspace `hackaimbz`; the general chat and task list were initially empty. Through the actual Ambiguous UI, created **Tabby — Hackathon** and **TASK-001: Verify and refresh the Tabby hackathon download**, moved the task to In Progress, performed the packaging/verification work, saved its factual result and marked it Done. The task's activity records creation, description updates and In Progress → Done. It is open at `https://app.ambiguous.ai/tasks/TASK-001` for the demo. No chat messages or comments were sent.

The public ZIP initially differed from the latest production build. Ran `npm run build` and `node scripts/package-extension.mjs --landing`; verified archive integrity, exact browser-bundle equality, metadata hash/size, Ambiguous UI/commands and absence of local credentials/private files. Report: `artifacts/ambiguous-delivery-verification.json`. Updated the README and added [the 25-second walkthrough](docs/AMBIGUOUS_DEMO.md). This verifies real Ambiguous project/task use during final delivery, **not live OAuth/MCP chat delivery from the extension**. Do not attribute earlier coding to Ambiguous without evidence. Website ZIP assets were refreshed locally; this turn did not deploy the website.

The workspace now also contains three native Ambiguous documents: **Tabby / 01 — Product brief**, **Tabby / 02 — Architecture & MCP decisions**, and **Tabby / 03 — Release evidence & demo runbook**. Each was saved through the signed-in UI with actual prototype scope, code/test evidence and cross-links. [Workspace index](docs/AMBIGUOUS_WORKSPACE.md) contains their exact URLs. These documents consolidate existing work during final preparation; their creation timestamps were not altered. README and the demo narration now put this project workspace at the center of the Tabby × Ambiguous story.

The real project board has six tasks: TASK-001–004 are Done (release verification, product brief, architecture record and release runbook); TASK-005–006 remain To Do (live Ambiguous OAuth/MCP round trip and sync between two computers). Saved descriptions link the native documents and define acceptance criteria. These statuses were read back from the UI; the project progress is 67%.

Also used the real built-in **Ambi** assistant for a read-only review of the three project documents. The first response only acknowledged the request after reading them; a follow-up returned three concrete story improvements and the live-proof requirements. Applied its outcome-first narration and recorded the review in the native runbook and local walkthrough. The conversation URL is in the workspace index. No team-chat messages or task comments were posted; these were prompts to Ambi. The board and release-evidence document were left open for the demo.

## Prebuilt landing download — 12 September 2026

- Try Tabby now downloads the ready-to-install `public/downloads/Tabby.zip`; the archive and Chrome extension are named **Tabby**. Users unzip, open `chrome://extensions`, enable Developer mode and use Load unpacked. No Node.js or terminal is needed for basic installation.
- Build an updated archive with `npm run build` then `node scripts/package-extension.mjs --landing`. The packager retains `dist/tabby-extension.zip`, also writes `dist/Tabby.zip`, and publishes ZIP/integrity metadata under `public/downloads/`. Vercel still hosts only static landing files.
- `node --import tsx tests/package-browser.ts` verifies the actual ZIP in a clean Chrome profile. It also accepts the production HTTPS download URL to check response headers and bytes. No server or model calls. See [installation and release steps](docs/INSTALLATION.md).
- The browser ZIP includes `INSTALL-TABBY.txt`, bundles and icons; no source server, credentials or personal workspace. AI, Google and MCP retain separate optional local setup.

## Ambiguous priority update — 12 September 2026

- Implemented the user's requested outbound integration with `https://app.ambiguous.ai/mcp`: explicit channel/message reads → editable Tabby task → real focus session → preview and explicit reply to the original thread. The default is official SDK Streamable HTTP; `AMBIGUOUS_TRANSPORT=rest` selects the documented REST alternative. DeepSeek is unchanged.
- `src/server/ambiguous.ts` / `ambiguous-auth.ts` implement the adapter, SDK OAuth discovery/registration with PKCE and a private loopback callback, and durable send receipts. `.local/ambiguous-oauth.json` and `.local/ambiguous-receipts.json` stay private. `AMBIGUOUS_API_KEY` in `.env` is optional; users can sign in from **Connect Ambiguous** instead.
- `src/extension/ambiguous-worker.ts`, `ambiguous-view.tsx`, `src/shared/ambiguous.ts` own validated snapshots, source identity, draft/review/send commands, factual reports and unknown-delivery handling. No automatic team posts, no retries after ambiguous delivery. Existing Host/Origin/token checks on 4318 remain. Confirmed task text can sync; Ambiguous IDs and snapshots cannot. Local source metadata survives sync edits.
- New check: `npm run test:ambiguous` uses real isolated Chrome, authenticated HTTP and SDK MCP with an explicit chat contract fixture. Live account OAuth/delivery is **not verified**. Public metadata and API contracts were inspected; no real team message was sent. Setup and limits: [Ambiguous](docs/AMBIGUOUS.md). Restart the local server and reload the extension before connecting; the existing user-owned server was not stopped.
- Project/task/note editors now send expected timestamps to reject stale saves/deletions, and project selection persists across panel navigation. Preserve these guards alongside concurrent Google/chat changes.
- Final checks: TypeScript/build, 46 unit/protocol/HTTP tests, five Ambiguous Chrome scenario groups, seven workspace/MCP groups, seven Google/chat groups and native Side Panel smoke passed without paid AI calls. `dist/Tabby.zip` and `dist/tabby-extension.zip` were refreshed and checked against the built extension. No live Ambiguous account connection is implied by these results.

## Google and chat update — 12 September 2026

- Calendar & mail and AI chat are implemented in `src/extension/workspace-panels.tsx` / `.css`; worker commands live in `workspace-worker.ts`. Calendar reads the next 14 days from the primary calendar; Gmail reads the latest 20 inbox previews. Imports retain source links and metadata; AI email extraction remains a draft until saved.
- `src/server/google.ts` implements desktop OAuth with PKCE, one-use state and a separate ephemeral loopback callback listener. Google routes on 4318 retain exact Host/Origin/pair-token checks. Credentials stay in `.local/`; the extension only receives allowlisted snapshots.
- New AI kind `chat` keeps DeepSeek as default, supports Russian/English conversation and proposes create-task, complete-task and start-focus cards. Applying a card is explicit, validated, time-limited and protected against replay or changed task identity. Calendar sharing is optional and requires a recent snapshot.
- Setup: `npm run setup:google -- /path/to/desktop-client.json`, restart the local server, build/reload the extension, then use Calendar & mail. See [Google and chat](docs/GOOGLE_AND_CHAT.md) for scope, privacy and limitations. No Google OAuth client was available during implementation; a live Google account connection is not yet verified.
- Checks: `npm run test:google-chat` uses real Chrome UI/storage and explicit API fixtures; `tests/google.test.ts` covers actual loopback OAuth handlers against fixture Google endpoints. `node --import tsx scripts/live-chat.ts` is one potentially paid synthetic chat completion, with report `.local/live-chat-report.json`. The live check returned a valid task proposal in Russian from `deepseek-v3.2`.

Update: English is the primary product language. The extension now defaults to English and normalizes saved language settings; existing user content is preserved. Historical notes below may describe the earlier bilingual UI. MCP, projects and Chrome workspace sync are now implemented; see the update below. See the English root README for current installation and ZIP packaging commands.

## Workspace and MCP update — 12 September 2026

- `src/mcp/index.ts` / `broker.ts`: official SDK 1.30.0 stdio server; isolated authenticated loopback bridge on **4319**. Five tools read live sessions/tasks/tabs and create/complete tasks. Separate local MCP token and read/write opt-ins. No model calls or Node-side task database.
- `src/extension/mcp-bridge.ts`: extension-initiated long polling; serialized worker commands, fresh responses, profile lease, timeout, restart recovery and persisted 24-hour write receipts. Existing AI server stays on **4318**.
- `src/shared/projects.ts`, `sync.ts`, `analytics.ts`, `src/extension/projects-view.tsx`: projects, linked tasks, archived projects, saved links, notes, Chrome account sync, filtered/daily insights and JSON exports. State remains in `chrome.storage.local`; sync exports a separate allowlist with stable IDs, timestamps and deletion markers. Credentials and session history never sync.
- New commands: `npm run setup:mcp`, `npm run mcp`, `npm run test:workspace`. Setup preserves `.local/mcp-token.txt` with owner-only permissions. Reload the extension after building because CSP now permits the separate 4319 bridge.
- Setup and limits: [MCP](docs/MCP.md), [projects and sync](docs/PROJECTS_AND_SYNC.md). The Claude Desktop JSON example is provided; the actual verified client is the official SDK over stdio.
- Real-browser verification uses a temporary Chrome profile, the production build and real SDK calls: manual task + actual Chrome tab, create/complete/retry, worker termination/restart, access revocation and `chrome.storage.sync` operations. **No paid AI requests.** Cross-machine cloud sync delivery remains unverified. Test results: `artifacts/workspace-test-results.json`.
- Google/chat work is concurrent and separate. Preserve those changes when editing shared state, task persistence and panel navigation. New task mutation paths should set `updatedAt` and preserve `projectId` and external source metadata.

The historical MCP proposal later in this file describes the starting point, not the current implementation status.

Актуально на 12 сентября 2026. Корень на этом компьютере: `/Users/main/vs_projects/hack`.

## За минуту

Tabby — рабочий прототип Chrome Manifest V3 с боковой панелью: цель → контекст страницы → AI-оценка → напоминание → возврат к работе. Есть отдельный лендинг с интерактивным демо. Это разные приложения с разными хранилищами.

Пользователь хочет быстро развивать прототип, сохранить название **Tabby / Таби**, оранжевую палитру и предоставленные логотипы. Текущая модель по его выбору — недорогой **DeepSeek 3.2**, точный ID `deepseek-v3.2`, через GPT Tunnel. Это не полная копия функциональности TabAI.

**MCP implemented:** live local reads and opt-in task creation/completion; see the update above. Chrome workspace sync is opt-in. External Google/chat and outbound Ambiguous MCP have separate setup and verification; integration artwork does not prove connectivity. Remote hosting of Tabby's MCP, Notion and Slack are not implemented.

## Что уже работает

- Фокус: цель, выбранная задача, 25/50/своя длительность, пауза, продолжение, завершение, перерывы, восстановление состояния. Время считается по timestamps, отсутствие учитывается отдельно.
- AI: `aligned` / `distracting` / `unknown`, объяснение и следующий шаг. Анализ активной страницы после примерно 8 секунд; заголовок, очищенный URL и отдельно разрешённый видимый текст до 4 000 символов. Есть кэш, отмена и защита от устаревшего ответа.
- Помощь: мягкое напоминание, обратимая строгая шторка с Escape, поправка «Это по делу», возврат к рабочей вкладке, карточка возвращения после перерыва.
- Задачи: ручное создание/редактирование, выделение через контекстное меню, AI-черновик со страницы до сохранения, источник, статусы и выбор задачи для фокуса.
- Вкладки: список, поиск, переключение, AI-предложение групп с подтверждением, настоящие группы Chrome, закрытие выбранных точных дубликатов с защитой активных/закреплённых вкладок.
- Статистика: интервалы, категории, перерывы/паузы/отсутствие, напоминания, возвраты, подтверждённые задачи, AI-итог. RU/EN, согласие на AI, разрешения сайтов, исключения и очистка данных.

Ограничения: видео/аудио не транскрибируются; содержимое iframe/canvas/закрытого Shadow DOM не анализируется. Время на странице не доказывает продуктивность. AI требует локального сервера и доступного провайдера.

## Карта кода

| Где | Назначение |
| --- | --- |
| `src/extension/worker.ts` | Состояние, сериализация команд, Chrome API, наблюдение, AI, отмена запросов |
| `src/extension/panel.tsx`, `panel.css` | Настоящая боковая панель, RU/EN |
| `src/extension/content.ts` | Разрешённый видимый текст, напоминание/шторка |
| `src/extension/bridge.ts` | Связь панели с worker; отдельный fallback веб-предпросмотра |
| `src/extension/manifest.json` | MV3, разрешения, CSP и стабильный ID |
| `src/shared/types.ts`, `engine.ts` | Типы состояния и движок учёта времени |
| `src/shared/privacy.ts`, `schemas.ts` | Очистка данных и строгие AI-схемы Zod |
| `src/server/provider.ts` | GPT Tunnel, `status()` / `run()`, каталог моделей, валидация ответа/usage |
| `src/server/http.ts`, `index.ts` | Локальный защищённый HTTP и загрузка конфигурации |
| `scripts/build.mjs`, `setup.mjs`, `demo.mjs` | Сборка, локальная настройка, живое демо |
| `tests/`, `docs/TESTING.md` | Автоматические проверки и границы покрытия |
| `src/App.tsx`, `src/Workspace.tsx`, соответствующие стили | Лендинг и его самостоятельное демо |
| `public/brand/` | Логотипы, котики, иконки расширения и графика сервисов |

Основной путь: Side Panel → `chrome.runtime.sendMessage` → worker → HTTP `127.0.0.1:4318` → GPT Tunnel. Content script получает только необходимые команды. Источник состояния — `chrome.storage.local`, ключ `app`; Node не имеет прямого доступа к Chrome API или этому хранилищу.

Текущий HTTP принимает **POST `/status` и `/ai`**, JSON. Проверяет точный Host, Origin расширения и `X-Tabby-Token`. Это внутренний AI API, **не MCP**. ID расширения: `ffalelfgmbcedcpbgdnimcjangpdgmbi`; сохраняй публичный `key` manifest, от которого он вычисляется.

AI-запросы имеют `kind`: `classify`, `task`, `groups`, `next`, `summary`; входы/выходы описаны в `schemas.ts`. Provider возвращает `result`, `model`, необязательный `usage`. Не выдумывай стоимость при отсутствии usage. В GPT Tunnel сейчас используется `/chat/completions` и raw `Authorization: API_KEY`; для другого провайдера не копируй эту авторизацию автоматически.

## Как пользователю проверить расширение

### Самый быстрый вариант на этом компьютере

Если уже открыто окно **Chrome for Testing** с Tabby и страницами React/котиков, используй его. Во вкладке «Фокус» нажми «Продолжить» либо задай цель «Изучить авторизацию в React и собрать пример» и начни сеанс. Оставь активной React-страницу примерно на 8 секунд плюс время ответа модели. Затем переключись на **другую вкладку** с котиками, дождись оценки и нажми возврат к работе.

Если демо закрыто, из корня проекта:

```sh
npm run server
```

Оставь сервер в первом терминале; во втором:

```sh
npm run demo -- --ready
```

Сервер запускай только если он ещё не работает. Демо подключит токен, включит AI/чтение текста для демонстрации, откроет подготовленные страницы и боковую панель. Профиль отдельный: `.local/demo-chrome`. Не запускай второй экземпляр поверх открытого профиля. При первом запуске на новой машине нужны настройка/сборка ниже и `npx playwright install chromium`.

`npm run demo` без `--ready` сам выполняет живой цикл React → котики → возврат → пауза. Оценки — настоящие вызовы DeepSeek. `--ready` пропускает автоматический цикл; если сохранённый сеанс активен, анализ может продолжиться.

### Установка в свой Chrome

1. Для свежего checkout с Node.js **24.x** выполни `npm ci`, `npm run setup`, `npm run build`. На текущем компьютере зависимости, настройка и готовая сборка уже есть. API-ключ задаётся в локальном `.env`; существующее значение сохраняй.
2. Запусти `npm run server` из корня, если сервер не работает. Терминал оставь открытым.
3. Открой `chrome://extensions`, включи **Режим разработчика**, нажми **Загрузить распакованное расширение** и выбери `/Users/main/vs_projects/hack/dist/extension`.
4. Закрепи значок **Tabby**, нажми его. В настройках боковой панели вставь содержимое `.local/pairing.txt` в **Токен подключения**, нажми **Подключить и проверить**. Это локальный pairing-токен; API-ключ GPT Tunnel сюда не вставляется.
5. Включи **Разрешить анализ через AI**. Для анализа текста отдельно включи чтение текста и предоставь доступ к текущему сайту.
6. В «Фокусе» введи цель, начни сеанс и оставайся на подходящей странице около 8 секунд плюс время ответа AI. Переключись на развлекательную страницу и проверь напоминание/возврат. Результат зависит от доступного контекста страницы.

После изменения кода: `npm run build`, затем кнопка обновления карточки Tabby в `chrome://extensions`; при изменении content script обнови тестируемую страницу. После изменения сервера или `.env` перезапусти сервер. `dist/tabby-extension.zip` — архив поставки, но обычный build сейчас не обновляет ZIP автоматически.

Если не подключается: проверь запущенный сервер на `127.0.0.1:4318`, токен, согласие и разрешение сайта. Ошибка `EADDRINUSE` означает занятый порт: используй существующий процесс либо установи, чей он, перед остановкой. `chrome://` и Chrome Web Store не подходят для анализа. Веб-страница `/focus.html` не получает возможности установленного расширения.

## Команды и проверки для разработчика

| Команда | Что делает |
| --- | --- |
| `npm run check` | TypeScript расширения/сервера |
| `npm test` | Unit, схемы, provider и HTTP; без платных AI-вызовов |
| `npm run build` | Проверка TS и сборка в `dist/extension` |
| `npm run test:smoke` | Проверка собранного интерфейса и настоящей Side Panel в отдельном Chrome |
| `npm run test:browser` | Chrome APIs with a fixture AI server on an ephemeral port; leaves 4318 running |
| `npm run models` | Реальный каталог моделей, не completion |
| `npm run test:live` | Три настоящих, потенциально платных AI-запроса |
| `npm run dev` / `npm run preview` | Веб-предпросмотр панели; preview использует порт 4180 |
| `npm run dev:landing` / `npm run build:landing` | Отдельный лендинг, сборка в `dist-landing` |

For extension/server changes, run `check`, `test`, `build`, then the relevant browser checks. Documentation-only changes need factual, path and diff checks. The core browser runner now isolates its backend on an ephemeral port: leave the user's 4318 server running. Never stop unrelated Node or Chrome processes.

Предыдущие результаты: **23 unit/protocol/HTTP теста, 20 браузерных сценариев**, отдельный smoke финального UI. Реальный DeepSeek проверен тремя completions и циклом установленного расширения. Подробности — [docs/TESTING.md](./docs/TESTING.md), локальные отчёты `.local/live-report.json`, `.local/live-browser-report.json`, `artifacts/browser-test-results.json`. Это результаты предыдущих запусков, а не гарантия будущих изменений.

## Historical proposal: MCP for Claude or GPT

This section preserves the original proposal. The local read/write implementation is now described above and in docs/MCP.md. The client/provider distinctions still apply:

- **Другой агент пишет код через Claude/GPT:** ему достаточно этого файла и доступа к репозиторию; это не требует изменения AI-провайдера Tabby.
- **Claude/GPT получает задачи и вкладки Tabby через MCP:** нужен новый MCP-сервер и мост к расширению; план ниже.
- **Claude/GPT отвечает внутри Tabby вместо DeepSeek:** отдельная доработка provider. Сохраняй контракт и схемы; точный ID проверяй в доступном каталоге. Прямые API OpenAI/Anthropic потребуют собственных адаптеров/ключей. Не меняй дешёвую модель по умолчанию без такого поручения.

### Первый рабочий этап: только чтение

Предлагаемая схема: **локальный MCP-клиент ↔ Node MCP-сервер ↔ аутентифицированный мост ↔ service worker ↔ Chrome API / chrome.storage**.

1. Добавь изолированный модуль, например `src/mcp/`, и типизированный контракт моста. Эти пути предлагаются, а не существуют сейчас. Подключи совместимую версию официального MCP SDK, зафиксируй lockfile. Для первого локального клиента начни со `stdio`; stdout оставь только протоколу, логи отправляй в stderr. Пример подключения Claude Desktop и правила транспорта есть в [официальном руководстве MCP](https://modelcontextprotocol.io/docs/develop/build-server).
2. Реализуй получение **живого состояния расширения**. Один вариант — очередь запросов/ответов с инициативой соединения со стороны расширения; предусмотри приостановку MV3 worker, ограниченное ожидание, идентификаторы запросов и срок годности снимка. Конкретный транспорт выбери после небольшого proof of concept. Не создавай независимую вторую базу задач в Node.
3. Для нового моста определи отдельную аутентификацию и границы доступа. Существующие проверки `/ai` и `/status` должны остаться. Не подменяй их wildcard CORS ради доступа Node-клиента. Доступ к передаче данных через MCP пользователь включает явно в расширении.
4. Выдай три инструмента: `tabby_get_session` — цель, фаза и время; `tabby_list_tasks` — разрешённые поля задач; `tabby_list_tabs` — разрешённые ID, заголовки и очищенные URL обычных вкладок. Соблюдай исключённые сайты и границы профиля; incognito/служебные страницы не передавай. Проверяй схемы аргументов и результатов.
5. Экспортируй поля по белому списку. Полный `AppState` может содержать pairing-токен: его нельзя отдавать целиком. Не передавай ключи, cookies, поля форм или текст страницы автоматически. Нет подключённого браузера — явная ошибка; устаревший снимок — пометка/ошибка, а не фиктивные свежие данные.
6. Добавь команду запуска и проверенный пример конфигурации выбранного клиента без секретов. Проверь через настоящий MCP-клиент `tools/list` и `tools/call`: ручная задача в панели и реально открытая вкладка должны появиться в ответах. Чтение MCP не должно вызывать DeepSeek.

**Готовность этапа:** три инструмента возвращают реальные данные; отключение браузера, неверная авторизация и устаревшее состояние обработаны; секреты отсутствуют в ответах/логах; повторное подключение работает; существующие проверки проходят. Зафиксируй точный клиент и воспроизводимые шаги подключения. Сначала можно проверить SDK-клиентом, затем выбранным приложением Claude/GPT.

### Дальше: действия и удалённое подключение

После чтения можно добавить создание черновика задачи, паузу/продолжение фокуса. Используй существующую очередь команд worker и защиту от повторного исполнения. Изменение/закрытие вкладок должно сохранять предпросмотр, явное подтверждение и проверку актуальности списка. Не добавляй универсальное выполнение JavaScript.

Для собственного приложения с GPT **Responses API** поддерживает удалённые MCP-серверы; совместимость конкретной модели нужно проверить. Это другой API, чем используемый сейчас GPT Tunnel Chat Completions. См. [официальное руководство OpenAI](https://developers.openai.com/api/docs/guides/tools-connectors-mcp). Конфигурация локального `stdio` не означает автоматическое подключение ChatGPT: выбери целевой клиент и поддерживаемый им способ связи. Облачный клиент не получает доступ к пользовательскому `127.0.0.1` без отдельного моста; настройку удалённого доступа рассматривай отдельным этапом.

### Готовый текст поручения

> Прочитай AGENTS.md и AGENT_HANDOFF.md. Реализуй первый локальный MCP-этап Tabby: чтение текущей сессии, задач и вкладок из настоящего установленного расширения. Начни со stdio и проверки настоящим MCP-клиентом, подготовь пример подключения Claude Desktop. Сохрани DeepSeek по умолчанию, существующий дизайн, чужие изменения и защиту AI API. Добавь мост к service worker, проверки ошибок/авторизации/устаревших данных и инструкцию запуска. Не называй работу готовой по одним мокам: покажи реальную задачу и вкладку в tools/call.

## Дизайн, видео и дополнительные материалы

Палитра: акцент `#FF7745`, hover `#FF895D`, мягкий оранжевый `#FFE2D3`, фон `#F6F5F0`, карточки `#FFFEFB`, текст `#272923`, вторичный текст `#77796F`, линии `#DEDFD5`.

Для моушен-дизайнера подготовлен `artifacts/tabby-motion-kit.zip`: кнопки, карточки, слои, экраны RU/EN, иконки, исходные логотипы; внутри START-HERE.html и README-RU.txt. Повторный экспорт: `node scripts/export-motion.mjs` после сборки. Это PNG/SVG-набор, не готовый проект After Effects; состояния экспорта иллюстративные. Инструкция: [docs/MOTION_KIT.txt](./docs/MOTION_KIT.txt).

Ещё: [TABBY_README.md](./TABBY_README.md), [архитектура](./docs/ARCHITECTURE.md), [разрешения](./docs/PERMISSIONS.md), [лендинг](./LANDING.md). Vercel публикует только лендинг; настройки публикации не относятся к локальному MCP.
