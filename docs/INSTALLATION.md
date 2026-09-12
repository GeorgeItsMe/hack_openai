# Install Tabby

[Download Tabby.zip](https://tabby-pi.vercel.app/downloads/Tabby.zip). The extension is already built; installing it does not require Node.js or a terminal.

1. **Unzip Tabby.zip.** On Mac, double-click it. On Windows, right-click → Extract All → Extract. Keep the extracted **Tabby** folder somewhere permanent, such as Documents.
2. **Open Chrome's extensions.** Paste `chrome://extensions` into Chrome's address bar. Turn on **Developer mode** in the top-right corner.
3. **Choose the Tabby folder.** Click **Load unpacked** in the top-left corner, then select the extracted folder containing `manifest.json`.

Click Chrome's puzzle-piece icon, pin **Tabby**, then click the cat. Add a task or start focusing. Keep the extracted folder in the same place: Chrome loads the extension from it. The ZIP includes these instructions in `INSTALL-TABBY.txt`.

This is a manual-install preview for desktop Chrome, not a Chrome Web Store listing. See [Chrome's official loading instructions](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked). A work or school computer may restrict Developer mode.

## Ready immediately

Tasks, projects, notes, saved links, tab search, duplicate cleanup and timers work without a companion server. AI features, Google and MCP use optional local companion setup and the user's own connections; those are not included in the browser ZIP. See the [repository setup](../README.md#extension-and-local-server), [MCP](MCP.md), [Google and chat](GOOGLE_AND_CHAT.md), and [workspace sync](PROJECTS_AND_SYNC.md) guides.

## Publishing an updated download

From a complete development workspace with Node.js 24:

```sh
npm run build
node scripts/package-extension.mjs --landing
node scripts/verify-download.mjs
node --import tsx tests/package-browser.ts
npm run build:landing
```

The packager copies only browser bundles, manifest, four icons and `INSTALL-TABBY.txt`. It writes `dist/Tabby.zip`, the legacy `dist/tabby-extension.zip`, and—with `--landing`—`public/downloads/Tabby.zip` plus `Tabby.json` (version, size and SHA-256). Do not package `.env`, `.local`, provider keys, pairing tokens, server files or a browser profile.

Commit the reviewed ZIP and metadata with the landing update. Vercel serves the ZIP as a static download named **Tabby.zip**; no backend is deployed. Its response forces revalidation so a new download gets the current build.

`tests/package-browser.ts` extracts the actual ZIP into a **Tabby** folder, loads it in a fresh Chrome profile, verifies branding and empty credentials, creates/persists a task, starts focus, opens the native Side Panel and checks for unexpected network calls. To verify the published bytes and download headers as well:

```sh
node --import tsx tests/package-browser.ts https://tabby-pi.vercel.app/downloads/Tabby.zip
```

For this download, the isolated source snapshot passed TypeScript/build and 48 unit/protocol tests. Google/AI fixture results are not claims of live account verification. The package browser check requires no local server or model calls.

GitHub Actions checks the freshly built files against the committed ZIP with `scripts/verify-download.mjs`, in addition to type checks, unit tests and the landing build.
