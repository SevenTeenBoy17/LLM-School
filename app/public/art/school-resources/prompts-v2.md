# GPT Asset Prompts V2

Mode: built-in GPT image generation. One call per asset. Style reference: existing `library.webp`, inspected before use. Original images copied into this directory; no AI upscaling.

## activity

Create ONE high-resolution UI category asset for an education resource library: a small tactile desktop monitor with an ivory screen containing a simple cobalt blue slider and 3 amber fraction tiles, a small orange circular play emblem at its lower corner. Represents an interactive HTML learning activity, not a gaming console. 3/4 isometric product icon, hand-crafted matte enamel and subtle paper texture, restrained teal-blue housing, warm copper accents; premium clear object silhouettes readable at 40 pixels. Match the restrained physical-material style of the provided library icon reference (style only). Single object centered, complete unobstructed silhouette with 15% margin, orthographic camera, soft studio lighting. Uniform PURE CHROMA GREEN #00FF00 background for cutting out; no green anywhere in the object, no ground shadow, no glow, no typography, no letters, no logos, no decorative particles. 1024 by 1024 or higher. This is one asset, not a contact sheet.

## media

Create ONE high-resolution UI category asset for an education resource library: a compact ivory video clapperboard with muted coral stripes across its hinged top, a deep cobalt blue play triangle inset in the center, and a small copper and charcoal speaker at its lower right integrated into one tidy object group. Represents audio and video teaching resources. 3/4 isometric product icon, hand-crafted matte enamel and subtle paper texture; premium clear silhouettes readable at 40 pixels, restrained practical school stationery feeling, not a toy. Match the material style of the supplied library icon reference, but use coral, ivory and blue accents for differentiation. Single asset centered complete silhouette 15% margin, orthographic camera, soft studio lighting. Uniform PURE CHROMA GREEN #00FF00 background for cutting out; no green anywhere on the object, no ground shadow, no glow, no typography, no letters, no logos or particles. 1024 by 1024 or higher. Not an atlas.

## Processing

User-requested chroma-key removal and edge despill with `scripts/build-resource-v2-assets.mjs`; centered 280px object in transparent 320px WebP. Source/hash/size manifest in `manifest-v2.json`. Practical command buttons are real HTML with accessible Lucide icons, never raster text or non-interactive pictures.
