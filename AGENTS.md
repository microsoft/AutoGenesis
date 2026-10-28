# AutoGenesis Agent Instructions

## Requirement and progress source

GitHub Issues and the **AutoGenesis Agent Integration** GitHub Project are the source of truth. Read the assigned issue and `.github/DEVELOPMENT_GOVERNANCE.md` before changing code.

Do not begin implementation unless the issue is Ready: scope, non-goals, interfaces, acceptance scenarios, dependencies, and verification environments must be explicit. If a product decision is missing, stop and return the issue to Refining rather than guessing.

## Role separation

The implementer must not approve or accept its own work. Independent reviewer and acceptor sessions are required. Security review is mandatory for secrets, configuration writes, process execution, downloads, filesystem scope, approval flows, and prompt-injection surfaces.

## Scope discipline

- Implement one issue per isolated branch/worktree.
- Do not expand scope or weaken acceptance scenarios.
- Do not introduce a second convention beside an existing one.
- Public interface changes require an explicit issue contract.
- Shared Agent Contract sources, schemas, manifests, and versions have one owner at a time.

## Verification

Run the smallest commands that prove the affected behavior. Bug fixes must reproduce and close the failure. Permanent behavior changes need contract tests. Installation and compatibility work must be tested from a clean temporary business project using built packages, not editable source trees.

A change is not complete until its Given/When/Then acceptance scenarios pass and evidence is attached to the issue or pull request. Compilation alone is not acceptance.

## Security

Never place credentials or sensitive user input in logs, generated code, tracked configuration, issue evidence, or prompts. Use environment-variable references for secrets. File writes must be scoped and atomic; process arguments must not be shell-interpolated.

## Pull requests

Use `.github/pull_request_template.md`. Include requirement linkage, observable result, scope, non-goals, interface changes, verification evidence, role assignments, security impact, compatibility impact, rollback, and known limitations.
