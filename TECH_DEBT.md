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
- [ ] Introduce a shared battle-unit factory and explicit state invariants. Production code constructs units inline and tests/tools manually reproduce fields such as animation state, breach state, health, and stealth, making incomplete or contradictory unit objects easy to create. Route production, tests, simulations, and future replay/persistence code through one constructor or factory and validate required fields at the boundary.
- [ ] Move presentation-specific effect payloads out of the core rules boundary. `GameModel` currently emits CSS color values, effect names, animation durations, and user-facing log strings while otherwise serving as a headless rules model; alternate renderers, localization, and deterministic replay tooling will inherit those presentation assumptions. Emit semantic combat events from the model and let frontend adapters choose colors, wording, and animation timing.
- [ ] Centralize mission status, result type, action type, and effect type literals. Strings such as `locked`, `available`, `cleared`, `heal`, `detonate`, `death`, and result CSS classes are repeated across data, model, controller, and renderer code, so typos or renamed states can fail silently. Define shared constants or discriminated data shapes and validate exhaustive handling at module boundaries.

### Configuration and campaign generation

- [ ] Add startup validation for `GAME_CONFIG` and unit definitions. Board dimensions, deployment zones, tag combinations, actions, costs, ranges, formation unit keys, and campaign tuning are consumed under the assumption that they are internally consistent, so content edits can produce subtle runtime failures. Add a dependency-free validation module that runs in tests and development startup and reports actionable configuration errors.
- [ ] Remove the even-row assumption from `CampaignFactory.generateFormation` or enforce it explicitly. Formation generation creates mirrored row pairs using `GAME_CONFIG.rows / 2`, which becomes invalid or surprising if the board changes to an odd row count. Generalize mirrored slot generation to handle a center row, or assert the invariant with a clear validation error.
- [ ] Replace hard-coded per-unit campaign weight keys with data-driven availability metadata. `weightsForMission` requires edits whenever unit keys change or new units are added, creating a second content registry that can drift from `UNIT_TYPES`. Store unlock mission and weight progression alongside unit configuration or in a dedicated campaign data table validated against unit definitions.

### Testing, validation, and delivery

- [ ] Expand model tests into a discoverable suite organized by rule concern. The current `npm test` executes one script mixing drafting, campaign pacing, supply depletion, and flying behavior, while queue passing, stealth, healing, splash damage, breach/base attacks, sideways movement, stationary units, simultaneous outcomes, and campaign formation invariants are untested. Split fixtures and tests by subsystem and add deterministic coverage for every combat-rule branch.
- [ ] Add reusable deterministic test builders instead of hand-writing internal unit objects. Current tests duplicate the exact mutable shape expected by `GameModel.processUnit`, so harmless state refactors require broad fixture edits and missing fields can hide invalid assumptions. Provide scenario, mission, and battle-unit builders that use the same creation boundary as production code.
- [ ] Add a browser-level startup and deployment smoke test covering title entry, three opening drafts, transition into deployment, visible compact roster, expanded full-card roster selection, and hostile-unit inspection. Model-only validation did not catch the broken user-facing sequence, so future UI regressions can reach `main` without exercising the actual DOM event flow.
- [ ] Gate GitHub Pages deployment on automated validation. `.github/workflows/deploy-pages.yml` currently copies and deploys static files without running `npm test`, importing the application modules, or exercising startup, so broken code can be published directly from `main`. Add test and smoke-validation steps before artifact upload and make deployment depend on their success.
- [ ] Add regression thresholds to the balance analyzer. The report records useful metrics but CI has no baseline or allowed deviation, so a major accidental balance shift still exits successfully. Define stable aggregate thresholds and a reviewed baseline snapshot while preserving an explicit command for intentionally accepting balance changes.

### Frontend architecture and lifecycle

- [ ] Give `GameController` an explicit lifecycle and injected scheduling/browser adapters. It directly registers anonymous DOM/window listeners and owns `setInterval`, `requestAnimationFrame`, and orientation timers without a teardown path, making repeated initialization, tests, embedded usage, and future screen replacement fragile. Inject a scheduler/event boundary, retain listener references, and add `dispose()` to stop timers and unregister handlers.
- [ ] Validate required DOM elements when constructing `GameView`. The view builds a large element map and assumes every ID exists, so markup drift produces delayed null dereferences far from the actual cause. Assert the required element set once with an error naming missing IDs, or pass a typed element bundle from the composition root.
- [ ] Break dense multi-responsibility `GameView` render methods into small named operations. Methods such as `renderBattleChrome`, `renderBases`, `renderLog`, and `showResult` contain many DOM mutations in compressed one-line implementations, increasing review difficulty and merge-conflict risk. Expand them into readable blocks and extract repeated state-to-view transformations without introducing a framework.
- [ ] Replace avoidable dynamic `innerHTML` construction with DOM creation helpers. Current values are trusted internal data, but mission status, stats, result text, and build-facing markup are interleaved with HTML strings, making future localization or user-authored content harder to audit safely. Use text nodes and small element helpers, reserving static templates for markup with no dynamic content.
- [ ] Complete accessible modal behavior for draft, roster, result, and log overlays. The UI provides some ARIA labels but lacks dialog semantics, focus trapping/restoration, Escape handling, and predictable keyboard navigation, which can strand keyboard and assistive-technology users. Add a shared overlay controller that manages focus and semantics consistently.
- [ ] Replace repeated JavaScript roster-name fitting with a CSS-first solution or batched measurement. `fitRosterNames` repeatedly alternates layout reads and writes after each roster render, which can cause unnecessary reflow on constrained devices. Prefer responsive CSS (`clamp`, container sizing, ellipsis) or measure all names before applying size changes in one batch.

### Rendering and performance

- [ ] Extract unit-icon drawing from `CanvasRenderer` into a small shared frontend graphics module. `UnitPresentation` currently instantiates `CanvasRenderer` solely to draw each roster, draft, and inspector icon, coupling DOM presentation to the battlefield renderer and creating one renderer object per icon. Move the pure canvas path functions into a reusable helper consumed by both renderers.
- [ ] Consolidate unit and health-bar drawing between `CanvasRenderer` and `BattlefieldRenderer`. The conditional full-health-bar behavior currently requires `BattlefieldRenderer` to duplicate `drawUnit`, so later visual changes can drift between the two implementations. Extract unit-body drawing and health-bar drawing into protected helpers or make health-bar visibility a policy hook on the base renderer.
- [ ] Add a per-tick spatial index for occupancy and nearby-target queries before increasing battle density. Combat currently scans and often sorts the full unit array for each acting unit, and `occupantAt` performs another linear scan, which compounds in simulations and larger formations. Build a grid index at the start of each tick and update it as units move or die; use bounded neighborhood searches where attack range permits.
- [ ] Bound or prune transient model collections. Renderers filter expired effects but `model.effects` retains every emitted effect until battle reset, and combat logs grow without a limit, increasing memory and per-frame filtering cost during long or accelerated battles. Remove expired effects as ticks advance and cap or page log history according to UI/replay requirements.
- [ ] Avoid searching the active-effect list independently for every unit during rendering. `drawAnimatedUnit` calls `find` on active effects for each living unit, producing avoidable repeated work. Index attack effects by attacker ID once per frame and pass the relevant effect directly.

## Review record

The full assessment and category ratings from the 2026-07-06 audit are documented in [`CODEBASE_REVIEW.md`](CODEBASE_REVIEW.md).