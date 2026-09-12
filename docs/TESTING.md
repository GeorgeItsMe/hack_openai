# Проверка поставки — 12 сентября 2026

## GitHub source and download synchronization (12 September 2026)

A fresh checkout-equivalent snapshot was installed with `npm ci` and verified with `npm run build`, 48 passing tests in `npm test`, and the landing production build. Separate Chrome checks passed: 23 core scenarios, seven project/MCP scenarios (including all five MCP tools), seven Google/chat scenarios, and five Ambiguous scenarios. Browser integrations use explicit fixtures; this verification made no paid AI calls and did not authorize a real Google or Ambiguous account.

The published `public/downloads/Tabby.zip` is version 1.0.3 and was rebuilt from the same source. `node scripts/verify-download.mjs` checks its complete file list, every built file, install instructions, manifest version, byte count and SHA-256 metadata. `.github/workflows/verify.yml` repeats dependency installation, extension build, unit tests, this archive check and landing build for pushes to main and pull requests. When extension source changes, rebuild and run `node scripts/package-extension.mjs --landing` before committing the download. Vercel continues to host only the static landing and public downloads.

## Current runtime verification

The recording handoff verified 48 unit/protocol tests, 23 core Chrome scenarios, native Side Panel smoke, 7 Google/chat, 7 workspace/MCP and 5 Ambiguous fixture scenario groups, and a clean install from the refreshed ZIP. The core browser runner now uses an ephemeral backend port with a private extension copy; it no longer requires stopping the user's server on 4318.

Regressions cover clearing cancelled classification indicators, refreshing presence on Resume, and showing a per-site access button without silently granting permissions. The obsolete English-switch assertion was replaced with a check of the current English-only UI.

`node scripts/live-extension-check.mjs` additionally verified seven checks with real DeepSeek through the actual extension and local backend: aligned/distraction classifications on prepared local pages, a real injected reminder, return to the original tab, reviewed task persistence and actual Chrome grouping. Report: `.local/live-extension-check.json`. English chat through the live backend also returned a validated task proposal. Google and outbound Ambiguous accounts remain unconfigured; their current status endpoints return 200 rather than the old server's 404. Source pages and external-account fixtures are not represented as live account verification.

The user is recording the video. See [the exact recording sequence](RECORDING.md).

## Ambiguous integration

The Ambiguous pass adds OAuth discovery/registration/PKCE callback tests, actual SDK Streamable HTTP and REST contract tests, response allowlists, durable send/replay protection, unknown delivery, fixed thread routing, cancellation/restart recovery and private provenance during sync merges. Stale task/project/note edits are also covered.

`npm run test:ambiguous` runs the built extension in a temporary real Chrome profile through an authenticated local HTTP server and a real SDK MCP test server. Five scenario groups cover channel/message reads, reviewed task creation, stale drafts, focus completion and edited report sending, uncertain delivery across reloads, exclusions/disconnect and 390px/desktop layout. Results: `artifacts/ambiguous-browser-results.json`; screenshots: `artifacts/tabby-ambiguous-messages-fixture.png`, `artifacts/tabby-ambiguous-report-fixture.png`, `artifacts/tabby-ambiguous-desktop-fixture.png`.

No Ambiguous account, team message or paid AI completion is used. Live workspace authorization and real delivery remain unverified. The test uses ephemeral ports and a private copy of the bundle, leaving the user's 4318 server/profile running. See [setup and limitations](AMBIGUOUS.md).

Final verification for this pass: `npm run check`, **46/46** tests in `npm test`, `npm run build`, **5** scenario groups in `npm run test:ambiguous`, **7** in `npm run test:workspace`, **7** in `npm run test:google-chat`, and `npm run test:smoke` all passed. `node scripts/package-extension.mjs` refreshed `dist/Tabby.zip` and `dist/tabby-extension.zip`; archive integrity, exact bundle matching, stable manifest key and absence of local credentials/private files were checked. Existing landing changes were preserved.

## Google Calendar, Gmail and chat

The current Google/chat pass includes authenticated Google routes, real ephemeral OAuth callback listeners against mocked Google APIs, and strict chat proposal validation. `npm run test:google-chat` exercises the built extension in an isolated Chrome profile with explicit worker fixtures: calendar import without duplicates, Gmail AI draft and review, chat history and replay protection, opt-in calendar context, cancellation and disconnect. Reports/screenshots: `artifacts/google-chat-browser-results.json`, `artifacts/tabby-calendar-fixture.png`, `artifacts/tabby-chat-fixture.png`, `artifacts/tabby-chat-desktop-fixture.png`.

A separate live synthetic chat completion on 12 September 2026 returned a validated `create_task` proposal and a Russian reply from `deepseek-v3.2`; usage was 805 tokens, provider-reported cost 0.05002 in provider units. Report: `.local/live-chat-report.json`. No personal Google data was sent. This does not verify Google OAuth against a real account: no Google OAuth client was configured. Setup and exact coverage: [GOOGLE_AND_CHAT.md](GOOGLE_AND_CHAT.md).

**Обновление:** пользователь выбрал дешёвый DeepSeek вместо Astra. `deepseek-v3.2` найден в авторизованном каталоге и проверен тремя настоящими completions. `.local/live-report.json` содержит `live: true`: aligned / distracting / unknown. Сумма возвращённого `total_cost` — 0.08054. API-ключ хранится только в `.env`, не в отчёте.

Проверено в Node 24.21.0, TypeScript strict, Chrome for Testing 153 через Playwright. `npm test`: **23/23**. `npm run test:browser`: **20/20 сценариев**, реальные Chrome APIs и отдельный HTTP-сервер с явно фиктивными AI-ответами. Дополнительный `npm run test:smoke` проверяет финальную production-сборку без фиктивных AI-ответов: старт/стоп через UI, видимость контекста при 390×800 и настоящее открытие native Side Panel по жесту пользователя. Console/page errors: **0**. Production dependency audit: **0 уязвимостей** на дату проверки.

| Требование / сценарий | Проверка | Результат |
|---|---|---|
| Timestamp timer, повторный settle, поздний alarm | Unit | Пройдено |
| Пауза, продолжение, перерыв и его окончание, отдельное отсутствие | Unit + Chromium | Пройдено |
| Восстановление worker во время паузы и работы | Реальное закрытие worker через Chrome DevTools Protocol и последующее пробуждение | Пройдено |
| Сохранение после закрытия панели | chrome.storage; в Chromium перезагрузка страницы панели | Пройдено; основной пользовательский путь native Side Panel дополнительно открыт smoke-тестом |
| Полезное / развлекательное видео на одном домене | Chromium с двумя test URL на одном host + фиктивный classifier; реальный pipeline | Пройдено как интеграция механики, **не как оценка качества Astra** |
| «Это по делу» и другое видео того же домена | Chromium | Поправка снимает cover и не переносится на другую страницу |
| Неоднозначная страница | Chromium + fixture category unknown | Пройдено, ограничений нет |
| Быстрое переключение и задержка ~8 с | Chromium, счётчик HTTP-запросов | Пройдено |
| Запоздалый ответ и смена цели | Задержанный fake backend + реальный worker | Старый ответ не применён |
| Ошибки ключа/баланса/модели, 429, timeout, network | Protocol unit | Пройдено |
| Подмена снятой модели провайдером | Catalog + response headers/warnings fixtures | Ответ отклоняется |
| Невалидный JSON, лишние поля, вымышленные tab IDs | Schema unit | Действия отклоняются |
| Стоимость/токены, в том числе при отклонённом JSON | Protocol unit | Сохраняются только возвращённые значения |
| Строгий режим, отказ сервера и ввод в форме | Chromium | Cover снят, значение input сохранено |
| Вводы, editable, form, hidden, opacity:0, email | Content script на реальной странице, проверка переданного payload | Чувствительные тестовые маркеры не переданы |
| Задачи, редактируемый AI-черновик, пустой срок | UI + Chrome storage + fixture extraction | Пройдено |
| Реальные цветные группы Chrome | Preview → explicit command → `chrome.tabGroups.query` | Пройдено |
| Вкладка изменилась после preview группы | Chromium | `TABS_CHANGED`, старое предложение не применяется |
| Точные дубликаты | Реальные tabs + явный выбор | Закрыт только выбранный подходящий дубликат |
| Закрытие рабочей вкладки | Chromium | Корректный fallback/error, нет автоматического открытия |
| RU/EN, desktop и 390 px, живой native Side Panel | Chromium + визуальный просмотр PNG | Пройдено; горизонтального переполнения нет |
| Proxy Origin/Host/token, body bounds, rate limit | HTTP tests | Пройдено |
| Ключи / fixtures в extension bundle | Build и контроль содержимого | `.env`, local pairing token и fixture adapter отсутствуют |

Артефакты: `artifacts/browser-test-results.json`, `artifacts/tabby-desktop.png`, `artifacts/tabby-panel.png`, `artifacts/tabby-active-panel.png` (явная надпись TEST FIXTURE), `artifacts/tabby-production-active.png` (без fake AI).

Живой `npm run test:live` уже выполнен для DeepSeek. На реальных пользовательских материалах качество всё равно зависит от доступного текста. Сценарии с фиктивными ответами доказывают работу координации и Chrome APIs, а не способность модели понимать видео. Текущий content script не транскрибирует видео/аудио. Ручной контекстный пункт Chrome зарегистрирован в worker; его фактический системный пункт меню не нажимался автоматизацией.

Ограничения времени: alarms могут задерживаться во сне; UI использует timestamps. При длительном ненаблюдаемом промежутке применяется консервативный учёт отсутствия. HTTP-ошибка снимает шторку при обработке; внезапный разрыв связи без ответа обнаруживается контрольным запросом или истечением 40-секундного lease. Прерванный запрос может быть уже оплачен провайдеру; если usage не дошёл, стоимость в статистику не выдумывается.

Дополнительно пройден живой цикл в установленном расширении: подготовленная React-страница → реальная оценка DeepSeek `aligned` → развлекательная страница → `distracting` → напоминание → успешный возврат к рабочей вкладке. В отчёте `.local/live-browser-report.json`: `live: true`, `returns: 1`, модель `deepseek-v3.2`. Оба реальных ответа прошли схемы; демо оставлено на паузе.


## MCP and project workspace verification (12 September 2026)

`npm run test:workspace` uses a production extension build in its own temporary Chrome profile and the official MCP SDK 1.30.0 stdio client. It verifies real task/tab/session reads, project/task/note/pin UI, separately authorized task writes, request-ID retries/conflicts, URL exclusions, explicit saved-link opening, MV3 worker stop/restart, actual Chrome sync storage, access revocation and local-data preservation when the synced copy is removed. No AI provider requests are made. Ports 4319 and 44330 must be free; the existing 4318 server is left alone.

New unit coverage in `tests/projects.test.ts` and `tests/mcp.test.ts` checks migrations, date validation, archive and capacity behavior, completion timestamps, allowlisted exports, deterministic sync conflicts, deletion markers, invalid remote data/quotas, factual analytics, Origin/Host/token checks, profile conflicts and stale/offline responses. The broker test uses 44329.

Results: `artifacts/workspace-test-results.json`; UI screenshots: `artifacts/tabby-projects.png`, `artifacts/tabby-insights.png`. The Chrome Desktop client UI and delivery between real signed-in computers have not been verified. Injecting a remote sync record checks merge behavior only; it is not a cloud-delivery test.

Verified in this implementation pass: `npm run check`, 38 passing tests in `npm test`, `npm run build`, seven real-browser/MCP scenarios in `npm run test:workspace`, and `npm run test:smoke`. The legacy `npm run test:browser` suite was not rerun because the user-owned AI server was already bound to 4318.
