# Technical Debt

This file is the active to-do list for concrete technical debt discovered during development.

Each item should be an actionable unchecked Markdown task that includes:

- the affected area;
- the impact of leaving the issue unresolved;
- a practical direction for resolution.

Do not add ordinary feature requests, vague cleanup wishes, or speculative rewrites. Remove an item only after the underlying debt is resolved.

## Open items

- [ ] Add browser-level coverage for completing a battle and revealing both victory and defeat result overlays. The current startup smoke flow does not exercise the asynchronous post-breach transition, allowing runtime-only errors in the reveal callback to pass CI; extend the browser smoke test with deterministic battle-ending fixtures and assertions for the result overlay and victory-only music scene change.
