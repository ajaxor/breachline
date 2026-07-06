# Technical Debt

This file is the active to-do list for concrete technical debt discovered during development.

Each item should be an actionable unchecked Markdown task that includes:

- the affected area;
- the impact of leaving the issue unresolved;
- a practical direction for resolution.

Do not add ordinary feature requests, vague cleanup wishes, or speculative rewrites. Remove an item only after the underlying debt is resolved.

## Open items

### Architecture and game state

- [ ] Split the broad responsibilities currently concentrated in `src/model/GameModel.js`. The class owns campaign state, drafting defaults, deployment, battle initialization, turn scheduling, movement, targeting, attacks, healing, effects, logging, result calculation, and mission progression, so every new mechanic increases branching and makes isolated testing harder. Extract focused collaborators incrementally—starting with action resolution, targeting/movement policies, and campaign progression—while retaining a small orchestration facade for callers.
- [ ] Separate shared combat state from player deployment policy in `GameModel` and `StrategyGameModel`. The supply strategy currently overrides budget-era deployment methods and duplicates placement validation; future placement-rule changes could drift between the two classes. Extract a combat-focused base plus explicit deployment-policy collaborators, then have both campaign play and budget-based callers compose the policy they need.
- [ ] Move presentation-specific effect payloads out of the core rules boundary. `GameModel` currently emits CSS color values, animation durations, and user-facing log strings while otherwise serving as a headless rules model; alternate renderers, localization, and deterministic replay tooling will inherit those presentation assumptions. Emit semantic combat events from the model and let frontend adapters choose colors, wording, and animation timing.

### Configuration and campaign generation

No open items.

### Testing, validation, and delivery

- [ ] Expand combat-rule coverage in the discoverable Node test suite. Tests are now organized under `node --test` with shared fixtures and configuration validation, but queue passing, stealth, healing, splash damage, breach/base attacks, sideways movement, stationary units, simultaneous outcomes, and campaign formation invariants remain untested. Add deterministic files by subsystem and cover every combat-rule branch.
- [ ] Add a browser-level startup and deployment smoke test covering title entry, three opening drafts, transition into deployment, visible compact roster, expanded full-card roster selection, and hostile-unit inspection. Model-only validation did not catch the broken user-facing sequence, so future UI regressions can reach `main` without exercising the actual DOM event flow.
- [ ] Add regression thresholds to the balance analyzer. The report records useful metrics but CI has no baseline or allowed deviation, so a major accidental balance shift still exits successfully. Define stable aggregate thresholds and a reviewed baseline snapshot while preserving an explicit command for intentionally accepting balance changes.

### Frontend architecture and lifecycle

No open items.

### Rendering and performance

No open items.

## Review record

The full assessment and category ratings from the 2026-07-06 audit are documented in [`CODEBASE_REVIEW.md`](CODEBASE_REVIEW.md).
