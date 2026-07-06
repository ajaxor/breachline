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
- [ ] Add a browser-level startup and deployment smoke test covering title entry, three opening drafts, transition into deployment, visible left-side roster, and hostile-unit inspection. Model-only validation did not catch the broken user-facing sequence, so future UI regressions can reach `main` without exercising the actual DOM event flow.
- [ ] Move unlimited deployment availability into `GameModel`. `GameController` currently overrides the model instance's `availableCount` method because roster counts still represent consumable copies; this hides a game rule in the application layer and could be lost when models are reconstructed for persistence or multiplayer. Change roster state to represent unlocked unit types and make `GameModel.availableCount`/placement validation explicitly unlimited.
