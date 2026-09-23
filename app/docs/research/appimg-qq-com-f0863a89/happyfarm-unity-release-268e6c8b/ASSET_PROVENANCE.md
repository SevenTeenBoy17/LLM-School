# Manor v5.2 Asset Provenance

## Shipped collection

The route references only `/public/art/manor-v3/manor-world.webp` and its loading preview. Metadata, prompt summary, dimensions, versions, and SHA-256 values are machine-readable in `/public/art/manor-v3/manor-assets.json`.

The art was created during development with the built-in image generation capability. No model is called when a student opens the page. All labels, statuses, numbers, and interaction text are DOM content rather than baked pixels.

## Visual boundary

- The lawful reference product informed broad hierarchy: a large central field, peripheral buildings, four-edge HUD, tactile controls, and layered flyouts.
- The shipped scene is EduAI-original: school water-saving context, memory greenhouse, observation workshop, collaboration treehouse, and reflection pavilion.
- No reference logo, character, mascot, crop, copy, currency, VIP element, screenshot, or downloaded proprietary bitmap is shipped.
- Existing legacy files under `/public/art/qq-farm` are not imported by the v5.2 route and were not deleted because they may belong to unrelated user work.

## Final scene geometry

- Aspect ratio: 16:9.
- Full asset: 2560x1440 WebP.
- Preview: 960x540 WebP.
- Field: exactly sixteen large plots in a strict 4x4 perspective matrix.
- Interactive mapping: every plot is a DOM button using a projective quadrilateral derived from four documented field corners.
- At 1440x900 the world is rendered at 1600x900 and center-cropped by 80px on each side; the field remains the first visual signal.

## Reproduction

Regeneration is a development operation, not an application feature. Review regenerated art for exact plot count, legible seams, no text or trademarks, no embedded UI, no human likenesses, and no overlap between structures and the field before replacing a hashed file.
