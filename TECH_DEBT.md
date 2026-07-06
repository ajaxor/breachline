# Technical Debt

This file is the active to-do list for concrete technical debt discovered during development.

Each item should be an actionable unchecked Markdown task that includes:

- the affected area;
- the impact of leaving the issue unresolved;
- a practical direction for resolution.

Do not add ordinary feature requests, vague cleanup wishes, or speculative rewrites. Remove an item only after the underlying debt is resolved.

## Open items

### Architecture and game state

- [ ] Split the broad responsibilities currently concentrated in `src/model/GameModel.js`. The class owns campaign state, drafting defaults, deployment, battle initialization, turn scheduling, movement, targeting, attacks, healing, effects, logging, result calculation, and mission progression, so every new mechanic increases branching and makes isolated testing harder. Extract focused collaborators incrementally—starting with battle-state construction, action resolution, targeting/movement policies, and campaign progression—while retaining a small orchestration facade for callers.
- [ ] Separate shared combat state from player deployment policy in `GameModel` and `StrategyGameModel`. The supply strategy currently overrides budget-era deployment methods and duplicates placement validation so the headless simulator can keep using `GameModel`; future placement-rule changes could drift between the two classes. Extract a combat-focused base plus explicit deployment-policy collaborators, then have both campaign play and simulation compose the policy they need.
- [ ] Add an explicit model-level battle setup API for tools and alternate game modes. `BattleSimulator` currently prepares arbitrary scenarios by replacing the first campaign mission and assigning deployment state before calling the real `startBattle()` path; this keeps one combat implementation but couples simulation tooling to mutable `GameModel` internals. Extract reusable battle initialization from campaign progression so simulations, replays, and future multiplayer validation can provide formations through a supported boundary.
- [ ] Introduce a shared battle-unit factory and explicit state invariants for production code. Tests now use a shared deterministic builder, but production battle creation remains inline and simulation/replay callers still have no supported constructor. Extract the production constructor from `GameModel.startBattle`, validate its required fields, and reuse it across simulations and future persistence boundaries.
- [ ] Move presentation-specific effect payloads out of the core rules boundary. `GameModel` currently emits CSS color values, effect names, animation durations, and user-facing log strings while otherwise serving as a headless rules model; alternate renderers, localization, and deterministic replay tooling will inherit those presentation assumptions. Emit semantic combat events from the model and let frontend adapters choose colors, wording, and animation timing.
- [ ] Centralize mission status, result type, action type, and effect type literals. Shared constants now exist in `src/data/gameTypes.js` and campaign data uses them, but combat and renderer code still contain legacy string literals. Finish migrating those consumers and validate exhaustive handling at module boundaries.

### Configuration and campaign generation

No open items.

### Testing, validation, and delivery

- [ ] Expand combat-rule coverage in the discoverable Node test suite. Tests are now organized under `node --test` with shared fixtures and configuration validation, but queue passing, stealth, healing, splash damage, breach/base attacks, sideways movement, stationary units, simultaneous outcomes, and campaign formation invariants remain untested. Add deterministic files by subsystem and cover every combat-rule branch.
- [ ] Add a browser-level startup and deployment smoke test covering title entry, three opening drafts, transition into deployment, visible compact roster, expanded full-card roster selection, and hostile-unit inspection. Model-only validation did not catch the broken user-facing sequence, so future UI regressions can reach `main` without exercising the actual DOM event flow.
- [ ] Add regression thresholds to the balance analyzer. The report records useful metrics but CI has no baseline or allowed deviation, so a major accidental balance shift still exits successfully. Define stable aggregate thresholds and a reviewed baseline snapshot while preserving an explicit command for intentionally accepting balance changes.

### Frontend architecture and lifecycle

No open items.

### Rendering and performance

- [ ] Extract unit-icon drawing from `CanvasRenderer` into a small shared frontend graphics module. `UnitPresentation` currently instantiates `CanvasRenderer` solely to draw each roster, draft, and inspector icon, coupling DOM presentation to the battlefield renderer and creating one renderer object per icon. Move the pure canvas path functions into a reusable helper consumed by both renderers.
- [ ] Consolidate unit and health-bar drawing between `CanvasRenderer` and `BattlefieldRenderer`. The conditional full-health-bar behavior currently requires `BattlefieldRenderer` to duplicate `drawUnit`, so later visual changes can drift between the two implementations. Extract unit-body drawing and health-bar drawing into protected helpers or make health-bar visibility a policy hook on the base renderer.
- [ ] Add a per-tick spatial index for occupancy and nearby-target queries before increasing battle density. Combat currently scans and often sorts the full unit array for each acting unit, and `occupantAt` performs another linear scan, which compounds in simulations and larger formations. Build a grid index at the start of each tick and update it as units move or die; use bounded neighborhood searches where attack range permits.
- [ ] Bound or prune transient model collections. Renderers filter expired effects but `model.effects` retains every emitted effect until battle reset, and combat logs grow without a limit, increasing memory and per-frame filtering cost during long or accelerated battles. Remove expired effects as ticks advance and cap or page log history according to UI/replay requirements.
- [ ] Avoid searching the active-effect list independently for every unit during rendering. `drawAnimatedUnit` calls `find` on active effects for each living unit, producing avoidable repeated work. Index attack effects by attacker ID once per frame and pass the relevant effect directly.

## Review record

The full assessment and category ratings from the 2026-07-06 audit are documented in [`CODEBASE_REVIEW.md`](CODEBASE_REVIEW.md).
