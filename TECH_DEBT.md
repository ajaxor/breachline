# Technical Debt

This file is the active to-do list for concrete technical debt discovered during development.

Each item should be an actionable unchecked Markdown task that includes:

- the affected area;
- the impact of leaving the issue unresolved;
- a practical direction for resolution.

Do not add ordinary feature requests, vague cleanup wishes, or speculative rewrites. Remove an item only after the underlying debt is resolved.

## Open items

- [ ] **Repository guidance duplication:** Agent workflow rules now exist in both `AGENTS.md` and `README.md`. This can drift and cause conflicting instructions. Keep `AGENTS.md` as the authoritative source and reduce the README section to a short pointer during a future documentation cleanup.
