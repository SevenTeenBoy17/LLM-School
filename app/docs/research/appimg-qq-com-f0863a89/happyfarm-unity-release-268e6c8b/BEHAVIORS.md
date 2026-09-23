# EduAI Manor v5.2 Behaviors

## Reference interaction findings

- Persistent edge controls are visible without covering the central work area.
- Secondary systems open in a tray attached to their trigger; they do not dim the scene.
- Search, editing, and inventory-style tasks open in a centered modal and dim the scene.
- A trigger darkens immediately on press even when content takes longer to arrive.
- Scene objects carry status close to the object instead of duplicating state in a dashboard card.

## Product timings

- Pressed feedback: `90ms`.
- Attached flyout reveal: `180ms`, `cubic-bezier(.2,.8,.2,1)`.
- Modal reveal: `220ms`, `cubic-bezier(.2,.8,.2,1)`; dismissal immediately restores focus instead of delaying keyboard control.
- Mock operation delay: deterministic `520ms`; conflict and failure scenarios use the same pending phase.
- `prefers-reduced-motion` removes transforms and reduces all transitions to `1ms`.

## Interaction matrix

| Trigger | Surface | Result |
| --- | --- | --- |
| Project compass | Anchored flyout | Milestones and evidence-chain progress |
| System entry | Anchored flyout | Today, memory, workshop, or wellbeing summary |
| Activity rail | Anchored flyout/drawer | Current project, class build, portfolio, messages |
| Scene node | Modal workspace | Node evidence, status, learning objective, next action |
| Observe | Modal workspace | Choose a scene node and create a structured observation |
| Record | Modal workspace | Capture evidence title, method, finding, and source |
| Link | Modal workspace | Link evidence to objective and claim with a typed relation |
| Support | Anchored flyout | Rubric, method hints, and revision guidance |
| Submit/Revise | Modal workspace | Validate and submit a claim, then process review result |
| Publish | Modal workspace | Publish only an accepted claim as an artifact |

## State rules

- Buttons remain pending until an `ActionResult` is returned.
- Duplicate submissions are disabled while pending.
- Weak cross-disciplinary links are rejected when they lack a shared problem, objective, evidence, or causal role.
- A claim without conclusion, evidence, reasoning, or limitation is rejected.
- A failed operation never mutates the authoritative in-memory snapshot.
- Reloading resets the demonstration; no browser storage or network request is used.
