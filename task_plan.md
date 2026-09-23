# Task Plan - EduAI Prism UI Implementation v1.2

Round: `round-ui-20260627-continue`
Continuation round: `round-ui-20260627-token-sweep`
QA round: `round-ui-qa-20260703-triple-pass`

## Goal

Implement the v1.2 post-login UI direction in the local Next app, visually compare against the provided reference images, run verification, and deliver an implementation/visual acceptance report.

## Plan

1. Refresh supervisor state and inspect the existing app, document, and reference screenshots.
2. Capture baseline screenshots for dashboard, chat, explore, hub, and admin pages.
3. Implement S1 UI system changes:
   - route-level `data-register`
   - semantic status tokens
   - console/campus shell styling
   - token-driven cards, buttons, badges, tabs, controls
4. Fix stability issues found during verification:
   - Recharts width warnings
   - chat hydration mismatch from demo timestamps
5. Capture final desktop/mobile screenshots and compare to reference images.
6. Run lint, production build, runtime log checks, code-review-graph build, and manual review.
7. Write final implementation and visual acceptance report.
8. Complete second-pass token sweep for admin audit/permissions/models/agents/analytics and shared UI controls.
9. Re-verify mobile table behavior, hydration logs, and updated acceptance report.

## Scope

- In scope: UI shell, global tokens, high-impact primitives, chart stability, chat demo timestamp stability, final QA report.
- Out of scope: pixel-perfect recreation, new image generation, deployment, git commits, Box/Base44 migration.

## Verification

- `npm run lint`
- `npm run build`
- Playwright Edge screenshots at 1440x900 and 390x844
- Incremental dev-server log checks for `/chat` and `/admin/analytics`
- Second-pass visual screenshots in `.codex-supervisor/visual-token-sweep`
- Hardcoded color scan for admin routes/components and shared UI primitives
- `python -m code_review_graph build --repo D:\VB\LLM-School\app --skip-flows --data-dir D:\VB\LLM-School\.codex-supervisor\code-review-graph`

## QA 12h Preflight - 2026-07-08

Goal: prepare a reviewable 12-hour full-stack internal testing and self-iteration plan before running the long QA loop.

1. Refresh supervisor context and current workspace facts.
2. Derive coverage from current routes, APIs, prior QA findings, and deployment notes.
3. Write a review-ready plan with timeboxes, role division, issue lifecycle, and plugin fallback rules.
4. Self-review the document and hand off to the user before starting long-running execution.

Verification evidence:

- Supervisor bootstrap round `qa-12h-preflight-20260708`
- Current route/API listing from `rg --files D:\VB\LLM-School\app\app`
- Package script inspection from `D:\VB\LLM-School\app\package.json`
- Review document: `D:\VB\LLM-School\开发材料\EduAI-Prism-12小时前后端全细节内测与自我迭代方案-20260708.md`

## QA Round - 2026-07-03

Goal: run three supervised internal test rounds for the current app state and produce a concrete issue list.

1. Round 1: static/build/frontend code quality checks.
2. Round 2: backend/API/auth/safety runtime checks through real HTTP requests.
3. Round 3: browser visual/runtime/accessibility checks plus independent review.
4. Publish issue list and QA report under `开发材料`.

Verification evidence:

- `npm run lint`
- `npm run build`
- API runtime script against a local Next dev server
- Playwright/Edge page checks and screenshots where possible
- code-review-graph build/status + structural review tools
- supervised sub-agent review summaries

## Remediation Round - 2026-07-03

Goal: fix the confirmed QA issues with the smallest safe changes, verify through static/build/runtime/browser checks, and publish a remediation report.

1. Backend security/data fixes: audit authentication, class authorization parity, production demo-seed gate, session payload validation, session DB recheck, and duplicate ticket suppression.
2. Frontend quality fixes: UploadDialog timer cleanup and labels, login carousel a11y, mobile sheet labels, topbar semantic search button, fake chat tools, agent form labels, dashboard/learn hydration cleanup, and static prompt card semantics.
3. Safety mitigation: improve split/variant crisis and integrity phrase matching while preserving the existing local classifier contract.
4. Verification: lint, typecheck, production build, live API role/safety checks, Playwright Edge DOM checks, code-review-graph impact review, and manual review.
5. Publish `开发材料/问题修复与优化升级报告-20260704.md`.

Status: complete for the original 17-item issue list. The residual pass added `classifySafety` semantic scoring, live API coverage for safety variants, and a `three@0.182.0` lock that removes the `THREE.Clock` warning while keeping Fiber/Drei peer ranges valid. Node 24 `node:sqlite` remains a known platform warning outside the 17-item list.
