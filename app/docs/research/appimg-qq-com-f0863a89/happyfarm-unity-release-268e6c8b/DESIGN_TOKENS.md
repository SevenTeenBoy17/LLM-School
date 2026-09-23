# EduAI Manor v5.2 Design Tokens

## Color

- Ink: `#243529`; secondary ink: `#5c6f61`.
- Grass: `#4f9a3c`; action/deep green: `#2f6f31`.
- Water/information blue: `#2999bd`.
- Milestone orange: `#dc792f`; reflection coral: `#c95a6d`.
- Parchment: `#fff2c7`; paper: `#fffaf0`; wood: `#744326`; deep wood: `#472817`; light wood: `#a66a37`.
- Line: `#d7c18b`; warning: `#a85d20`; error: `#ad3d37`; success: `#2f7a45`; focus: `#0c6fd8`.

## Geometry

- HUD controls: minimum `44px`, 6-8px radius, 2px dark wood border.
- Project compass: desktop `405px` wide with `62px` minimum height; compact desktop `356px`; mobile full-width `58px` bar.
- Mode dock: four `126px x 50px` entries at 1440px and `52px x 50px` icon entries from 801px through 1199px.
- Tool dock: six `91px x 57px` entries at 1440px and `83px x 57px` compact entries.
- Modal: `min(760px, calc(100vw - 48px))`, maximum height `min(760px, calc(100vh - 48px))`.
- Central scene remains at least 65% unobstructed at 1440x900.

## Type and texture

- UI type uses the existing app Chinese sans stack; no text is baked into imagery.
- Panels use subtle paper noise through CSS, not a dominant beige page background.
- Shadows use a hard 2px contact edge plus a soft 12-24px elevation shadow.
- Icons are Lucide where possible; generated art contains no logos or labels.
