# Technical Debt

This file is the active to-do list for concrete technical debt discovered during development.

Each item should be an actionable unchecked Markdown task that includes:

- the affected area;
- the impact of leaving the issue unresolved;
- a practical direction for resolution.

Do not add ordinary feature requests, vague cleanup wishes, or speculative rewrites. Remove an item only after the underlying debt is resolved.

## Open items

### Architecture and game state

- [ ] **Remove the obsolete turn-by-turn combat path from `GameModel` and its callers.** `stepTurn`, `turnQueue`, and pass-count state remain beside the current simultaneous `tick` path, creating two partially independent execution models that can drift as combat rules change. Confirm no production flow still depends on turn stepping, move any useful debug stepping behind the shared resolver, and delete the duplicate lifecycle state.

### Configuration and campaign generation

No open items.

### Testing, validation, and delivery

- [ ] **Add visual regression coverage for responsive draft and deployment layouts.** The browser smoke test verifies startup and interaction but cannot catch card overlap, clipping, or breakpoint-specific layout regressions. Add a small set of deterministic viewport screenshots or geometry assertions for portrait and landscape layouts, beginning with the reinforcement draft.

### Frontend architecture and lifecycle

- [ ] **Convert checked-in one-line stylesheet modules into readable source formatting.** Several feature stylesheets, including `assets/reinforcements.css`, are stored as single dense lines, which makes review, conflict resolution, and responsive-rule maintenance unnecessarily risky. Keep production output compact only through a build/minification step, or commit the source CSS in conventional multi-line form.

### Rendering and performance

No open items.

## Review record

The current assessment and category ratings from the 2026-07-07 audit are documented in [`CODEBASE_REVIEW.md`](CODEBASE_REVIEW.md).
