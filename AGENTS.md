# Agent Instructions

These instructions apply to every task in this repository.

## Before changing code

1. Read this file, `README.md`, and `TECH_DEBT.md` before making changes.
2. Spend deliberate time evaluating the best architecture before implementation. Identify the responsibilities involved, the correct layer for each responsibility, dependency direction, extension points, and likely long-term maintenance costs.
3. Prefer a coherent design that supports future features over the fastest local patch. Avoid premature abstraction, but do not introduce coupling merely to minimize the immediate diff.
4. Review existing technical debt for constraints or related cleanup opportunities.

## Architecture expectations

- Preserve the separation between `src/frontend/`, `src/backend/`, `src/model/`, and `src/data/` described in `README.md`.
- Keep game rules and state independent of the DOM, canvas, storage, networking, and other delivery mechanisms.
- Keep presentation concerns out of the game model and immutable configuration out of behavior-heavy modules.
- Use explicit interfaces and dependency injection at layer boundaries when doing so improves testability or permits alternate implementations.
- Before adding an abstraction, identify the responsibility or variation it isolates. Before bypassing an existing abstraction, confirm that the boundary is genuinely wrong rather than merely inconvenient.
- Consider how each design would accommodate likely future work such as persistence, multiplayer transport, alternate renderers, additional content, replay/debug tooling, and automated tests.
- When a task exposes an architectural weakness, either correct it within scope or record it in `TECH_DEBT.md` with enough context for a future agent to act on it.

## Technical-debt tracking

Maintain `TECH_DEBT.md` as the repository's active technical-debt to-do list.

- Add newly discovered debt even when it is outside the current task's scope.
- Write each item as an actionable unchecked Markdown task.
- Include the affected area, the impact of leaving it unresolved, and a practical direction for resolution.
- Do not add vague wishes, speculative rewrites, or ordinary feature requests.
- Remove an item only when the underlying debt is actually resolved.
- Update related entries when circumstances change.
- Never silently create debt. When taking a deliberate shortcut, document it during the same task.

## Post-commit CI verification

Every push to `main` runs the deployment workflow and publishes a machine-readable receipt plus full validation logs to the orphan `ci-status` branch. Use that branch as the source of truth for push-triggered workflow results; the GitHub connector's commit-workflow lookup may return no runs because it currently filters to pull-request-triggered workflows.

After the final task commit is pushed:

1. Record the exact full commit SHA.
2. Read `ci-status.json` from the `ci-status` branch repeatedly until its `commit` field exactly matches that SHA. A receipt for an older commit is stale and must not be treated as the result for the current task.
3. Confirm all of the following in the matching receipt:
   - `status` is `success`;
   - `buildResult` is `success`;
   - `deployResult` is `success`;
   - `testsExitCode`, `balanceExitCode`, and `moduleGraphExitCode` are all `0`.
4. If any validation fails, inspect the corresponding files on the same branch:
   - `diagnostics/tests.log` for the Node test suite;
   - `diagnostics/balance.log` for balance-regression failures;
   - `diagnostics/module-graph.log` for import/module validation failures.
5. Diagnose and fix the failure, push the correction to `main`, then repeat this process using the replacement commit's exact SHA.

Do not report that checks are unavailable merely because a workflow-run query returns no result. Do not report the task complete while the matching `ci-status` receipt is stale, absent, pending, failed, or contains a nonzero validation exit code.

## Completing a task

1. Validate the change as thoroughly as the repository and available tools permit.
2. Update documentation and `TECH_DEBT.md` when needed.
3. Push completed changes directly to `main`.
4. Verify the exact pushed commit through the `ci-status` branch as described above.
5. In the final response, include:
   - a concise summary of the completed work;
   - the validation performed, including the matching commit SHA and CI receipt result;
   - a **Tech debt noticed** section listing every new debt item found during the task, or explicitly stating that none was found;
   - a link to the deployed game: https://ajaxor.github.io/breachline/

The game link is required after every completed task, including documentation-only and maintenance tasks.