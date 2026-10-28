## Requirement

Closes #

## User-visible result

<!-- Describe the observable outcome, not the implementation. -->

## Scope

- 

## Non-goals

- 

## Interface changes

<!-- MCP tools/prompts, package entrypoints, configuration schemas, extension commands, or "None". -->

## Acceptance scenarios

```gherkin
Given
When
Then
```

## Verification evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Targeted tests |  |  |
| Build/type checks |  |  |
| Clean-environment smoke test |  |  |
| Acceptance scenarios |  |  |

## Agent roles

- Implementer:
- Reviewer:
- Acceptor:
- Security reviewer, if required:

## Security review

- [ ] Secrets and sensitive inputs are not written to logs, generated code, or tracked configuration.
- [ ] File writes are scoped and atomic.
- [ ] Command/process inputs are not shell-interpolated.
- [ ] Package downloads and remote instructions are pinned or verified.
- [ ] Not security-sensitive; explanation:

## Compatibility impact

<!-- Platforms, MCP clients, existing VS Code behavior, and migration considerations. -->

## Rollback

<!-- State how to disable or revert the change without losing user data. -->

## Known limitations

- 

## Definition of Done

- [ ] The issue met Definition of Ready before implementation began.
- [ ] Scope and non-goals were preserved.
- [ ] All acceptance scenarios pass in a clean environment.
- [ ] Required CI checks pass.
- [ ] An independent reviewer approved the change.
- [ ] An independent acceptor posted evidence.
- [ ] Security review passed or is explicitly not applicable.
- [ ] Prompt changes include an eval comparison.
- [ ] Documentation and machine-readable configuration agree.
