## What we're building

A public, no-login area where a client and the studio talk in one shared conversation, tied to a project. Same conversation powers status updates, design approvals, and file uploads. Payments will come as a follow-up because they require picking a provider and setting up products.

## Client side (public, no login)

- `/client` — landing form: name, email, project brief. Creates a project + conversation, then redirects to `/client/:token`.
- `/client/:token` — the client's workspace, opened by shareable link (token in URL, no password). Tabs:
  - **Messages** — realtime chat with the studio. Client's messages tagged as "Client", studio's as "Studio".
  - **Project** — current phase, next milestone, timeline (updated by staff).
  - **Approvals** — items the studio has sent for review; Approve / Request changes buttons, timestamped.
  - **Files** — drag-drop uploads (references, site photos); can also download studio deliverables.
  - Payments tab is stubbed with "Invoices coming soon" — needs a separate turn to enable Stripe.

## Studio side (staff, behind existing auth)

- `_authenticated/inbox` — list of all client conversations, unread count, last message preview.
- `_authenticated/inbox/:projectId` — same message thread the client sees, plus:
  - Edit project phase / next milestone / timeline.
  - Create a new approval request (title + optional file link).
  - See uploaded files.
  - Copy the client's shareable link.

## Data model (new tables)

- `projects` — id, client_name, client_email, brief, phase (`inquiry|design|documentation|construction|complete`), next_milestone, share_token (uuid, unique), created_at.
- `messages` — id, project_id, sender (`client|studio`), body, created_at.
- `approvals` — id, project_id, title, description, status (`pending|approved|changes_requested`), decided_at, decision_note.
- `project_files` — id, project_id, uploaded_by (`client|studio`), filename, storage_path, size, created_at.
- Storage bucket `project-files` (public read via signed URLs, uploads via server function).

RLS: staff (authenticated) can read/write everything. Client-side reads/writes go through server functions that verify the `share_token` from the URL — no anon RLS on these tables. Realtime enabled on `messages`, `approvals`, and `projects` so both sides see updates live.

## Tech notes

- Server functions in `src/lib/portal.functions.ts` handle token-verified client actions (send message, upload file, decide approval, fetch state).
- Staff mutations use `requireSupabaseAuth`.
- Realtime: client uses publishable key + filters by `project_id`; policies grant `SELECT` to `anon` on rows whose token matches — implemented via a `has_project_access(token)` SQL helper.
- New route files: `src/routes/client.tsx`, `src/routes/client.$token.tsx`, `src/routes/_authenticated/inbox.tsx`, `src/routes/_authenticated/inbox.$projectId.tsx`. Existing `_authenticated/portal.tsx` is replaced by a redirect to `/inbox`.
- The AI Design Assistant and other modules stay as-is.

## Out of scope this turn

- Real invoicing / Stripe checkout (needs `recommend_payment_provider` + product setup — separate turn).
- Email notifications when a new message arrives (needs email domain setup — separate turn).
- AI auto-reply on the client side; studio replies manually for now.

Ship this, then we can layer payments and email on top.