# EduAI Manor v5.2 Page Topology

## Reference boundary

- Source URL: `https://appimg.qq.com/happyfarm/unity/web/index/release/index.html?loginType=4`.
- A signed-out browser redirects to QQ authorization. That page is not reproduced.
- The authenticated QQNCmini runtime is used only to study scene composition, HUD layering, flyouts, modal depth, and pressed feedback.
- Product art, names, icons, copy, data, and interaction outcomes are original EduAI work.

## Layer order

1. Full-bleed isometric learning world.
2. Accessible DOM scene nodes anchored to seven learning landmarks and sixteen learning plots.
3. Persistent edge HUD: compact project compass, four system entries, activity rail, collaboration entry, and six action tools.
4. Trigger-attached flyouts for current project, learning systems, evidence timeline, collaboration, and scenario preview.
5. Dimmed modal workspace for evidence capture, evidence linking, claim submission, revision, artifact publishing, and node details.
6. Toast and screen-reader live region for authoritative operation results.

## Responsive topology

- `>= 1200px`: full four-edge HUD, scene remains the primary navigation surface.
- `801px - 1199px`: compact icon HUD, left and right rails collapse.
- `<= 800px`: top project bar, scene viewport with pan/zoom, four primary bottom actions plus More.
- `<= 430px`: control heights and labels reduce again while retaining 44px command targets.
- Scene list navigation is always available as an accessible alternative to spatial navigation.

## Route and isolation

- Destination: `/student/manor`.
- Page-specific variables and keyframes stay in `manor.module.css`.
- No global CSS, root layout, API route, database, authentication, or server action changes.
