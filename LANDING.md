# Tabby landing page

An original Tabby design inspired by the focus, task collection, and tab management concept at https://tabai.dev/.

## Run

```sh
npm install
npm run dev:landing
```

Open the root URL printed by Vite. The separately developed extension preview remains at `/focus.html`.

```sh
npm run check:landing
npm run build:landing
npm run preview:landing
```

The standalone production landing page is generated in `dist-landing/`. Upload that directory to any static host. The existing extension and server scripts are separate and preserved.

Vercel is configured in `vercel.json` to run `npm run build:landing` and publish only `dist-landing/`. Import the repository with the root directory set to `./`; no environment variables are needed. See [README.md](./README.md) for deployment instructions.

## What works

- Add, search, complete, filter, and delete tasks. Tasks persist in local storage.
- Shared 5, 25, and 45 minute timer with pause, resume, reset, and completed-session totals. The timer measures wall-clock time, including time in background tabs.
- Example tab groups with working external links.
- Progress view, task counts, and per-project task filters.
- Workspace modal, keyboard shortcut (Command/Ctrl + K), Escape, focus restoration, and native dialog focus containment.
- Primary Try buttons open a desktop Chrome installation guide, with source download, build commands, manual loading steps, and optional local AI setup. The guide accurately identifies the source as an active development snapshot; no packaged release or store listing is implied.
- “See it in action”, “Open your workspace”, and the installation guide's preview button keep the no-install demo available separately.
- Mobile navigation, responsive layouts, FAQ accordion, roadmap and privacy dialogs.
- Scroll reveals and subtle animation with reduced-motion support.

## Full feature overview

The page presents six primary scenarios: connected task collection, focus sessions, tab organization, session insights, tasks from selected text, and context-aware distraction handling. A keyboard-accessible feature catalog separates the website demo, Chrome extension capabilities, and planned features. The roadmap also covers workspace AI chat, MCP and coding agents, messenger tasks, device sync, and richer reports. See [docs/FEATURES.md](./docs/FEATURES.md) for the capability mapping.

## Product scope

This is an interactive landing page preview. It does not collect payments, create accounts, read actual browser tabs, or connect third-party accounts. The catalog distinguishes existing extension capabilities from planned integrations. AI-powered extension features need a connected service and authorized context. The landing page has not been wired to the separately developed Tabby extension/server.

No fabricated user counts, reviews, or customer endorsements are included. The chart in the feature section is labeled as an illustration; workspace progress comes from interactions in the preview.

Google Fonts is the only external resource loaded by the landing page. The logo, illustrations, and product interface are SVG/CSS. Replace the fonts with local assets if fully self-hosted delivery is needed.

## Main files

- `src/App.tsx`: landing sections and content.
- `src/Workspace.tsx`: interactive preview and shared state.
- `src/components.tsx`: logo, icons, and accessible dialog.
- `src/InstallationGuide.tsx`, `src/installation-guide.css`: installation steps, command copying, and optional AI setup.
- `src/styles.css`: landing design and responsive layout.
- `src/workspace.css`: workspace and preview layout.
- `public/brand/`: supplied Tabby logos, contextual cat variants, service illustrations, and original extension icons (SVG/PNG). Components use these local assets directly.
- `public/favicon.svg`: copy of the supplied Tabby favicon.
