# Breach Line

A dependency-free browser strategy game deployed as static files.

## Architecture

- `src/data/` contains immutable game configuration, unit definitions, semantic event types, and dependency-free data validation.
- `src/model/` contains campaign generation, deployment policies, combat policies, and all game rules/state. It has no DOM dependencies.
- `src/backend/` contains the application controller and simulation scheduling.
- `src/frontend/` contains DOM presentation, semantic combat-event presentation, and canvas rendering.
- `src/simulation/` contains headless balance scenarios, battle execution, and pluggable scoring.
- `src/main.js` is the composition root that validates configuration and wires the layers together.
- `assets/` contains presentation-only styles and future static assets.
- `docs/unit-icon-style.md` contains the reproducible symbolic unit-icon process for coding agents.
- `docs/unit-design.md` defines unit role identity, design constraints, and the balancing workflow.

Dependencies flow inward: the front end and controller depend on the model/data, while the model never imports UI code. Combat rules emit semantic events; the frontend presenter chooses wording, colors, and animation timing. This keeps combat independently testable and makes it straightforward to add persistence, multiplayer transport, alternate renderers, localization, replay tooling, or new unit data later.

## Automated tests

Run the dependency-free Node test suite with:

```bash
npm test
```

Tests are discovered from `tests/*.test.mjs`. Shared deterministic fixtures live under `tests/helpers/`. The suite covers deployment supply, campaign formations, combat rules, semantic events, and a browser-level startup/deployment smoke flow. The smoke test uses an installed Chrome or Chromium browser; it is skipped when no browser is available locally and required in CI. Game configuration is validated both by the test suite and during browser startup, so invalid unit definitions or board settings fail with a targeted error.

## Balance reports

Run the deterministic headless balance analysis with:

```bash
npm run balance
```

The command executes mirrored equal-budget matchups and mixed-army contribution scenarios, prints a summary, and writes `reports/balance-report.json`. Use `-- --seed=12345` to select a reproducible seed or `-- --output=path/to/report.json` to change the output path.

Scoring is intentionally extensible. Add scorer objects to `src/simulation/scorers.js`, add new scenario families through `ScenarioFactory`, or inject alternate simulators, scenario factories, and scorer arrays into `BalanceAnalyzer`. Duel scores should not be treated as the sole measure for support or specialist units; the report keeps matchup, survival margin, mixed-army contribution, objective pressure, and timeout metrics separate for that reason.

Every deployment also runs the reviewed regression envelope in `reports/balance-baseline.json`:

```bash
npm run balance:check
```

After intentionally changing balance, review the full report and then update the accepted envelope with:

```bash
npm run balance:accept
```

Commit the baseline change together with the reviewed unit changes. Do not use the acceptance command merely to silence an unexplained regression.

## Versioning and deployment

`VERSION` is the canonical human-readable release number. Update it when making a release-worthy change.

Every push to `main` runs `.github/workflows/deploy-pages.yml`. The workflow runs the full automated suite, including the browser smoke flow, checks the balance regression baseline, and validates the production module graph. Only a successful build reads `VERSION`, injects the first seven characters of the exact Git commit SHA into the deployed module path, and publishes the artifact to GitHub Pages. The title screen displays both values, such as `v0.2.0 · 4cd76ab`.

The checked-in `build-info.js` is only a local-development fallback. Deployed builds always receive generated metadata from GitHub Actions.

## Running locally

Serve the repository root with any static HTTP server. ES modules generally do not work from a `file://` URL.

## Agent workflow

Repository-wide instructions for coding agents are maintained in [`AGENTS.md`](AGENTS.md). Technical debt is tracked in [`TECH_DEBT.md`](TECH_DEBT.md). Unit design guidance is maintained in [`docs/unit-design.md`](docs/unit-design.md), and reproducible unit-icon guidance is maintained in [`docs/unit-icon-style.md`](docs/unit-icon-style.md).

After pushing a task to `main`, the agent must check the GitHub Actions run for that exact commit and must not report the task as complete while tests or deployment validation are pending. A failed check must be diagnosed and corrected, and the replacement commit's checks must finish successfully before the final response.
