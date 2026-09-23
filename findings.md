# Findings - EduAI Prism UI Implementation v1.2

## QA Real-Use Correction 2026-07-09 R53

- R53 process correction remained strict: model-governance quality was judged only after admin/teacher/student API login, admin model-setting readback, student blocked/care returned values, invalid model API responses, visible teacher hub login, hub Claude recommendation navigation, full chat API/UI answer return, content-quality review, session/message model readback, sentinel cleanup, static checks, code-review-graph status, and manual impact review completed.
- Fixed `R53-MODEL-001` P1: `/api/chat` accepted arbitrary invalid `modelId` values and could still generate a normal answer. `app/lib/data/models.ts` now exports `isModelId()`, and `app/app/api/chat/route.ts` rejects invalid model ids with `400 invalid_model`.
- Fixed `R53-MODEL-002` P1: `/api/chat/sessions` accepted arbitrary invalid `modelId` values and created sessions with non-catalog model ids. `app/app/api/chat/sessions/route.ts` now validates against the shared model catalog before persistence.
- Fixed `R53-HUB-003` P1: `/hub -> /chat?model=claude&seed=...` could append the new task to the user's latest old session before the seeded task started, creating session/message model drift. `app/app/(shell)/chat/page.tsx` now treats `prompt/agent/seed/model` as fresh task entry params and skips latest-session autoload for that entry.
- Final R53 evidence passed: API harness returned `verdict=pass` with 18 checks; browser harness returned `verdict=pass` with 15 checks; invalid chat/session model ids return `400 invalid_model`; closed Claude blocks normal student chat while care still bypasses closure; hub click stores Claude, sends Claude, renders full Claude-labeled answer, creates a fresh Claude session, persists assistant message `modelId=claude`, and cleans up both fresh and sentinel sessions; lint, tsc, build, code-review-graph status, and manual impact review passed.
- Residual R53 risk: workspace/app are not Git repositories, so no checkpoint commit or diff-based review is available; local QA used local-fallback AI answers, verifying product behavior and persistence rather than external gateway uptime.

## QA Real-Use Correction 2026-07-09 R54

- Reflection after baseline failure: R54 agent lifecycle API proved the state/RBAC path works, but two real issues blocked product quality. First, `/api/agents` and `/api/agents/[id]` returned auth/status-sensitive data without `cache-control: no-store`; the same risk applied to chat session readback because it includes message content and `agentId`. Second, a legitimate student prompt asking for a classroom AI-safety activity was misclassified as academic-integrity cheating because the English heuristic treated distant words `answer` and `give` anywhere in the prompt as a direct-answer request. Fix path: add no-store wrappers to agent/session endpoints and narrow the English direct-answer signal to near-neighbor token windows, then rerun the real returned-content/readback gates.

## QA Real-Use Correction 2026-07-09 R50

- R50 process correction remained strict: class-learning quality was judged only after visible teacher login, `/api/class` returned, returned class/student/pending content rendered, pending card click returned `/chat?seed`, composer seed readback completed, `/api/chat` returned, returned content was read, researcher/student role boundaries were verified, desktop/mobile browser checks completed, and review evidence passed.
- Fixed `R50-CLASS-CACHE-001` P1: `/api/class` returned sensitive class diagnosis data without explicit `Cache-Control: no-store`. Added `jsonNoStore()` so unauthenticated, forbidden, and allowed responses all return no-store.
- Fixed `R50-CLASS-ACTION-001` P1: pending grading cards used `/chat?ref=...`, but chat did not consume `ref`. The cards now use `/chat?seed=...` with returned pending title, subject, student/synthetic student label, and grading guidance request.
- Final R50 evidence passed: API harness returned anonymous 401, student 403, admin 403, teacher 200 unmasked no-store, researcher 200 masked no-store; browser harness returned teacher desktop/mobile no overflow, pending targets 318-323x59, composer seeded from returned data, `/api/chat` 200 with substantial grading guidance, researcher no real-name/title leaks, student redirected to `/learn`, console empty; lint, tsc, build, code-review-graph, and manual impact review passed.
- Residual R50 risk: local production validation used a process-only `EDUAI_SESSION_SECRET`; workspace/app are not Git repositories, so no checkpoint commit or diff-based review is available; temporary local `@playwright/test` installation touched `node_modules` but did not change package files.

## QA Real-Use Correction 2026-07-09 R49

- R49 process correction remained strict: admin model-governance quality was judged only after visible admin login, real UI switch interaction, save status, independent API readback, role-boundary requests, real `/api/chat` model-policy responses, returned-content quality review, desktop/mobile browser inspection, and review evidence completed.
- Fixed `R49-MODEL-SAFETY-001` P1: when a model was closed to students, soft-care wording such as learning pressure could be blocked as a normal model request. `classifyIntent` now recognizes this pressure wording as a care signal while preserving crisis and academic-integrity priority above care and model governance.
- Fixed `R49-MODEL-COPY-001` P2: `/admin/models` no longer presents cost/paid-version-style governance cues. The page now uses fair-use quota, access scope, and governance-policy wording aligned with the current no-paid-version product direction.
- Fixed `R49-MODEL-TARGET-001` P2: key admin model controls, admin tabs, sidebar links, and topbar search now use stable 52px target sizing in the current browser environment.
- Final R49 evidence passed: admin visible UI save/restore read back correctly; API harness returned `verdict=pass` across anonymous/student/teacher/admin boundaries, student blocked vs care bypass, teacher quota and content-quality gates; desktop/mobile visual JSON returned no horizontal overflow, no paid/cost wording, and 52px critical controls; lint, tsc, build, code-review-graph, and manual impact review passed.
- Residual R49 risk: in-app Browser plugin degraded after a localhost logout navigation failure, so Playwright CLI was used as the verified browser fallback; workspace/app are not Git repositories, so no checkpoint commit or git diff review is available.

## QA Real-Use Correction 2026-07-09 R48

- R48 process correction remained strict: model-hub quality was judged only after visible teacher login, `/hub` rendered state review, recommendation-card click-return, chat seed/model readback, send-button click, full AI content return, returned-content quality review, desktop/mobile inspection, static checks, and review evidence completed.
- Fixed `R48-HUB-001` P1: `/hub` no longer shows stale hardcoded procurement/call/request stats. It derives capability counts from the current model list and explicitly shows paid version count 0 because the product currently has no paid version.
- Fixed `R48-HUB-002` P1: recommendation cards now carry `model` and `seed` into `/chat`, so the selected model and real task survive navigation.
- Fixed `R48-HUB-003` P2: current-model state is no longer duplicated between static model data and Zustand state; final browser evidence found exactly one `当前使用`.
- Fixed `R48-HUB-004` P2: model-card and filter controls now meet the stable 44px target baseline in real desktop/mobile checks.
- Fixed `R48-HUB-005` P1: GPT-Image copy is now honest as `视觉方案 / 图像提示词`, not direct image output. Teacher fallback now returns 3 classroom-safe image prompt schemes with privacy warning, classroom use, avoid elements, and teacher review checklist.
- Final R48 evidence passed: visible teacher login, desktop/mobile `/hub` no overflow and no visible small targets, recommendation links carried `model+seed`, clicked GPT-Image recommendation opened chat with model and seed, send button returned a complete visual prompt pack in about 16.4s, console empty, lint/tsc/build/code-review-graph/manual review passed.
- Residual R48 risk: real image generation output is intentionally not implemented in the current text-chat route; local validation used a process-level QA session secret; workspace/app are not Git repositories, so no checkpoint commit or diff review is available.

## QA Real-Use Correction 2026-07-09 R47

- R47 process correction remained strict: dashboard quality was judged only after visible teacher/admin login, `/api/dashboard` return, source readback, cross-API comparison, desktop/mobile browser inspection, click-return checks, and review evidence completed.
- Fixed `R47-DASH-001` P1: `/dashboard` no longer relies on static KPI/course/todo/recent-chat/admin figures. It now uses a protected backend `DashboardSnapshot` generated from real learning, class, chat, audit, model, agent, and safety data.
- Fixed `R47-DASH-002` P1: teacher dashboard sourceSummary integrity count now matches `/api/learning` instead of drifting to class-level integrity.
- Fixed `R47-DASH-003` P1: admin auditRows now match `/api/admin/analytics` in the same sequence because `/api/dashboard` writes the read audit before generating the snapshot.
- Fixed `R47-DASH-004` P2: full-screen onboarding is excluded from `/dashboard`, so it cannot block first-run dashboard interactions.
- Fixed `R47-DASH-005` and `R47-DASH-006` P2: dashboard text links and admin view tabs now have stable hit areas; final browser evidence measured admin tabs at 71x40 and returned `smallTargets=[]`.
- Final R47 evidence passed: anonymous `/api/dashboard` 401, teacher/admin 200 with `cache-control: no-store`, teacher sourceSummary matched `/api/learning`, classOverview matched `/api/class.overview`, admin sourceSummary matched `/api/admin/analytics`, teacher recent chat and quick-action clicks landed on correct URLs, desktop/mobile no overflow, console empty, lint/tsc/build/code-review-graph/manual review passed.
- Residual R47 risk: local validation only; audit rows naturally increase as dashboard reads are audited; workspace/app are not Git repositories, so no checkpoint commit or diff review is available.

## QA Real-Use Correction 2026-07-09 R46

- R46 process correction remained strict: student exploration-page quality was judged only after visible login, `/api/explore` returned, rendered source/quest/task/growth content was read, desktop/mobile browser checks completed, click-return checks completed, and review evidence passed.
- Fixed `R46-EXPLORE-001` P1: `/explore` now uses a protected backend-derived `ExploreSnapshot` instead of static quests, local task toggles, static achievements, and static progress. The snapshot is derived from real chat sessions, messages, favorites, feedback, knowledge files, and integrity records via `getLearningSnapshot(user)`.
- Fixed `R46-EXPLORE-002` P2: task links and filter controls measured below the stable touch target in real browser inspection; final desktop/mobile checks returned no small targets after raising those controls to `min-h-12`.
- Final R46 evidence passed: anonymous `/api/explore` 401, student 200, `cache-control: no-store`, sourceSummary matched `/api/learning` as `11/16/16/1/1/0/10`, peer comparison `not_connected`, desktop/mobile source readback true, filter returned only `continue` cards, task link navigated to `/knowledge`, quest card navigated to the real `/chat?session=...`, no overflow, no console errors, lint/tsc/build/code-review-graph passed.
- Residual R46 risk: historical test-token chat titles can still appear as card titles because they are real saved sessions; peer comparison remains intentionally unavailable until anonymous class-band data exists; Git checkpoint/diff review remains unavailable because the workspace is not a Git repository.

## QA Real-Use Correction 2026-07-09 R45

- R45 process correction remained strict: student learning-home quality was judged only after visible login, `/api/learning` returned, rendered UI content was read, desktop/mobile browser checks completed, API readback completed, and review evidence passed.
- Fixed `R45-LEARN-DATA-001` P1: `/learn` now uses protected backend-derived `LearningSnapshot` data instead of static learning samples. The snapshot is derived from real chat sessions, messages, favorites, feedback, knowledge files, and integrity records.
- Fixed `R45-LEARN-TOUCH-002` P2: SafetyHelp mobile touch targets now meet the 44px baseline; final mobile browser evidence returned `smallEnabledTargets=[]`.
- Fixed `R45-LEARN-MOBILE-003` P2: source readback is visible in mobile main content, not only in the hidden `xl` right rail.
- Final R45 evidence passed: anonymous `/api/learning` 401, student 200, `cache-control: no-store`, sourceSummary `11/16/16/1/1/0/10`, desktop/mobile `sourceReadback=true`, no old static assignment examples, no overflow, no console errors, lint/tsc/build passed, code-review-graph refreshed.
- Residual R45 risk: learning mastery remains an estimate from available local signals, not a formal assessment score; Git checkpoint/diff review remains unavailable because the workspace is not a Git repository.

## QA Real-Use Correction 2026-07-08 R29

- R29 method correction remained strict: product judgment was made only after visible teacher login, real chat usage, full API/AI/UI completion, returned-content reading, and session readback. Static checks/build were baseline health evidence only.
- Fixed residual `R28-AI-003`: first cold teacher message UI completion improved from 20.8s to 12.7s by reducing normal-chat gateway attempts to one ranked base per request. Failed bases still cool down, and later requests can still reach remote models.
- Regression evidence: R29 follow-ups were `remote` in 7.9s and 6.9s UI completion, proving the optimization did not disable real model access.
- Safety evidence: crisis returned `kind=crisis/source=safety` in 12ms; exact academic-integrity request returned `kind=scaffold/source=integrity-scaffold` in 7ms; neither entered the gateway path.
- Residual `R29-RISK-001`: first-message 12.7s is acceptable for this run but still a P3 observation for weak networks or impatient users. Later testing should evaluate two-stage local-first + remote-supplement UX.

## QA Real-Use Correction 2026-07-08 R28

- R28 method correction: LLM gateway quality was judged only after visible teacher login, real chat input, full API/AI/UI completion, returned-content reading, and session readback.
- Confirmed and fixed `R28-AI-001`: first teacher fallback returned a generic AI internal-review meeting pack instead of classroom-attention analysis. Added a teacher attention/observation fallback with 4 points, observation signals, teacher next steps, and year-group conclusion.
- Confirmed and fixed `R28-AI-002`: repeated unhealthy gateway base attempts harmed follow-up latency. Added in-memory gateway health cooldown, success priority, and distinct-origin ordering.
- Confirmed and fixed `R28-QA-001`: Markdown table rendering caused the R28 verifier to falsely fail UI completion. The verifier now waits for the exact assistant message to stop streaming and show the run marker.
- Residual `R28-AI-003`: first cold message improved from 28.8s UI to 20.8s UI, but remains a teacher-retention risk because it still completes via local fallback after remote timeouts.

## QA Real-Company Correction 2026-07-08 v2

R27 user correction: real internal beta testing must simulate real school/company users completing real workflows. Product conclusions are valid only after all UI/API/AI/save/export results return, the returned content is read, and an internal-review style judgment is made. Static checks, route 200s, button presence, and screenshots are baseline health evidence only.

R27 confirmed and fixed three real long-session chat contract failures: frontend history could exceed `/api/chat` max history count, per-item 2000-char limit, and total 6000-char payload budget. Final fix centralizes history shaping in `buildApiHistory()` with 10 items / 2000 chars per item / 4000 total history chars. Also added stable message-bubble `data-*` attributes so real UI tests wait for the exact assistant message to finish streaming instead of matching stale page text.

- The latest user correction is now a hard QA rule: internal testing must simulate real users and real school/company review, wait for all UI/API/AI/download/save results to fully return, then evaluate after reading the returned content.
- Static checks, route 200, button visibility, and build success are baseline health evidence only. They cannot be used as product-quality conclusions.
- Added `开发材料/EduAI-Prism-真实公司级内测纠偏协议-v2-20260708.md` as the v2 execution contract for future rounds.

## QA Real-Use Correction 2026-07-08 R25

- R25 process correction: prompt output-format quality was judged only after teacher create preview, draft save, edit-page reload, edit preview, publish, student read/use, non-owner mutation boundary, cleanup, and safety regression all returned complete results.
- R25-PROMPT-FORMAT-001 P1 fixed: the output-format textarea accepted input visually, but the value did not reach `/api/chat`, `/api/prompts`, prompt readback, or edit-page restore. `outputExample` is now part of the prompt editor, preview panel, client/API schema, DB mapper/create/update paths, and prompt persistence.
- Local fallback now respects explicit Markdown table/marker output-format requirements for normal prompt preview tasks, while safety/care replies bypass formatting so a crisis response cannot be table-forced or marker-forced.
- R25 verification passed: real teacher create/edit previews with full waits, prompt draft save, edit restore, publish, student read/use, non-owner 403, cleanup 404, student safety regression, lint, tsc, build, code-review-graph, and manual impact review.
- Remaining R25 risk: local remote LLM gateway still degraded to local-fallback after about 24 seconds; source/duration transparency remains, but latency should be handled in a separate gateway stability slice.

## QA Real-Use Correction 2026-07-08 R24

- R24 process correction: prompt edit quality was judged only after create-page preview completed, draft save returned, edit-page preview completed, publish returned, student read/use returned, non-owner mutation boundary returned, and cleanup completed.
- R24-PROMPT-EDIT-001 P1 fixed: `/prompts/[id]/edit` lacked `实时测试 / 运行测试 / AI 输出预览`, so teachers could not validate a modified draft before publishing. The edit page now uses the same real `/api/chat` preview flow as the new page.
- R24-PROMPT-EDIT-002 P2 fixed: new/edit prompt testing behavior could drift. Added `app/components/prompts/PromptTestPanel.tsx` and reused it from both pages.
- R24-PROMPT-EDIT-003 P2 fixed: prompt preview now shows returned duration in addition to source and safety status, making slow fallback visible.
- R24 verification passed: create preview full wait (~24s), edit preview full wait (~24s), publish, student visibility/use, non-owner 403, cleanup remaining R24 prompts = 0, lint, tsc, build, code-review-graph, and manual review.
- Remaining R24 risk: output-format requirements are still not included in the persisted prompt model or preview request body; future work should fold that field into the contract.

## QA Real-Use Correction 2026-07-08 R23

- R23 process correction: agent-to-chat quality was judged only after teacher creation/review submission, admin publish, student visible browser use, full `/api/chat` result return, session readback, browser deep-link restore, disabled-boundary checks, and cleanup.
- R23-AGENT-CHAT-001 P1 fixed: chat sessions did not persist the selected `agentId`. `chat_sessions.agentId` is now part of the server schema, mapper, session creation contract, and client session summary.
- R23-AGENT-CHAT-002 P1 fixed: `/api/chat` accepted arbitrary client `agentPreamble`. The server now resolves the selected agent from trusted DB state, builds the preamble server-side, blocks forged preambles with `400 invalid_agent_contract`, and blocks session/body mismatches with `409 agent_session_mismatch`.
- R23-AGENT-CHAT-003 P1 fixed: local fallback ignored selected agent identity. The completed real-use reply now says `我是「R23班会协作智能体-754679」` and carries the selected agent positioning.
- R23-AGENT-CHAT-004 P2 fixed: agent fallback was too generic for class-meeting scripts. Local fallback now returns concrete `暖场 / 分组任务 / 复盘收束` sections for班会/活动脚本 requests.
- R23 verification passed: API full wait (~24s), Browser full wait (~27s), browser page fetch readback, `/chat?session=...` restore, disabled-agent boundaries, cleanup, lint, tsc, build, code-review-graph, and manual impact review.
- Remaining R23 risk: external gateway still falls back after roughly 24 seconds in this environment; source/duration are visible, but latency remains a retention risk.

## QA Real-Use Correction 2026-07-08 R22

- Confirmed P1: agent draft/review visibility was too broad. A real teacher-created draft and review agent was visible to student list/detail/use calls before approval. Fixed by making non-owner non-admin users see only `pub` agents across list, detail, and use flows.
- Confirmed P1: admin agent governance was incomplete. `/admin/agents` displayed review status but provided no real approve/return/disable controls. Fixed with PATCH-backed table actions and returned status feedback.
- Hardened related search surface: global agent search now returns only published agents, preventing search-based discovery of draft/review agent names and descriptions.
- Verified with real-user workflow: teacher draft -> student hidden -> teacher review -> admin approve UI -> student visible/use -> admin disable UI -> student hidden -> cleanup. Static checks, build, browser checks, code-review-graph, and manual review passed.

## QA Real-Use Correction 2026-07-08 R20

- R20 process correction: prompt governance was judged only after visible teacher save/publish actions, complete API role readbacks, mutation-boundary checks, use-count verification, and cleanup.
- R20-PROMPT-GOV-001 P1 fixed: `暂存草稿` created public prompts. Drafts now persist as `draft`, are owner-only in list/detail/mutation paths, and show owner-only UI labels.
- Published regression passed: published prompt remains visible to student/admin, `use=1` increments calls, and non-owner mutations remain `403`.
- R20-QA-001 noted: use Unicode escapes or UTF-8 files for Chinese API harness inputs in PowerShell.

## QA Real-Use Correction 2026-07-08 R19

- R19 method correction: prompt-library quality was judged only after real teacher login, visible prompt creation, full preview return, publish/search/detail, card send-to-chat, fresh chat full assistant return, API persistence readback, role-boundary checks, and cleanup.
- R19-PROMPT-001 P1 fixed: AI classroom-guide prompt previews were routed to a generic meeting-material fallback. `app/lib/server/llm.ts` now prioritizes AI lesson-guide intent and returns objectives, lesson flow, safety/responsible-use guidance, tiered tasks, and review lens.
- R19-PROMPT-002 P1 fixed: narrow/mobile prompt cards lacked a direct send-to-chat action because the detail panel is xl-only. `app/app/(shell)/prompts/page.tsx` now supports card-level send while preserving detail-panel send.
- R19-PROMPT-003 P2 fixed: prompt-card action targets were too small for repeated teacher use. Final retest measured card actions at or above 42px and confirmed prompt prefill after waiting for hydration.
- Residual risk: external AI gateway still degraded to local fallback after a long wait; source/duration are visible and content is now fit for the tested teacher task, but latency remains a retention risk.

## QA Real-Use Correction 2026-07-08 R17

- R17 process correction: admin permissions were judged only after visible admin login, visible UI save, service-side readback, audit readback, UI restore, restore readback, and backend security checks.
- Confirmed and fixed `R17-ADM-PERM-001`: `/admin/permissions` action buttons, edit buttons, save controls, and permission switches were below stable touch size. The fix is local to `admin/permissions/page.tsx`; final Browser evidence reports `smallTargets=[]`, `disabledSmallTargets=[]`, switches about `35 x 56`, no overflow, and zero console error/warn logs.
- R17 backend evidence: `用户管理` saved true and restored false through API readback; `/api/audit` recorded `role_perms_update`; student GET/PUT permissions returned 403; invalid role GET/PUT returned 400.
- Remaining R17 risk: workspace/app are not git repositories, and Browser page evaluate does not expose fetch. API readback therefore used separate same-role HTTP sessions.

## QA Real-Use Correction 2026-07-08 R11

- R11 process correction: teacher meeting-material quality was judged only after the teacher prompt completed, the generated agenda/opening/student-cause/minor-safety/follow-up/minutes content was read through API/UI evidence, and copy/export carry-out actions were tested.
- Confirmed and fixed `R11-FE-001`: topbar whole-conversation copy failed when browser clipboard write was blocked. Added a copy chain and manual Markdown dialog fallback; final smoke evidence shows manual dialog, 2161 chars, required content checks true, and no console logs.
- Confirmed and fixed `R11-FE-002`: topbar whole-conversation export menu was unstable under real chat layout/click conditions. The primary export action now directly exports whole conversation Markdown with visible status/toast feedback; unreachable hidden menu code was removed.
- R11 verification passed lint, TypeScript, production build, Browser copy/export evidence, code-review-graph build/status, and manual impact review.
- Remaining R11 risk: in-app Browser Blob download event still times out, so OS-level saved-file proof is not available from this surface. Product-visible export completion and content integrity are verified; topbar multi-format export should be rebuilt as a stable accessible popover if needed.

## QA Real-Company Correction 2026-07-08 R10

- R10 process correction: real-company/school beta testing now requires real role login, real task execution, full UI/API/AI/export return, content reading, and internal discussion before judging product quality.
- Confirmed and fixed `R10-P2-001`: `/admin/audit` CSV export had no visible completion feedback when the in-app browser download event timed out. `exportCsv()` now returns the CSV content and shows success/failure toast; `buildCsvContent()` centralizes CSV generation with BOM.
- R10 evidence: student integrity request returned full `integrity-scaffold` and persisted; teacher class API returned `integrityWeekly=7`; student unauthorized `/admin/audit` deep link produced a real `deny` audit row; admin export retest showed `CSV 已生成 · 服务端审计日志.csv · 65 条记录`.
- Remaining R10 risk: OS-level saved-file proof is not available from the in-app browser download surface; API content readback, product toast, and code review are the fallback evidence.

## QA Real-Use Correction 2026-07-08 R6 Addendum

- R6 admin governance correction: conclusions were made only after a real admin login, API readback, UI ticket state transitions, model save feedback, and export generation evidence were returned and read.
- Confirmed and fixed `R6-FE-001`: `/admin/audit` search was decorative. Searching `未知IP` still showed unrelated sample audit rows. Added controlled query state, multi-field filtering, and an empty state.
- Confirmed and fixed `R6-FE-002`: `/admin/permissions` user search was decorative. Searching `no-such-r6-user` still showed teacher rows. Added controlled query state, multi-field filtering, and an empty state.
- R6 verification passed lint, TypeScript, production build, production restart, Browser retests, final API readback, code-review-graph build/status, and manual impact review.
- Remaining R6 risk: full 12-hour objective remains active; R6 closes only the admin governance slice.

## QA Real-Use Correction 2026-07-08

- R4 teacher workflow correction: product conclusions were made only after a real teacher login, knowledge search result, full AI response, and chat-session API persistence evidence were all returned and read.
- Confirmed and fixed `R4-FE-001`: knowledge detail-side search controls could overflow at desktop width. Native overflow constraints and narrower detail/sidebar layout now keep `outside=[]` and `overflowX=false`.
- Confirmed and fixed `R4-AI-001`: teacher local fallback could answer a quadratic lesson prompt with an electric-circuit lesson. `localTeacherLesson()` now detects quadratic/vertex prompts and returns topic-matched lesson sections.
- Confirmed and fixed `R4-FE-002`: chat sidebar long real session previews had overflow risk. The sidebar list now uses native vertical scrolling with `min-w-0` and `overflow-x-hidden`; browser retest passed.
- Confirmed process defect: route/API/button/static checks alone do not satisfy the requested real-company internal testing style. Product evaluation now requires role-driven use, waiting for full returned results, reading content, then judging UX/business/compliance value.
- Confirmed and fixed `R1-P1-001`: real researcher chat task initially waited about 4m49s before fallback. Gateway failure budget is now bounded and the UI shows a slow-response notice after 10s.
- Confirmed and fixed `R1-P2-002`: researcher local fallback now covers sample/cycle, minor protection and ethics, data collection fields, and 3 actionable classroom improvement suggestions.
- Confirmed and fixed `R1-P2-003`: chat bubbles now show response duration and source (`真实模型`, `本地兜底`, `网关降级`).
- Remaining candidates for next real-use pass: mobile chat/session new-conversation entry, mobile export menu persistence/crowding, login prefilled teacher credentials causing possible role confusion.

## QA 12h Preflight 2026-07-08

- Current app has no package-level `test` script; the 12-hour internal QA needs scripted HTTP checks plus Playwright/Edge browser audits rather than assuming an existing test suite.
- Current workspace and `app` directory are not Git repositories; CodeRabbit PR review and checkpoint commits are unavailable. Use supervisor artifacts, code-review-graph, runtime logs, screenshots, and Markdown reports as fallback evidence.
- Jam requires a Jam UUID and edX is course-search only; both are non-core for this product QA unless the user provides a Jam bug report or explicitly asks for learning resources.
- The latest deployment report names `https://app-eta-olive-27.vercel.app` as the production alias; online checks should be low-frequency functional verification, not load testing.

## Current-State Findings

- The baseline app already had strong page structure and useful dashboards, but the same deep brand sidebar was used for both learning pages and admin pages.
- Several components referenced semantic variables such as `--ok-bg` before they were defined globally.
- Recharts `ResponsiveContainer` produced width/height warnings during build and browser runtime.
- Chat demo data used `Date.now()` at module load, causing SSR/CSR relative-time text mismatches.
- The workspace is not a git repository, so checkpoint commits and git-diff review are unavailable.

## Resolved

- Added route-level `data-register`: admin pages use `console`, all other post-login pages use `campus`.
- Added console/campus token layers for surfaces, radii, shadows, topbar, rail, hover and selected states.
- Converted key primitives and shell surfaces to token-driven styling.
- Replaced `ResponsiveContainer` usage with `ChartMount` measured numeric sizing.
- Replaced demo chat `Date.now()` usage with fixed `DEMO_NOW` for deterministic hydration.
- Captured final screenshots and verified runtime logs for `/chat` and `/admin/analytics`.
- Completed a second-pass token sweep across admin audit, permissions, models, agents, analytics, HourHeatmap, and shared UI controls.
- Fixed admin models nested button hydration risk by changing the outer card to `div role="button"` with keyboard activation.
- Added horizontal overflow and stable minimum widths to mobile admin audit/permissions/agents tables so columns do not collapse at 390px.
- Re-ran hardcoded color scan across admin routes, admin components, and shared UI primitives with no matches for `#xxxxxx` or arbitrary-color Tailwind patterns.

## Residual Risks

- `code-review-graph detect-changes` cannot provide a meaningful diff review without git history; graph build and manual impact review were used instead.
- No image generation assets were created in this implementation pass.
- Future new pages or third-party UI imports still need explicit `campus`/`console` register assignment and token mapping.

## QA Round 2026-07-03 Working Findings

- Current root and `app` directory are still not git repositories; CodeRabbit CLI review and git checkpoint/diff review are unavailable unless a repo is initialized or attached.
- `package.json` exposes only `dev`, `build`, `start`, and `lint`; backend/API checks must be performed through live HTTP scripts instead of a built-in test runner.
- Fresh QA found 17 confirmed issues: P1=6, P2=10, P3=1. Highest-priority items are `/api/audit` anonymous write, `/api/class` API/page authz mismatch, production demo seed gate, UploadDialog interval cleanup, chat attachment affordance, and login carousel `aria-hidden` focusable buttons.
- Browser evidence saved under `.codex-supervisor/qa-20260703-browser`; Data Analytics report artifact was validated and rendered.

## Remediation Round 2026-07-03 Findings

- Fixed all P1 issues from the 2026-07-03 issue list: `/api/audit` now requires a real session token and canonical user recheck; `/api/class` now applies the same role policy as the page; production demo seed is gated by `EDUAI_ENABLE_DEMO_SEED`; UploadDialog parse timers are cleared; chat attachment/image/mic affordances no longer pretend to upload; login carousel no longer hides focusable indicator buttons from assistive tech.
- Fixed the high-value P2 frontend and backend items that were verified locally: session payload validation and DB recheck, duplicate safety-ticket suppression, mobile sheet title/description, nameless icon buttons, missing switch/form labels, topbar fake search surface, static prompt cards, body hydration suppression removal, and broad variant matching for split crisis/integrity phrases.
- Residual closure update: safety classification now uses a structured semantic scoring layer (`classifySafety`) with normalization, split/compact/token matching, pinyin/English coverage, care detection, and negated-integrity handling. Three.Clock warning was removed by pinning `three`/`@types/three` to `0.182.0`, because current Fiber latest still internally constructs `THREE.Clock` while r183+ emits the warning. Node 24 `node:sqlite` remains an expected platform warning, not one of the 17 QA defects.
- Review evidence is runtime-based because the workspace has no git history or formal test suite. Evidence used: lint, `tsc --noEmit`, production build, live HTTP checks, Playwright Edge DOM checks, code-review-graph impact/detect-changes, and manual review.
## QA Round 2026-07-05 Findings

- Confirmed P1: admin hard-refresh/direct navigation to `/admin/*` can be redirected to `/dashboard` because `app/(shell)/admin/layout.tsx` gates on client zustand role before hydration while the store defaults to `teacher`.
- Confirmed P2 clusters: admin audit nameless row action buttons, unlabeled Switch controls, unassociated profile/prompt form labels, swallowed audit/ticket fetch failures, no-op visible action buttons, and missing route-level rate limits for chat/safety/integrity writes.
- Verification evidence: lint, tsc, build, 24/24 live HTTP checks, Playwright Edge 20-route desktop/mobile pass, and code-review-graph 130 files / 378 nodes / 3495 edges.
- Delivered issue list: `开发材料/问题清单-三轮内测-20260705.md`.

## Company-Style QA Round 2026-07-05 Approved

- Executed the user-approved three-round company-style internal test pass with Browser plugin plus Playwright/Edge, live HTTP API checks, and code-review-graph.
- Round 1 verified four real role journeys and screenshots. Final landing URLs: teacher `/dashboard`, student `/learn`, admin `/admin/analytics`, researcher `/chat`; unauthorized console/class access redirected or denied as expected.
- Round 2 found and fixed P1 `R2-AI-001`: local fallback AI used student-style scaffold for teacher normal teaching prompts. `lib/server/llm.ts` now branches teacher/researcher/admin/college-admin while preserving student scaffold and soft-concern priority.
- Round 3 found and fixed P2 `R3-A11Y-001`: `/agent` card `MoreHorizontal` buttons lacked accessible names. `app/(shell)/agent/page.tsx` now labels each card's more button with the agent name.
- Post-fix evidence: lint, tsc, production build, targeted API/agent regression, full 52-page browser a11y/perf regression with zero console/a11y/overflow/overlay/slow-page offenders, and code-review-graph build 131 files / 386 nodes / 3560 edges.
- Environment note: production `next start` requires `EDUAI_SESSION_SECRET`; `.env.example` already documents the required key. QA used a process-only random test secret and did not write secrets to disk.
- Delivered reports: `开发材料/问题清单-三轮真实公司级内测-20260705.md` and `开发材料/三轮真实公司级内测执行报告-20260705.md`.

## QA Real-Use Correction 2026-07-09 R43

- R43-CHAT-ONB-001 (fixed): first-run onboarding could delayed-mount over `/chat?session=...` on mobile and block the real send button. Root cause: onboarding was global to the shell and appeared after route hydration even when the user was already inside a concrete chat workflow. Fix: `OnboardingGuide` now unmounts immediately on dismiss, only shows on the role home route, and excludes `/chat`.
- R43-CHAT-TARGET-002 (fixed): desktop sidebar new-chat button rendered below a stable 44px interactive baseline. Fix: `ChatSidebar` uses explicit 52px height and the harness now asserts `buttonBox.height >= 44`.
- R43-HARNESS-003 (fixed): mobile Enter fallback could mask a blocked send button. Fix: R43 harness now requires `mobileTurn3.clicked === true` and keeps response/content/readback gates.
- R43 evidence: final Playwright log `r43-chat-longchain-R43_CHAT_LONGCHAIN_1783618038097.json` returned `verdict=pass`, `issues=[]`; lint, tsc, build, production restart, code-review-graph, and manual impact review passed.

## QA Real-Use Correction 2026-07-09 R44
- R44-ANALYTICS-001 P1 found during returned-content review: admin analytics active-account KPI could exceed current total users because historical audit rows included cleaned-up temporary user ids. Root cause: active user aggregation counted raw audit userId values without joining current users. Fix: bound the active-user query to current users only and rerun API/UI checks.
- R44-ANALYTICS-002 P2 found during mobile/browser review: key enabled analytics/topbar controls rendered near 42px in the current scaled environment, below the stable 44px baseline used in the real-use QA gate. Root cause: rem-based `h-12`/`min-h-12` measured smaller than expected under current font scale. Fix: use explicit 48px action sizing for the analytics action buttons and shared topbar icon controls.
- R44 evidence: `/api/admin/analytics` now returns protected real aggregate data from backend tables; admin returned 200, student 403, anonymous 401; stale static values were absent from UI; Browser desktop/mobile checks reported no small enabled buttons, no horizontal overflow, and no console errors; lint, tsc, build, production restart, code-review-graph, and manual impact review passed.

