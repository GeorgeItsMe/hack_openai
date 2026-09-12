# Tabby × Ambiguous — hackathon walkthrough

## What to show first

Open the **Tabby — Hackathon** project in Ambiguous. Its workspace includes a product brief, architecture and MCP decisions, and a release-evidence runbook. Start with the project board, then open **TASK-001: Verify and refresh the Tabby hackathon download** to show a concrete delivery task with acceptance criteria, a verified result and recorded status changes. [Workspace documents and links](AMBIGUOUS_WORKSPACE.md).

Then open Tabby, show the Ambiguous section and demonstrate the existing focus/task interface. The project workspace and task activity demonstrate actual use of Ambiguous in preparing Tabby for delivery. The extension's outbound MCP integration is a separate capability whose live account authorization still needs to be completed.

## A 25-second explanation

> One task, one focus session, one verified handoff. Ambiguous holds our product brief, architecture and release evidence. Tabby turns the task into browser focus. We built the MCP flow to bring in a team message and return a reviewed session report when the user presses Send.

Ambi reviewed the three workspace documents and recommended leading with the user outcome, keeping one task-to-report story and emphasizing deliberate review/send. The narration applies those recommendations; the short board segment supplies project evidence. The completed review is available in [the Ambi conversation](https://app.ambiguous.ai/docs/9c4f2ebf-4466-474e-8014-03b548a69c45?assistant=049affad-4b45-4c9d-9236-660d39c8a40b) and summarized in the native runbook.

| Time | Screen | Point |
| --- | --- | --- |
| 0–6 seconds | Ambiguous → Tabby — Hackathon → Board | Show the project work and linked product/architecture documents. |
| 6–12 seconds | TASK-001 → verification result | Show the concrete artifact, checks and completed delivery task. |
| 12–19 seconds | Tabby → Focus / Tasks | Show the installed extension and the task → focus workflow. |
| 19–25 seconds | Tabby → Ambiguous | Explain the implemented MCP integration and explicit report review/send. |

For a full live chat round trip, first finish **Connect Ambiguous** in the updated extension/local server, choose a real message and explicitly send a reviewed report. Do not use fixture screenshots as evidence of real team-chat delivery. The integration test covers actual Chrome and SDK MCP transport against a labeled test chat server.

## Evidence to keep open

- Ambiguous task: https://app.ambiguous.ai/tasks/TASK-001 (requires the team workspace account).
- Source: https://github.com/GeorgeItsMe/hack_openai.
- Download: `public/downloads/Tabby.zip`; metadata: `public/downloads/Tabby.json`.
- Release verification: `artifacts/ambiguous-delivery-verification.json`.
- Implementation and connection instructions: [Ambiguous integration](AMBIGUOUS.md).
- Test coverage: [Testing](TESTING.md).

This walkthrough covers the real project records created during final delivery.
