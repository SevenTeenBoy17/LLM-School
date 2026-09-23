# Manor v5.2 Backend Integration Contract

## Current boundary

This delivery is deliberately front-end only. `ManorExperience` calls the adapter returned by `createMockManorExperienceAdapter`; the adapter uses deterministic memory, does not call `fetch`, and does not write browser storage. Refresh creates a fresh adapter and resets all demonstration state. Existing `manor.v2`, authentication, database, routes, and server actions remain unchanged.

## Adapter replacement

Keep the UI dependent on `ManorExperienceAdapter`, then replace only the composition root with a future `HttpManorExperienceAdapter`. Its public surface remains:

| Method | Proposed endpoint | Intent |
| --- | --- | --- |
| `bootstrap` | `GET /api/v3/manor-experience/projects/{projectId}` | Return objectives, project, milestones, graph, review state, artifacts, and reflections. |
| `recordEvidence` | `POST /api/v3/manor-experience/evidence` | Store a sourced observation or measurement. |
| `linkEvidence` | `POST /api/v3/manor-experience/evidence-links` | Validate and store an explicit evidence role. |
| `submitClaim` | `POST /api/v3/manor-experience/claims` | Submit conclusion, evidence, reasoning, and limitation for review. |
| `reviseClaim` | `PUT /api/v3/manor-experience/claims/{claimId}` | Create a new immutable claim revision. |
| `publishArtifact` | `POST /api/v3/manor-experience/artifacts` | Publish an accepted claim and its project reflection. |

No UI component imports an HTTP client directly. Scenario fixtures remain available only in development and test builds.

The six methods above remain the complete learning-operation surface. A production HTTP composition also injects a separate transport recovery capability; it is not a seventh learning action:

```ts
interface OperationStatusResolver {
  lookupOperation(operationId: string): Promise<OperationLookupResult>;
}

type OperationLookupResult =
  | { state: "pending"; operationId: string; retryAfterMs: number }
  | { state: "completed"; operationId: string; result: ActionResult<unknown> };
```

`GET /api/v3/manor-experience/operations/{operationId}` returns `202` with `state: "pending"` while the original transaction is unresolved. Once committed or rejected, it returns `200` with `state: "completed"` and the original authoritative `ActionResult`; repeated lookups must not create another mutation. An unknown operation returns `404`. An operation owned by another student is not disclosed; authorization uses the authenticated school/user scope and returns the deployment's non-enumerating `404` policy response.

## Response envelope

Every mutation returns the same authoritative shape before the UI may announce success:

```ts
interface ActionResult<T> {
  operationId: string;
  stateVersion: number;
  status: "success" | "validation_error" | "conflict" | "offline" | "disabled" | "error";
  message: string;
  authoritativeEntity: T | null;
  snapshot: ManorExperienceSnapshot;
  nextActions: string[];
  fieldErrors?: Record<string, string>;
}
```

The server owns IDs, timestamps, status transitions, review decisions, and `stateVersion`. The client must replace its snapshot with the returned snapshot; it must not infer a committed result from HTTP 2xx alone.

## Consistency and idempotency

- Client creates a UUID `operationId` once per deliberate submit and sends it as `Idempotency-Key`.
- Client sends the last accepted version as `If-Match: "{stateVersion}"`.
- Repeating the same key and semantically identical body returns the original result.
- Reusing a key with a different body returns `409 idempotency_payload_mismatch`.
- A stale version returns `409 state_version_conflict` with the latest safe snapshot and suggested next actions.
- Server transaction commits entity, graph edge, state transition, audit record, and outbox event atomically.
- Timeouts remain unresolved until status is queried by `operationId`; the UI must never convert a timeout into success.

## Validation rules

- `EvidenceLink.relation` is one of `supports`, `contradicts`, `context`, or `method`.
- Cross-disciplinary links share one project question, name a learning objective, use the same evidence object, and explain the evidence's role.
- Similar words or themes alone are rejected.
- A claim requires conclusion, at least one owned evidence ID, reasoning, and limitation.
- Only an accepted claim can publish an artifact.
- Reflection accompanies publication and records what was reliable and what should change next.
- Growth state changes only from valid evidence/review events, never clicks, duration, streaks, or random rewards.

## Permission matrix

| Capability | Student | Teacher | School admin |
| --- | --- | --- | --- |
| Read own project graph | Own project | Assigned classes | School-scoped support access |
| Record/link/submit/revise | Own active project | No impersonated writes | No impersonated writes |
| Review claim | Read result | Assigned students | Policy/audit only |
| Publish artifact | Own accepted claim | Moderate class visibility | Configure retention |
| Read collaborator data | Minimal project identity | Assigned class | Audited school scope |

All authorization is enforced server-side from the session and resource ownership. IDs in request bodies never establish ownership.

## Audit fields

Persist `operationId`, `actorId`, `actorRole`, `schoolId`, `classId`, `projectId`, entity type/ID, prior/new `stateVersion`, action, result, validation rule version, review rubric version, client timestamp, server timestamp, correlation ID, and redacted error code. Do not store raw secrets, access tokens, or unrelated student content in audit payloads.

## Deployment paths

### School server

- One containerized Next.js application plus the school's managed relational database and object storage.
- No mandatory public ingress; use the school identity provider or the existing local account service.
- Assets under `/public/art/manor-v3` are static and work without model access.
- Queue review/outbox work locally; expose health, backup, restore, retention, and clock synchronization checks.

### Internet deployment

- Keep the same adapter contract behind TLS, origin checks, rate limits, session protection, and school tenant isolation.
- Serve generated static art through a controlled CDN with immutable hashes.
- Use region-appropriate minor privacy, retention, deletion, export, and teacher-access policies.
- Separate analytics from grading evidence and collect only purpose-bound events.

## Rollout

1. Implement the HTTP adapter behind a disabled feature flag.
2. Run contract tests against Mock and HTTP implementations with the same fixtures.
3. Shadow-read bootstrap and compare normalized snapshots without exposing server output to students.
4. Enable one non-production class, then a school pilot with rollback to Mock/demo mode.
5. Require zero unresolved version conflicts, authorization defects, and audit gaps before general release.

No runtime model key is required for the manor. Any key previously shared in chat must be revoked and rotated by its provider; it is intentionally absent from code, assets, logs, and documentation.
