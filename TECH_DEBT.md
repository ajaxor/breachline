# Technical Debt

This file is the active to-do list for concrete technical debt discovered during development.

Each item should be an actionable unchecked Markdown task that includes:

- the affected area;
- the impact of leaving the issue unresolved;
- a practical direction for resolution.

Do not add ordinary feature requests, vague cleanup wishes, or speculative rewrites. Remove an item only after the underlying debt is resolved.

## Open items

- [ ] Extract unit-icon drawing from `CanvasRenderer` into a small shared frontend graphics module. `UnitPresentation` currently instantiates `CanvasRenderer` solely to draw each roster, draft, and inspector icon, coupling DOM presentation to the battlefield renderer and creating one renderer object per icon. Move the pure canvas path functions into a reusable helper consumed by both renderers.
- [ ] Consolidate unit and health-bar drawing between `CanvasRenderer` and `BattlefieldRenderer`. The conditional full-health-bar behavior currently requires `BattlefieldRenderer` to duplicate `drawUnit`, so later visual changes can drift between the two implementations. Extract unit-body drawing and health-bar drawing into protected helpers or make health-bar visibility a policy hook on the base renderer.
- [ ] Add a browser-level startup and deployment smoke test covering title entry, three opening drafts, transition into deployment, visible compact roster, expanded full-card roster selection, and hostile-unit inspection. Model-only validation did not catch the broken user-facing sequence, so future UI regressions can reach `main` without exercising the actual DOM event flow.
- [ ] Add an explicit model-level battle setup API for tools and alternate game modes. `BattleSimulator` currently prepares arbitrary scenarios by replacing the first campaign mission and assigning deployment state before calling the real `startBattle()` path; this keeps one combat implementation but couples simulation tooling to mutable `GameModel` internals. Extract reusable battle initialization from campaign progression so simulations, replays, and future multiplayer validation can provide formations through a supported boundary.
- [ ] Separate shared combat state from player deployment policy in `GameModel` and `StrategyGameModel`. The supply strategy currently overrides budget-era deployment methods and duplicates placement validation so the headless simulator can keep using `GameModel`; future placement-rule changes could drift between the two classes. Extract a combat-focused base plus explicit deployment-policy collaborators, then have both campaign play and simulation compose the policy they need.