# Technical Debt

This file is the active to-do list for concrete technical debt discovered during development.

Each item should be an actionable unchecked Markdown task that includes:

- the affected area;
- the impact of leaving the issue unresolved;
- a practical direction for resolution.

Do not add ordinary feature requests, vague cleanup wishes, or speculative rewrites. Remove an item only after the underlying debt is resolved.

## Open items

- [ ] Extract unit-icon drawing from `CanvasRenderer` into a small shared frontend graphics module. `GameView` currently instantiates `CanvasRenderer` solely to draw roster icons, which couples DOM presentation to the battlefield renderer and creates one renderer object per roster card. Move the pure canvas path functions into a reusable helper consumed by both views.
- [ ] Consolidate unit and health-bar drawing between `CanvasRenderer` and `BattlefieldRenderer`. The conditional full-health-bar behavior currently requires `BattlefieldRenderer` to duplicate `drawUnit`, so later visual changes can drift between the two implementations. Extract unit-body drawing and health-bar drawing into protected helpers or make health-bar visibility a policy hook on the base renderer.
