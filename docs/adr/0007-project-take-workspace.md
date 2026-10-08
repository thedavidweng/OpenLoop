# ADR-0007: Projects and Takes form the creative workspace

**Status:** Accepted for #261.

A Project groups a musical idea. A Generation Task captures one submitted request
and can produce several Takes. Each Take points to one completed Generation
Record and may identify a parent Take for explicit iteration. Reproduction uses
the recorded seed/settings if the Engine supports it; a variation is a new Take.
A/B selection belongs to the Project's Take workflow, not primarily global History.

History remains the cross-project view of completed outputs (ADR-0001). Failed
and cancelled tasks preserve request state and permit retry, but never become
History. Successfully completed earlier Takes remain if a later Take fails.
Project deletion unassigns completed Takes and preserves their History/artifacts.
Deletion of audio/artifacts still requires explicit confirmation.

SwiftUI owns selection/draft/presentation only. The UI is curated around Compose,
Generate, Listen/Compare/Iterate, capability-gated edits, and Export; it must not
auto-render arbitrary engine schemas into generic forms.
