# Breach Line

A dependency-free browser strategy game deployed as static files.

## Architecture

- `src/data/` contains immutable game configuration and unit definitions.
- `src/model/` contains campaign generation and all game rules/state. It has no DOM dependencies.
- `src/backend/` contains the application controller and simulation scheduling.
- `src/frontend/` contains DOM presentation and canvas rendering.
- `src/main.js` is the composition root that wires the layers together.
- `assets/` contains presentation-only styles and future static assets.

Dependencies flow inward: the front end and controller depend on the model/data, while the model never imports UI code. This keeps combat rules independently testable and makes it straightforward to add persistence, multiplayer transport, alternate renderers, or new unit data later.

## Versioning and deployment

`VERSION` is the canonical human-readable release number. Update it when making a release-worthy change.

Every push to `main` runs `.github/workflows/deploy-pages.yml`. The workflow builds the static site, reads `VERSION`, injects the first seven characters of the exact Git commit SHA into `build-info.js`, and deploys the resulting artifact to GitHub Pages. The title screen displays both values, such as `v0.2.0 · 4cd76ab`.

The checked-in `build-info.js` is only a local-development fallback. Deployed builds always receive generated metadata from GitHub Actions.

## Running locally

Serve the repository root with any static HTTP server. ES modules generally do not work from a `file://` URL.

## Agent workflow

Before implementing any task, spend deliberate time evaluating the best architecture for the change. Identify the responsibilities involved, the correct layer for each responsibility, dependency direction, extension points, and long-term maintenance costs. Prefer a coherent design that supports future development over the fastest local patch, while avoiding abstractions that have no concrete responsibility or variation to isolate.

Preserve the separation between the front end, backend/application layer, game model, and data. Keep game rules independent of the DOM, canvas, persistence, networking, and other delivery mechanisms. Consider likely future needs such as persistence, multiplayer transport, alternate renderers, additional content, replay/debug tooling, and automated tests when selecting boundaries.

Maintain `TECH_DEBT.md` as an active to-do list of concrete technical debt. Add newly discovered debt even when it is outside the current task, using actionable unchecked Markdown tasks that describe the affected area, impact, and a practical resolution direction. Do not add ordinary feature requests, speculative rewrites, or vague wishes. Remove an item only when the underlying debt is resolved.

At the end of every task, the final response must include a **Tech debt noticed** section that lists all new debt discovered during the task or explicitly states that none was found. It must also always include the deployed game link: https://ajaxor.github.io/breachline/

Completed changes must be pushed directly to `main` after validation.