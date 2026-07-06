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

## Completing a task

1. Validate the change as thoroughly as the repository and available tools permit.
2. Update documentation and `TECH_DEBT.md` when needed.
3. Push completed changes directly to `main`.
4. In the final response, include:
   - a concise summary of the completed work;
   - the validation performed;
   - a **Tech debt noticed** section listing every new debt item found during the task, or explicitly stating that none was found;
   - a link to the deployed game: https://ajaxor.github.io/breachline/

The game link is required after every completed task, including documentation-only and maintenance tasks.
