---
name: ponytail-debt
description: Harvest ponytail: comments into a tracked debt ledger.
---

Harvest every `ponytail:` comment in this repository into a debt ledger so deferrals do not rot into 'later means never'. Grep the whole tree for comment markers (skipping node_modules, .git, build output). One row per marker, grouped by file: `<file>:<line> — <what was simplified>. ceiling: <limit>. upgrade: <trigger>`.
Tag markers without upgrade paths as `no-trigger`.
End with count of markers and how many lack a trigger. If none: "No ponytail: debt. Clean ledger." Report only, change nothing.
