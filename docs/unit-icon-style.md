# Unit Icon Style Guide

This document explains how coding agents should create and modify Breach Line unit icons.

The goal is to keep icons:

- readable at small sizes;
- clearly differentiated from one another;
- stylistically consistent across roles;
- reproducible through code without relying on external art assets.

## Core design language

Every unit icon has two layers:

1. **Shared role frame layer** — the outer silhouette that communicates the unit role.
2. **Unit symbol layer** — the inner abstract mark that differentiates one unit from another.

The frame layer is shared rendering infrastructure. It must not be redrawn differently for individual units.

### Role frame meanings

- **Melee:** rounded square
- **Ranged:** triangle
- **Support:** circle
- **Flying:** lens / winged lozenge
- **Specialist:** diamond
- **Structure:** large horizontal rectangle

Preserve these role associations unless the entire visual language is intentionally redesigned.

## Mandatory design rules

### 1. Prioritize symbol over literal illustration

Prefer bold abstract shapes over miniature literal depictions.

Good examples:

- shield-like mark for a defensive melee unit;
- reticle-like mark for a precision ranged unit;
- pulse or ring motif for support units.

Avoid:

- small humanoid drawings;
- tiny weapons or facial details;
- many thin lines that only read at large scale.

### 2. Keep the silhouette layer shared

Use the common role-frame renderer. Do not hand-draw an outer frame inside a unit-specific icon function.

If a role frame needs to change, modify the shared frame code once so every unit in that role inherits the same geometry, stroke width, fill opacity, and scale.

### 3. Keep symbols centered and inset

The unit-specific symbol should sit comfortably inside the frame.

- Leave clear breathing room between symbol and frame.
- Do not let fills merge visually with the frame unless that is deliberate.
- Avoid symbols that nearly touch every edge, because they make the common frame appear inconsistent.

### 4. Prefer one strong motif per icon

Build each icon around one primary idea.

Examples:

- **Bulwark:** shield
- **Ram:** wedge / impact
- **Marksman:** reticle
- **Medic:** ring + cross
- **Amplifier:** pulse arcs

Secondary strokes are acceptable, but the icon should still read from its main motif alone.

### 5. Use a limited drawing vocabulary

Prefer:

- filled rectangles;
- filled polygons;
- circles and arcs;
- a few thick strokes.

If an icon requires many unrelated strokes to be understood, simplify it.

### 6. Maintain family resemblance within a role

Icons in the same role should feel related without becoming interchangeable.

- Melee: dense, sturdy, grounded, blocky forms.
- Ranged: directional, aiming, sighting, or salvo forms.
- Support: circular, radiating, symmetric, medical, or utility forms.
- Flying: light, vertical, wing-like, or aerodynamic forms.
- Specialist: unusual but still simple high-concept forms.
- Structure: static, fortified, mounted, or anchored forms.

### 7. Optimize for gameplay size

Judge every icon at the size used on the battlefield and unit cards.

An icon that only works when enlarged is not ready.

## Implementation pattern

The preferred implementation lives in `src/frontend/UnitGraphics.js`.

- `drawRoleFrame(...)` renders the shared outer silhouette.
- `drawUnitDetails(...)` renders only the inner unit symbol.
- `ABSTRACT_UNIT_DRAWERS` maps graphic keys to dedicated symbol functions.
- Functions such as `drawBulwarkSymbol(...)` and `drawMedicSymbol(...)` define unit-specific marks.

Do not put role-frame geometry inside a unit-specific symbol function.

### Shared helper primitives

Prefer using or extending helpers such as:

- `fillRectScaled(...)`
- `fillShape(...)`
- `pathPoints(...)`
- `polygon(...)`

Add a new helper only when it improves consistency or reuse across multiple icons.

## Agent workflow for adding or revising icons

### Step 1: classify the unit

Identify:

- its role;
- its gameplay identity;
- one or two concepts the icon should communicate.

Examples:

- defensive melee → shield / brace / wall;
- explosive specialist → burst / impact / unstable core;
- support buffer → pulse / beacon / aura.

### Step 2: choose one symbolic motif

Write the motif in a few words before coding.

Examples:

- wedge;
- reticle;
- shield;
- ring + cross;
- stacked chevrons;
- antenna with pulse arcs.

If the motif cannot be described briefly, it is probably too complicated.

### Step 3: implement a dedicated drawer

For a modern symbolic icon:

1. Add `draw<UnitName>Symbol(ctx, radius)`.
2. Build it from a small number of shared primitives and thick strokes.
3. Register it in `ABSTRACT_UNIT_DRAWERS`.
4. Keep all role-frame logic out of that function.

### Step 4: compare nearby units

Check that the new icon:

- does not duplicate another unit's primary motif;
- still belongs to the same role family;
- remains distinct when shown beside likely neighbors.

### Step 5: inspect at gameplay scale

Use the running game or a small local comparison sheet whenever practical.

Ask:

- Is the outer role frame still obvious?
- Is the inner symbol readable?
- Is the unit distinct from same-role neighbors?
- Does the symbol make the shared frame appear larger, smaller, or distorted?
- Does the icon still work in both team colors?

### Step 6: validate code and deployment

Before finishing:

- run a JavaScript syntax check when available;
- run the project test suite;
- verify the production module graph;
- inspect the deployed game after CI succeeds.

### Step 7: document deliberate shortcuts

If an icon temporarily keeps a legacy drawing or placeholder, add a `TECH_DEBT.md` item only when it creates meaningful maintenance risk or blocks visual consistency work.

## Things agents should not do

- Do not introduce raster assets for normal unit-icon iteration.
- Do not mix unrelated illustration styles in the same icon family.
- Do not bypass the shared role frame for one unit because it is faster.
- Do not optimize an icon in isolation without comparing neighboring units.
- Do not interpret “more detailed” as “more literal” or “more lines.”
- Do not change role-frame geometry to make one difficult symbol fit; simplify or resize the symbol instead.

## Completion checklist

- [ ] The role frame is rendered through `drawRoleFrame(...)`.
- [ ] The unit function draws only the inner symbol.
- [ ] The symbol is centered and visibly inset.
- [ ] The icon reads as one primary motif.
- [ ] It is distinct from nearby same-role icons.
- [ ] It remains legible at battlefield size.
- [ ] It works with both player and enemy colors.
- [ ] New helpers have a clear reuse case.
