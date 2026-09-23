# Personal Manor Design QA

## Evidence

- Source visual truth: `test-results/manor-source-1440.png`
- Rendered implementation: `test-results/manor-1440.png`
- Combined comparison: `test-results/manor-design-qa-comparison.png`
- Responsive captures: `test-results/manor-learning-1440.png`, `test-results/manor-learning-390.png`
- Desktop normalization: source 1440 x 900 px, implementation 1440 x 900 px, CSS viewport 1440 x 900, device scale factor 1.
- Responsive viewports: 1024 x 768, 768 x 800 and 390 x 844, device scale factor 1.
- State: normal farm, initial daily mission; the learning-flow screenshot additionally shows the completed mission state.

## Full-View Comparison

The accepted farm scene, crop and building artwork, chrome, left activity rail, player panel, field geometry, bottom friend dock, warehouse and tool dock remain visually intact. The new paper-and-wood mission board occupies the previously quiet top-center area, keeps the scene visible, and uses the existing border, shadow, green, gold and wood vocabulary. The four top-right entries and four left-side entries preserve their source proportions while replacing generic social/event language with education-specific destinations.

## Focused Review

- Typography: Microsoft YaHei/PingFang fallbacks, zero letter spacing, compact labels and stronger mission hierarchy match the existing micro-client density. No clipped desktop, tablet or mobile copy was observed.
- Spacing and layout: the 1440 composition retains the original field and dock geometry. The 1024 core regions and 390 task-first shell remain fully inside the viewport with no horizontal document overflow.
- Colors and tokens: wood brown, paper yellow, farm green, white focus rings and semantic green success states remain coherent with the source. Error guidance uses warm amber rather than punitive red.
- Image quality: the 1586 x 992 farm master remains the visual source and is delivered as the dimension-matched WebP asset; shipped sprite PNGs remain unchanged. No replacement SVG illustration, emoji art or generated placeholder was introduced.
- Copy: all new visible copy is learning-action language. There are no payment, randomized reward, public ranking, streak-loss or countdown-pressure prompts.
- Icons and controls: Lucide icons are used for familiar commands, every tested visible control is at least 44 x 44 CSS px, selected/disabled/pending/success/error states are distinct.
- Interaction and accessibility: the evidence submission exposes a real pending state, incorrect answers return formative support without reward, modal focus is trapped, background content becomes inert, focus returns to the trigger, and reduced motion is honored.
- Focused image regions were not split into additional crops because the equal-size combined image keeps the chrome, mission board, entry rails, field and bottom controls legible in one comparison. The separate 390 capture is used for mobile control inspection.

## Comparison History

1. P2: at 1024 px, the rotated plot field extended about 2.5 px beyond the right viewport edge. Fix: reduced the tablet field width to 63% and added a 0.8% right inset. Post-fix automated bounds are within the viewport.
2. P2: at 390 px in local development, the Next.js development indicator covered the first bottom-navigation target. Fix: disabled `devIndicators` and added center-point obstruction assertions for all five navigation buttons. Post-fix capture shows the full `庄园` entry and all five targets are hittable.
3. P2: at the exact 768 px tablet boundary, the centered mission board could meet the two-column mode dock. Fix: added a 768–839 px narrow-tablet arrangement with the four modes in a dedicated row and registered 768 x 800 in the layout-bound test.
4. P1: class contribution could consume energy required by an active mission. Fix: reserve the eight task-energy points, disable additional contributions at the reserve boundary, and verify the user can still nurture a plot afterward.
5. P1: the learning plot picker could include a locked plot. Fix: derive options from the live unlocked-plot list and reject stale selections with an energy refund.
6. P1: workshop choices had no completion path. Fix: both choices now open a keyboard-accessible editor; saved work appears in the learning portfolio.
7. P2: custom answer, plot and reflection radios lacked arrow-key behavior. Fix: add roving tab focus, arrow/Home/End navigation, and progressbar semantics for class construction.
8. P1: an evidence response could be applied after the student switched subjects. Fix: lock mission tabs while pending, bind each response to a request and mission ID, and discard stale responses.
9. P2: the mission tablist lacked keyboard switching. Fix: add roving tab focus plus arrow/Home/End navigation and verify all three subjects through the keyboard.
10. P2: async rejection and stale-plot refund paths lacked executable evidence. Fix: drive a visible repository failure state in the browser and add deterministic model tests for all repository rejections, one-time refunds and pre-spend locked-plot rejection.
11. P3: the mobile farm intentionally shows six primary plots and a five-item task navigation instead of shrinking the 1440 desktop micro-client. This is an expected responsive adaptation, not unresolved design drift.

## Primary Interactions Tested

Three-subject keyboard mission switching, request/mission race lock, pending evidence submission, duplicate-submit lock, visible repository-error recovery, wrong-answer scaffold, retry, correct-answer reward, reserved-energy class contribution, locked-plot exclusion, stale-plot energy refund, growth-energy spend, plot nurture, keyboard reflection, scheduled review, both workshop choices, portfolio capture, wellbeing stop, seed/harvest tools, loading/error/empty/disabled states, modal keyboard behavior, pairwise responsive-region collision checks and responsive navigation.

Console and page errors: 0. External requests: 0. Successful `/api/v2/manor/*` requests in the full learning flow: 22. Legacy `/api/manor` requests: 0.

## Findings

No actionable P0, P1 or P2 design findings remain.

## Follow-Up Polish

- P3: when real backend data is connected, validate long student names and localized subject strings at 200% text zoom.
- P3: add teacher-authored mission artwork only after the server-side image safety and provenance workflow is enabled.

## Final Result

final result: passed
