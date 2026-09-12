# Tabby — repository instructions

Current AI setup: downloads default to hosted Tabby Cloud AI, using the project owner's GPT Tunnel key only in the production server environment. Keep the one-click consent, bounded API and WAF rate limit. Local companion/MCP/OAuth remain optional and retain their existing authentication. See docs/CLOUD_AI.md.

Current direction: English is the primary language for all new product copy and documentation. Preserve existing content; do not spend time translating legacy materials. MCP implementation is assigned to another agent. Mission Mode is now the default extension screen: goal → reviewed plan → linked tasks and tab groups → context-aware focus → confirmed progress. Preserve its approval, stale-response, task-identity and durable retry guards. The user handles video recording.

Сначала прочитай [AGENT_HANDOFF.md](./AGENT_HANDOFF.md): там карта проекта, запуск, проверки и предлагаемая задача MCP. Выполняй актуальное поручение пользователя; раздел про MCP — заготовка задачи, а не команда запускать её при любом обращении.

- Название продукта **Tabby / Таби**, оранжевый акцент `#FF7745`. Используй существующую графику из `public/brand/`.
- По выбору пользователя AI по умолчанию — `deepseek-v3.2` через GPT Tunnel. Упоминание Claude/GPT как инструмента разработки или MCP-клиента само по себе не меняет модель внутри расширения.
- Перед правками посмотри `git status --short` и нужные diff. Здесь могут одновременно работать другие агенты. Сохраняй чужие изменения; не делай общий reset/clean и не перезаписывай файлы целиком ради небольшой правки.
- Лендинг (`src/App.tsx`, `src/Workspace.tsx` и их стили) и расширение (`src/extension/`) — отдельные приложения. Меняй только часть, относящуюся к задаче. Общие контракты меняй минимально и явно описывай изменения.
- Секреты остаются в `.env` и `.local/`; не печатай и не копируй их в сообщения, логи, документацию, фронтенд или архивы. Токен подключения и API-ключ провайдера — разные значения.
- Сохраняй стабильный `key` в manifest, loopback-сервер, проверку Origin/Host/токена, согласие на анализ и отдельные разрешения сайтов. Не ослабляй `/ai` ради нового MCP-транспорта.
- Состояние расширения принадлежит service worker и `chrome.storage.local`. Сохраняй timestamp-таймер, отмену устаревших AI-ответов, валидацию Zod и подтверждение изменений вкладок.
- Node.js **24.x**. `npm run build` собирает расширение; `npm run build:landing` — сайт. `dist/` не редактируется вручную.
- Проверки выбирай по изменению из handoff. Не останавливай чужие процессы и не запускай второй экземпляр демо с тем же профилем. Живые AI-проверки обращаются к платному провайдеру.
- В результате укажи изменённые файлы, выполненные проверки и реальные ограничения. Не называй фиктивные ответы тестов живой проверкой модели. Обнови handoff, если изменились команды или архитектура.
