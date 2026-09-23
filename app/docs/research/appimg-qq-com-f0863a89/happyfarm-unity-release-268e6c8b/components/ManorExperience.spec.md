# ManorExperience Specification

## Target

- Route: `/student/manor`.
- Main component: `components/ManorExperience.tsx`.
- Interaction model: click, keyboard, touch pan/zoom, and deterministic async state.

## Composition

- Full viewport stage with a generated isometric educational world.
- Sixteen DOM plot nodes in a strict, large 4x4 perspective field and seven landmark nodes.
- Four-edge HUD on desktop, compact drawers on tablet, bottom navigation on mobile.
- Attached flyout for light interactions and modal workspace for complex operations.

## Required states

- Normal, loading, empty, failure, conflict, offline, and disabled scenario controls.
- Node states: available, active, needs_evidence, pending_review, revise, verified, showcase.
- Operation states: idle, pending, success, error.
- Publication includes a required reflection so the deterministic chain closes at artifact and reflection.

## Accessibility

- All scene hotspots are real buttons with names and status descriptions.
- Focus returns to the trigger after flyout or modal dismissal.
- Escape closes the active surface.
- A non-spatial Scene Navigator exposes the same nodes and actions.
- Status changes are announced through a polite live region.

## Responsive

- 1440x900 is the geometric baseline.
- 1024px has no horizontal overflow and retains visible system and action controls.
- 768px converts rails to drawers.
- 390px provides menu, four primary actions, More, pan, zoom, and reset controls.
