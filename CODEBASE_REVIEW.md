# Codebase Review

Reviewed: 2026-07-06

## Overall rating

**6.5/10 — healthy prototype, not yet a durable production codebase.**

Breach Line has a good high-level shape for a small dependency-free game: configuration, model, controller, presentation, rendering, and headless simulation are separated into recognizable modules. The code is generally readable, deterministic dependencies can be injected into the model, and recent features have been added without collapsing everything back into one script.

The rating is held back by concentrated complexity in `GameModel`, duplicated deployment policy, browser-global coupling in the controller/view, a very narrow automated test suite, and a deployment workflow that does not run validation. These are manageable debts at the current size, but they will become expensive as more units, status effects, campaign rules, persistence, and multiplayer-oriented features are added.

## Category ratings

| Area | Rating | Assessment |
| --- | ---: | --- |
| Architecture and boundaries | 7/10 | The intended layers are clear and mostly respected, but important responsibilities remain bundled inside the model and controller. |
| Readability and maintainability | 7/10 | Naming is clear and modules are approachable. Several large methods and dense one-line render methods reduce change safety. |
| Correctness and game-rule design | 7/10 | Deterministic injection and a single combat path are strong. State creation and invariants are informal, making invalid states easy to construct. |
| Automated tests | 4/10 | Current tests cover a handful of strategy and flying-unit behaviors, but most combat rules, campaign generation, UI flow, and rendering are unprotected. |
| Build and deployment | 5/10 | Deployment is simple and versioned, but production deploys are not gated by tests or a module/startup check. |
| Performance and scalability | 6/10 | Fine for current board sizes, but repeated full-array scans and retained effects/logs will scale poorly in larger battles or long sessions. |
| Accessibility and browser robustness | 5/10 | Some ARIA labeling exists, but modal focus, keyboard behavior, required-element checks, and lifecycle cleanup are incomplete. |
| Documentation and developer workflow | 8/10 | `README.md`, `AGENTS.md`, and active debt tracking provide unusually good guidance for a prototype. |

## Strengths

- The repository has an explicit composition root and documented dependency direction.
- Core game logic does not directly import DOM or canvas APIs.
- Randomness and time are injectable in the model, enabling deterministic tests and simulations.
- Unit definitions are centralized and shared by gameplay, UI, campaign generation, and simulation.
- Headless balance tooling reuses the real combat rules instead of maintaining a second battle implementation.
- The project is small, dependency-free, and easy to serve locally.
- Technical debt is already treated as an active backlog rather than hidden in comments.

## Highest-priority debt

### 1. Production deploys are not validation-gated

The Pages workflow copies files and deploys them without running `npm test`, the balance tool, or a browser/module smoke check. A broken import, DOM startup regression, or failing rule test can therefore be published directly from `main`.

**Direction:** add a validation job or validation steps before artifact upload. At minimum run the model tests and import/startup checks; add browser smoke coverage when available.

### 2. `GameModel` is becoming a god object

`GameModel` owns campaign state, drafting defaults, deployment, battle initialization, action scheduling, movement, targeting, healing, attacks, effects, logging, victory resolution, and mission progression. New mechanics will increase branching and make isolated testing progressively harder.

**Direction:** extract focused rule collaborators incrementally: battle-state construction, action resolution, targeting/movement policies, and campaign progression. Keep an orchestration facade if that remains convenient for the controller.

### 3. Deployment policy is duplicated across model subclasses

`StrategyGameModel` overrides launch eligibility, availability, placement, drafting, battle commitment, and roster pruning while inheriting budget-era behavior from `GameModel`. The two policies already duplicate placement validation and depend on mutable superclass internals.

**Direction:** separate combat state from deployment/draft policy and compose the appropriate policy for campaign play and headless scenarios.

### 4. Tests are too narrow for the rate of rule changes

The single test script mixes drafting, campaign pacing, roster depletion, and flying combat checks. It does not cover queue passing, simultaneous result cases, stealth, healing, splash damage, breach/base attacks, sideways movement, stationary units, campaign formation validity, controller flow, or renderer behavior.

**Direction:** split tests by concern, add fixture builders, and cover every rule branch with deterministic tests. Add browser-level startup and deployment smoke coverage.

### 5. Runtime state has no explicit schema or factory

Battle units are plain mutable objects constructed inline, and tests/tools reproduce their required fields manually. This permits incomplete or contradictory states and tightly couples callers to implementation details.

**Direction:** introduce a battle-unit factory plus invariant checks or documented state types. Route production, tests, simulations, and replay tooling through the same construction boundary.

## Complete findings

The actionable versions of these findings are maintained in `TECH_DEBT.md`.

### Architecture

- `GameModel` combines campaign, deployment, combat engine, visual-effect event production, combat logging, and progression.
- `StrategyGameModel` uses inheritance to replace a broad deployment policy, causing duplicated validation and fragile superclass coupling.
- Simulation setup depends on campaign/deployment internals rather than a supported battle setup API.
- Unit graphics are coupled to the battlefield renderer, and unit drawing is duplicated between renderer variants.
- The controller coordinates navigation, modal state, inspections, battle timing, draft continuation, and browser event wiring in one class.

### Correctness and state management

- Battle-unit state is informal and duplicated in fixtures.
- Configuration relationships are not validated at startup: zones, dimensions, tags, unit references, costs, actions, and campaign assumptions can drift silently.
- Campaign formation generation assumes an even row count and mirrored pairs.
- Effects are filtered for drawing but never removed from model state; combat logs also grow for the full battle/session.
- Result and mission statuses are string literals rather than centralized enums/constants.
- Renderer-only colors, effect names, and presentation payloads are emitted from the model, leaving a residual presentation dependency in otherwise headless rules.

### Testing and delivery

- The `test` script runs one file directly rather than a discoverable test suite.
- Most combat branches and campaign invariants lack tests.
- Tests manually construct internal unit objects.
- There is no browser-level smoke test.
- GitHub Pages deployment does not run tests or validate imports/startup.
- The balance report is useful but has no regression thresholds, so CI cannot detect a large accidental balance shift.

### Frontend and lifecycle

- `GameController` directly uses `window`, `document`, timers, animation frames, and many anonymous listeners, with no teardown/dispose path.
- `GameView` assumes every required DOM element exists; missing or renamed IDs fail later with null dereferences.
- Several view methods compress multiple responsibilities into dense one-line implementations.
- Dynamic markup is frequently assigned through `innerHTML`. Current values are trusted internal data, but this makes future localization/user-authored content riskier and harder to audit.
- Overlay and sheet behavior does not provide a complete accessible modal contract: focus trapping/restoration, Escape handling, and explicit dialog semantics are absent.
- Roster text fitting performs repeated layout reads/writes in a loop and is rerun after each render.

### Performance

- Combat repeatedly filters and sorts the full unit array for each acting unit.
- Occupancy checks scan the unit array instead of using a per-tick spatial index.
- Rendering searches active effects per unit.
- Expired effects and old logs are retained.
- These costs are acceptable now but will become noticeable with denser boards, more effects, or accelerated simulations.

## Recommended cleanup order

1. Gate deployment on tests and add combat-rule test coverage.
2. Add state/config factories and validation so refactors fail loudly.
3. Extract combat initialization and deployment policy boundaries.
4. Split `GameModel` by rule responsibility without changing behavior.
5. Add controller lifecycle/scheduler injection and browser smoke tests.
6. Introduce spatial indexing and bounded transient event storage when battle sizes justify it.
7. Finish renderer/presentation consolidation and accessibility cleanup.

## Bottom line

The project is in good shape for a rapidly evolving prototype. It is not a rewrite candidate. The right approach is to preserve the existing layer layout while strengthening contracts, tests, and lifecycle boundaries before adding much more content. Addressing the first four priorities would likely move the codebase to roughly **8/10** without changing the game’s external behavior.