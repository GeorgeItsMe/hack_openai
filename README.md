# Tabby

Лендинг Tabby с интерактивным демо. В репозитории также находятся исходники Chrome-расширения FocusTab AI и его локального сервера.

**На Vercel публикуется только лендинг.** Сервер, расширение, локальные данные и ключи в сайт не входят.

## Публикация на Vercel

1. Откройте [Vercel → New Project](https://vercel.com/new).
2. Импортируйте репозиторий `GeorgeItsMe/hack_openai`, ветку `main`.
3. Оставьте **Root Directory** в корне репозитория (`./`).
4. Нажмите **Deploy**. Параметры уже заданы в `vercel.json`:

| Параметр | Значение |
| --- | --- |
| Framework Preset | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build:landing` |
| Output Directory | `dist-landing` |
| Node.js | 24.x |
| Environment Variables | Не требуются |

Не выбирайте обычный `npm run build` в настройках Vercel: эта команда собирает Chrome-расширение. Для сайта предназначен `npm run build:landing`.

Лендинг использует статические HTML/CSS/JS, работает без API и открывается по `/`. Демо хранит задачи в браузере посетителя. `/focus.html`, Node-сервер и Chrome-расширение не публикуются. После подключения GitHub к Vercel новые коммиты в production-ветку запускают обновление сайта.

Документация: [Vite на Vercel](https://vercel.com/docs/frameworks/frontend/vite), [параметры проекта](https://vercel.com/docs/project-configuration).

## Локальный запуск лендинга

```sh
npm ci
npm run dev:landing
```

Откройте адрес, который напечатает Vite.

```sh
npm run check:landing
npm run build:landing
npm run preview:landing
```

Подробности дизайна и возможностей демо — в [LANDING.md](./LANDING.md).

## Расширение и локальный сервер

Эта часть проекта запускается отдельно от лендинга:

```sh
npm run setup
npm run server
```

Настройки сервера задаются локально в `.env` по образцу `.env.example`. Ключ провайдера не нужно добавлять на Vercel. Для подключения расширения используется отдельный локальный токен, создаваемый командой `setup`.

```sh
npm run check
npm test
npm run build
```

Готовое расширение находится в `dist/extension`. Его можно загрузить как распакованное расширение через `chrome://extensions` в режиме разработчика. `npm run dev` открывает отдельный локальный интерфейс `/focus.html`.

## Структура

- `src/App.tsx`, `src/styles.css` — лендинг.
- `src/Workspace.tsx`, `src/workspace.css` — интерактивное демо.
- `src/components.tsx`, `public/` — общие элементы лендинга и графика.
- `src/extension/` — Chrome-расширение.
- `src/server/`, `src/shared/` — локальный сервер и общая логика расширения.
- `scripts/`, `tests/` — инструменты и проверки расширения.
- `vercel.json` — публикация только лендинга.

`.env`, `.local/`, зависимости, сборки и артефакты тестов исключены из Git. `.vercelignore` также исключает сервер и расширение из загрузки через Vercel CLI.
