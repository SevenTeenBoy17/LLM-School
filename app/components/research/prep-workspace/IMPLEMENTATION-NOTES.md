# Prep Frontend Integration

Scope: this directory and `app/app/(shell)/research/prep/page.tsx` only.

## Boundaries

- New projects and edits use the shared authenticated per-tab demo state hook. No project, evidence, discussion or AI mutation endpoints are called.
- Example records remain explicitly identified. New drafts start with no classroom evidence. Adaptations retain source identity/version but omit evidence, discussions and members.
- Template library reads the existing prompt endpoint and preserves the existing PrepWizard. This separate live entry retains its existing navigation into personal chat.
- Local revision history contains goal/question summaries, not complete recoverable server snapshots. Attachments, real member invitations and permissions are not implemented.
- Model/processing location remain unknown. AI generation is always disabled; scope preview sends nothing.
- Material entries contain content-derived document DOM previews, not worksheet icons or index-derived labels. An absent personal adaptation is labeled not yet created and opens creation confirmation against its actual source.
- Demo limits: 24 projects including archived items, 1.5 MB serialized UTF-8 state, 40 lesson rows/observations/opinions/revision summaries per project and 20 replies per opinion. Rejected saves retain current edits; history is not silently removed. These are demo limits, not a browser quota guarantee.
- The group tab explicitly includes all private per-tab projects. Pending-task entries open the corresponding discussion, including its dialog on narrow screens.
- Unsubmitted opinions, replies and per-opinion handling reasons are separate from saved discussions. Saves refuse while these inputs remain pending; leaving the detail and browser unload warn. Handling-dialog dismissal retains its input. Dirty retained creation forms also register unload protection.
- Personal adaptations only copy a saved project. Unsaved observations/discussions/body edits or pending composer text block creation until the original is saved. Evidence is still excluded from the adaptation.
- Saving identical content and stage is a no-op, including when all 40 revision slots are occupied. Full-history changes stay in the editor. Backup/recovery exports both the saved baseline and current draft, including evidence, discussions, revision summaries and unsubmitted text; restores only into the same project's unchanged saved baseline, with explicit overwrite confirmation. The quota is not removed and histories are not truncated. Restoring the last saved state requires explicit confirmation of discarded unsaved input.
- The workspace loading indicator is indeterminate. Shared storage messages take precedence over the generic memory-only warning. Identity revalidation remains owned by the shared ResearchIdentityBoundary; no duplicate authentication behavior is added here.
- SPA departure buffers now live in a prep-only module Map, scoped to the owner returned by useResearchOwner (including sessionVersion) and project ID. They retain the saved baseline, edited draft and unsubmitted opinion/reply/reason inputs on unmount. Only the same owner/project/full saved baseline can restore. Successful saves and explicit discard clear the buffer before an immediate unmount can re-add stale state. Creation forms have a separate owner-scoped buffer, cleared on successful creation or explicit discard.
- These buffers do not alter browser history or use sessionStorage/backend writes. They disappear on a real page reload, module replacement or tab close; beforeunload and manual JSON backups remain necessary. Opening an existing project with a changed saved baseline never silently merges an older draft.

## Integration QA

- Entry selector: `[data-testid="prep-workspace"]`; detail: `[data-testid="prep-detail"]`.
- Verify home search/subject/type filters, archive/restore, template load errors and retry.
- Create a blank research project. Assert no example observations exist. Close a dirty creation dialog by Escape and verify keep/discard choices.
- Open the water example, edit/save a goal, reload, reopen, and verify persistence for the same authenticated tab.
- Respond to an opinion and mark it handled with a required reason. Save, reopen and check the All filter retains both records.
- Open reflection, inspect scope, deselect text, inspect unknown model state; assert zero chat or mutation requests.
- Adapt a sample, verify source link information and zero inherited evidence.
- Check desktop and 390px layouts, outline collapse and narrow-screen discussion dialog focus return.
- Verify all three material previews remain present at medium width, distinguish pending from saved adaptations, and open the matching document/observation/copy confirmation.
- At project/byte limits, ensure creation and copy dialogs retain input on rejection. Save-and-return must remain in the editor when a save is rejected.
- Type only a reply or handling reason, dismiss/reopen, attempt save/back/reload and verify pending text remains visible and warned. Confirm a dirty creation form also warns on reload, including after choosing to retain and close.
- Repeated unchanged saves must preserve version, timestamps and history count. At 40 summaries, export a complete JSON backup, reload the unchanged project and restore the draft and all unsubmitted fields. Wrong-project/mismatched-baseline/malformed backups must not overwrite current input.
- Type body/observation edits and unsubmitted opinion/reply/reason text, use SPA browser history to leave, return and reopen the same project. Verify restoration only for the same saved baseline and owner; save or explicitly discard, then repeat the navigation and assert no stale draft returns. Repeat with an unfinished creation form. Real reload is deliberately not a module-memory persistence test.

Independent advisory review and the main task's integration/visual QA remain required. This note is not a formal acceptance or Gate record.
