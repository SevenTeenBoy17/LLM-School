# Manor v5.2 Visual Acceptance

## Baseline

- Primary viewport: 1440x900.
- Stage: `(0, 0, 1440, 900)`.
- World: `(-80, 0, 1600, 900)`.
- Project HUD origin: `(16, 16)`, width `405`.
- System HUD: top/right offset `16`.
- Activity rail: `(16, 118)`, expanded width `194`, collapsed width `58`.
- Collaboration dock: top `118`, right offset `16`.
- Tool dock: horizontally centered, bottom offset `18`.
- Tolerance for these stable DOM geometries: 4px.

## Evidence

| Viewport | Artifact | Result |
| --- | --- | --- |
| 1440x900 | `test-results/manor-v5-1440.png` | Full HUD, seven nodes, strict 4x4 field, all sixteen centers hittable. |
| 1024x768 | `test-results/manor-v5-1024.png` | Compact icon HUD, no horizontal overflow. |
| 768x800 | `test-results/manor-v5-768.png` | Mobile top bar/drawers, five-action bottom navigation, view controls. |
| 390x844 | `test-results/manor-v5-390.png` | Single-column mobile navigation, enlarged panning world, no text overflow. |

Automated checks verify nonblank pixels, color variance, dimensions, HUD geometry, target sizes, overflow, plot hit mapping, modal/flyout behavior, and network boundaries. The generated illustration is evaluated by human visual review; the report does not claim pixel identity with proprietary art.

The approved desktop image also has a 640-bit perceptual dHash baseline in `tests/fixtures/manor-v5-visual-baseline.json`. The automated release gate fails when Hamming distance exceeds 64 bits. Geometry assertions remain independent because a perceptual hash is not a substitute for hit-area and layout verification.

## Manual review notes

- The original first draft was rejected because the land occupied too little space and looked decorative rather than playable.
- The accepted scene makes the sixteen plots the visual center and moves four compact learning buildings to the perimeter.
- A second generated draft was rejected because it formed a diamond scatter rather than a countable grid.
- The accepted final draft has four columns and four rows with strong soil seams.
- Desktop Toast placement was moved to the lower-left safety zone so it does not cover field-node labels; mobile retains a centered position above navigation.
- Status is always conveyed by icon, label, and color.
- Continuous decorative animation is absent; reduced-motion collapses interaction timing to 1ms.
