# Tabby feature coverage

The landing page separates three scopes: the interactive website preview, the Chrome extension, and future integrations. Vercel continues to publish only the static landing page.

## Coverage

| Capability | Tabby status | Where it is explained |
| --- | --- | --- |
| Automatic task collection from productivity apps | Planned | Collection card, integrations, roadmap |
| Context-aware distraction assessment | Extension; connected AI required | Context card, feature catalog, FAQ |
| Gentle reminders and reversible distraction cover | Extension; AI and appropriate site permissions required | Context card, feature catalog, FAQ |
| Tasks from selected text | Extension; optional AI refinement | Capture card, feature catalog, FAQ |
| Task source, steps, status, supported due dates | Extension | Capture card and FAQ |
| Search and switch between real browser tabs | Extension | Tab card and feature catalog |
| AI suggestions for Chrome tab groups | Extension; review before applying | Tab card, feature catalog, FAQ |
| Find and selectively close exact duplicate tabs | Extension | Tab card, feature catalog, FAQ |
| Focus and break timers | Extension; simpler timer in the website preview | Timer card, feature catalog, FAQ |
| Resume goal, working materials, and confirmed step | Extension | Feature catalog and FAQ |
| AI next-step help and session recap | Extension; connected AI required | Feature catalog and FAQ |
| Session categories, pauses, breaks, away time, reminders, returns | Extension | Insights card, feature catalog, FAQ |
| Local task list, timer, and completion progress | Website preview | Interactive workspace and preview catalog |
| Example tab spaces | Website preview | Interactive workspace and preview catalog |
| Ongoing workspace AI chat | Planned | Roadmap, Plus, FAQ |
| MCP and coding-agent connections | Planned | Roadmap, Plus, FAQ |
| Messenger task inbox | Planned | Roadmap and integrations |
| Cross-device account sync | Planned | Roadmap, Plus, FAQ |
| Longer-term trends and richer reports | Planned | Roadmap and Plus |

## Reference and verification

The reference comparison was checked on September 12, 2026 against [TabAI’s homepage](https://tabai.dev/), [pricing page](https://tabai.dev/pricing), and [MCP page](https://tabai.dev/mcp). These pages describe the reference product, not proof of implemented Tabby functionality.

Tabby implementation claims were checked against `src/extension/worker.ts`, `src/extension/panel.tsx`, `src/shared/types.ts`, `src/server/provider.ts`, and `src/Workspace.tsx`. The ongoing chat, third-party account connections, MCP, and device sync are not implemented in this version.

The context-switch illustration uses two explicitly labeled fixed examples; it does not call AI. The weekly chart is an illustration. The website preview cannot read real browser tabs, and its storage is separate from the extension. The extension’s AI actions use a connected service with user-authorized context; they are not advertised as entirely on-device processing.
