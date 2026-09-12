# Tabby project workspace in Ambiguous

Ambiguous holds the product brief, architecture record, release-verification task and presentation materials for the current hackathon handoff. Documents are consolidated from the implemented prototype and verified test results; their creation times reflect when they were added to the workspace.

## Product and engineering references

- [Tabby — Hackathon board](https://app.ambiguous.ai/tasks?view=4f13c068-6145-4b4d-a766-4ef8c0d699e8&project=22a21c92-e8f8-401f-926e-93eba2154494&layout=board): six tasks, four completed and two open acceptance checks.
- [Product brief](https://app.ambiguous.ai/docs/740b06fd-b027-45f9-b397-86347af2aea9): problem, users, core loop, prototype scope and demo acceptance criteria.
- [Architecture and MCP decisions](https://app.ambiguous.ai/docs/3039ab4c-d6d2-4807-9fe0-d398ef17b95c): state ownership, the two MCP directions, explicit reads/writes, lost-reply handling and credential boundaries.
- [Release evidence and demo runbook](https://app.ambiguous.ai/docs/9c4f2ebf-4466-474e-8014-03b548a69c45): verification matrix, the refreshed release artifact, presentation sequence and open acceptance checks.
- [Ambi review conversation](https://app.ambiguous.ai/docs/9c4f2ebf-4466-474e-8014-03b548a69c45?assistant=049affad-4b45-4c9d-9236-660d39c8a40b): the built-in assistant read all three documents and returned concrete presentation improvements and live-proof requirements. Its suggestions were applied to the narration and recorded in the runbook.
- [Release verification — TASK-001](https://app.ambiguous.ai/tasks/TASK-001): actual packaging issue, verification result and recorded completion.
- [Source repository](https://github.com/GeorgeItsMe/hack_openai).

## Delivery board

| Task | Work | Status |
| --- | --- | --- |
| [TASK-001](https://app.ambiguous.ai/tasks/TASK-001) | Verify and refresh the hackathon download | Done — actual build, packaging and integrity checks |
| [TASK-002](https://app.ambiguous.ai/tasks/TASK-002) | Document product scope and demo acceptance criteria | Done — product brief saved and linked |
| [TASK-003](https://app.ambiguous.ai/tasks/TASK-003) | Record architecture and MCP decisions | Done — architecture document saved and linked |
| [TASK-004](https://app.ambiguous.ai/tasks/TASK-004) | Consolidate release evidence and the demo runbook | Done — evidence document and repository narration updated |
| TASK-005 | Authorize and verify the live Ambiguous MCP round trip | To Do — needs authorized account and explicit report send |
| TASK-006 | Verify Chrome workspace sync between two computers | To Do — needs two signed-in computers |

Statuses were read back from the real Ambiguous project UI. Documentation tasks record consolidation performed during final preparation, not earlier coding activity.

## Project narrative

> One task, one focus session, one verified handoff. Ambiguous holds our product brief, architecture and release evidence. Tabby turns the task into browser focus. We built the MCP flow to bring in a team message and return a reviewed session report when the user presses Send.

The workspace documents and task history support this description. Document and task dates reflect final-handoff consolidation; engineering verification is supported by the linked code and test evidence.

## Verification boundaries

The extension and MCP implementation passed 46 unit/protocol/HTTP tests, five Ambiguous Chrome scenario groups, seven workspace/MCP groups, seven Google/chat groups and native Side Panel smoke. Ambiguous's remote chat endpoint was represented by explicit contract fixtures in those integration tests. The separate real Ambiguous project/task UI workflow is verified.

Live extension OAuth/MCP chat delivery and cloud sync between two computers remain open acceptance checks. See [the integration guide](AMBIGUOUS.md), [test coverage](TESTING.md) and [the presentation runbook](AMBIGUOUS_DEMO.md).
