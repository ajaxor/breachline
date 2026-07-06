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
