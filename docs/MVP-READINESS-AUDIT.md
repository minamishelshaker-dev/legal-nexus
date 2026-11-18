# MVP Readiness Audit — 18 November 2026

## Executive status

The latest code-bearing production deployment is READY:

- Deployment: `dpl_FtWAtuLFWVGWcoEFiq6KVNqXskSJ` (READY)
- Deployed commit: `31275462d63f66992f7bffc68b126be0edc0e3d4`
- Commit message: `Fix stylesheet imports in core record detail routes`
- Production alias: https://legal-nexus-hayah7.vercel.app
- Framework: Next.js 15.5.29
- Build completed successfully, TypeScript validation passed, and all 19 static-generation steps completed.
- The build output includes `/workspace/contracts/[id]` and `/workspace/matters/[id]` detail routes, alongside the existing legal request and member workflows.
- The build still reports a non-blocking warning about missing SWC dependencies in the lockfile; no validated package lockfile has been committed.

The latest application code is live on the production alias. Subsequent commits after this deployment, if any, are documentation-only.

This is an infrastructure and source review, not a completed end-to-end acceptance test. The production database currently has zero organization memberships, so no owner/admin/member/invitee workflow has been exercised with real organization users. Signup, email confirmation, login, logout, password recovery and organization creation also remain pending live acceptance testing.

## Verified infrastructure

- Vercel project: `legal-nexus`; framework: Next.js.
- GitHub repository: `minamishelshaker-dev/legal-nexus`; branch: `main`.
- Supabase project ref: `vzeaiqogntexdqggqyiy`; status: `ACTIVE_HEALTHY`; region: `eu-central-1`.
- Applied Supabase migration history: 60 entries, including audited membership lifecycle, same-organization request assignment, internal-comment visibility and approval-state integrity.
- **Migration-source drift:** only 13 SQL migration files are currently present in GitHub, while 60 versions are applied in Supabase. The 47 missing historical source files are listed in [Database Migration Recovery](./DATABASE-MIGRATION-RECOVERY.md). Production is healthy, but a fresh database cannot yet be reproduced from this repository alone; do not reset or replay production migrations.
- Public base tables: 28; RLS enabled on all 28.
- Private Storage buckets: `employee-records-private` and `investigation-evidence-private`; both are non-public and have a 50 MiB per-file limit.
- Security advisor: no findings after the membership-management migrations.
- Health advisor: no findings.
- Vercel runtime error clusters: none found in the previously selected 24-hour window.
- Performance advisor: 103 unused-index informational findings. Given the currently empty/low-traffic application state, do not drop these indexes solely on this signal; reassess after representative production usage.

## Source review

### Implemented paths/components found

- Bilingual public landing page (Arabic / English).
- Email/password signup and login forms.
- Supabase Auth callback route supporting PKCE code exchange and OTP token hashes.
- Session-aware middleware for workspace and onboarding routes.
- First-organization onboarding. A database trigger adds the creator as organization owner.
- Organization structure: corporate entities and departments.
- Legal matters and contract record creation/listing.
- Legal request intake/listing.
- Administrative investigation intake and a multi-tab case-detail interface for sessions, statements, evidence, minutes, recommendations, decisions and appeals.
- Private investigation evidence upload flow records SHA-256 and custody events through a database RPC.

### Contract and legal-matter detail/edit workflow — source and production build verified

- Contract and matter list rows now link to dedicated detail pages.
- `/workspace/contracts/[id]` supports editing the contract title, reference number, counterparty, type, status, start/end dates, amount and currency.
- `/workspace/matters/[id]` supports editing the matter title, reference, type, status, priority, description, opened date and closed date.
- The UI checks the current organization role before enabling edits. Database RLS independently restricts updates to owner/admin/legal_manager/lawyer/contract_manager for contracts and owner/admin/legal_manager/lawyer for legal matters.
- No direct delete action is exposed in these screens.
- The Vercel production build generated both detail routes successfully.

**Important boundary:** the screens and role checks are deployed, but the production database has no organization memberships or contract/matter records. Real-user edit and denial tests have not yet been performed.

### Contract and legal-matter audit trail — database controls applied

- Added an AFTER INSERT/UPDATE/DELETE trigger to both `contracts` and `legal_matters`.
- Each event records the organization, actor, resource type and record ID, operation, and changed field names in `audit_events`.
- The audit metadata intentionally records changed field names, not full before/after values, to reduce unnecessary duplication of sensitive record content.
- Trigger function is in the non-exposed `private` schema, uses a fixed empty search path, and has direct execute privileges revoked from API roles.
- Supabase security and health advisors returned no findings after the migration.

**Boundary:** trigger definitions are verified in production. The actual insert/update/delete audit event sequence still requires an authenticated test organization and records; production currently has no contract or legal-matter rows.

### Organization membership and invitation UI — source and production build verified

The following bilingual screens are present in the current production build:

- `/workspace/members`: lists memberships visible to an authenticated organization member.
- Owner/admin can create invitations using the existing `create_org_invitation` RPC, choose a supported role, and copy a generated invitation URL.
- Owner/admin can view pending invitations and revoke them using `revoke_org_invitation`.
- `/invite?token=...`: allows a signed-in user to accept an invitation through `accept_org_invitation`; the database function checks that the authenticated email matches the invited email, the token is valid and unexpired, and no membership already exists.
- The invitation token is now preserved when an unauthenticated invitee opens login or signup. The requested invitation destination is carried through login, signup email confirmation and the auth callback, then restored after session establishment. Callback redirects are restricted to same-origin relative paths. This flow is present in the latest READY production deployment, but still requires a real mailbox acceptance test.
- Only the owner is offered the Admin appointment option in the UI; the database RPC independently enforces owner-only admin appointment.
- Owners and admins can change eligible member roles and suspend/reactivate memberships through the audited `update_org_membership` RPC; the owner cannot be changed through this operation.
- Admins cannot manage other admins or promote any member to admin; users cannot change their own membership.
- Every successful role/status change writes old and new role/status, actor and target identifiers to `audit_events`.
- The membership update function locks both the target membership and the acting manager's membership row to reduce concurrent privilege-change races.
- Member administration is linked from both the workspace dashboard and organization governance page.
- The UI respects the existing `user_profiles` RLS policy, which exposes a user's own profile only; it does not widen profile visibility to show other members' personal data.

**Known limits:** invitation delivery is currently manual: the UI generates a link for the administrator to copy and send; no automatic invitation email is sent. Permanent member deletion and invitation re-send are not implemented; membership suspension is reversible and is used instead of deletion. The member list may show generic labels and short user IDs for other members because profile data is intentionally private under current RLS. Membership changes have been source- and database-verified but not exercised with real user accounts.

### Legal request workflow — source implementation and database controls

The current `main` branch includes a bilingual request-detail workflow:

- `/workspace/requests/[id]`: detail view linked from the legal request list.
- Legal team members can assign a request to an active organization member, set urgency and due date, update allowed workflow status, and record a resolution summary.
- Requester-visible comments and internal legal-team comments are supported. The UI limits internal notes to legal team members and the assigned user.
- Legal team members can add sequential approval steps by role. Approvers can approve or reject only when the previous steps are approved/skipped.
- The UI prevents direct approval/rejection when an approval chain exists and blocks approval actions on terminal requests.
- The request-type selector now uses the database's canonical `regulatory_query` value rather than the mismatched `regulatory_question`.

Database hardening applied and verified:

- Request assignment must target an active member of the same organization; cross-organization assignment is rejected by a database trigger.
- RLS now prevents requesters from inserting comments marked internal. Internal comments are limited to legal-team roles and the assigned user.
- Legal-request reads now require an active membership in the owning organization and are limited to the requester, assigned member, and designated legal-sensitive roles. Ordinary employees, auditors and members cannot browse all organization requests. Suspended members lose request access.
- Approval actions are denied on completed, cancelled or rejected requests.
- Request status cannot be changed to approved while any approval step remains unresolved, or to rejected without a rejected approval step. Requests with approval chains cannot be completed while approvals remain pending.
- The approval-state synchronizer treats approved and skipped steps as completed when deciding whether the chain is complete.
- New approval steps must be created as pending, in strict sequential order, by the authenticated creator, and cannot be added to a terminal request.
- Supabase security and health advisors returned no findings after these migrations.

**Important boundary:** the latest READY production deployment includes the request-list detail link, request detail workflow, role-filter fix and database protections. No organization memberships or real legal requests currently exist in the production database, so assignment, comments, approval ordering and role access remain untested end-to-end with real users.

### Account recovery implementation — source and production build verified

The following bilingual account-recovery UI and callback routing are present in the current `main` branch and included in the latest READY production deployment:

- `/forgot-password`: requests a reset email using Supabase `resetPasswordForEmail`.
- `/reset-password`: checks for an authenticated recovery session, validates matching passwords and updates the password through Supabase `updateUser`.
- `/resend-confirmation`: requests a fresh signup confirmation email using Supabase `resend`.
- The sign-in page links to password recovery and confirmation resend.
- The callback routes recovery links to `/reset-password` when the OTP type is `recovery` or the callback includes the controlled `next=/reset-password` parameter.
- The callback restores a validated same-origin `next` destination after successful email confirmation, allowing invitees to return to `/invite?token=...` rather than being sent to the generic workspace.
- Recovery callbacks do not depend on profile upsert succeeding, so an unrelated profile-provisioning issue cannot block the password change.
- The latest Vercel build output lists `/forgot-password`, `/reset-password`, `/resend-confirmation` and `/auth/callback`, and completed static generation (19/19) in the member-management build.

**Important boundary:** source implementation and successful deployment do not prove that Supabase sends the emails, that the configured redirect allowlist and email templates are correct, or that a user can complete the invitation or recovery flow. These still require a real test account and mailbox.

## Known limitations / follow-up work

1. **Authentication acceptance test is outstanding.** Signup source uses the canonical production callback URL `https://legal-nexus-hayah7.vercel.app/auth/callback`. This is appropriate for the production hostname; preview deployments do not automatically use their own callback URL.
2. **Supabase Auth configuration is not verified.** The Site URL, redirect allowlist and email templates were not read or changed during this review. Confirm that the canonical production callback URL is allowlisted and that confirmation and recovery templates point to the callback route.
3. **Membership workflow acceptance test is outstanding.** The database currently contains zero organization memberships, so the owner/admin/invitee flows could not be exercised against an existing real organization without creating test accounts and organization data. The role/status RPC was applied and its execute grants and Supabase security/health advisors were checked; end-to-end acceptance still needs real accounts.
4. **Invitation return-path acceptance test is outstanding.** The invitation token is now preserved in source and production, but the full sequence (invite URL → login/signup → confirmation email → callback → invitation acceptance) has not yet been exercised with a real invitee mailbox.
5. **Legal request workflow acceptance test is outstanding.** The detail UI and database integrity controls are implemented, but the production database currently has zero organization memberships and no legal-request records, so role-specific assignment, comments and sequential approvals have not been exercised with real users.
6. **Lockfile/dependency reproducibility needs follow-up.** Repository inventory did not show a package lockfile at the repository root or configured app root (`src/src`). A previous Vercel build emitted `Found lockfile missing swc dependencies`. The latest inspected build completed successfully, but no validated lockfile has been added. Do not hand-edit or invent lockfile entries; generate and validate the correct lockfile with the intended package manager before changing dependency resolution.
7. Test member administration end-to-end with separate owner, admin and invitee accounts: create invitation, send copied link, accept with matching email, reject wrong-email and expired links, and revoke an unused invitation.
8. Add automated invitation email delivery and member role editing/removal only after defining the notification and audit requirements.
9. Test signup confirmation end-to-end, including the exact link generated by the configured Supabase email template, callback exchange, profile upsert and redirect to onboarding.
10. Test password reset end-to-end: email delivery, callback exchange, recovery session, password update, and login with the new password. Also test expired and already-used links.
11. Test resend-confirmation email delivery and verify that its link reaches the canonical callback.
12. Test first-organization creation and verify the database trigger creates exactly one active owner membership.
13. Contract and legal-matter detail/edit screens are implemented and deployed; complete acceptance tests for role-based editing, invalid values, and audit_events creation.
14. The legal-request detail workflow is now implemented; complete its end-to-end acceptance tests, including same-organization assignment, internal comment visibility, sequential approvals and terminal-state protections.
15. Complete full role-matrix testing for owner, admin, legal manager, lawyer, HR investigator and ordinary member. Verify cross-organization isolation using two independent test organizations.
16. Verify investigation state transitions and all evidence/minutes/recommendation/decision/appeal flows with real authenticated users, including denied actions.
17. Review the deployment's environment variables and Supabase Auth URL configuration in their dashboards. Values/secrets were not read or changed during this audit.

## Manual acceptance checklist

- [ ] Signup with a new test email.
- [ ] Open confirmation email and verify the canonical production callback, not localhost.
- [ ] Confirm callback establishes a session and creates/updates the user profile.
- [ ] Verify first login redirects to onboarding.
- [ ] Request password reset, open email link, set a new password and sign in with it.
- [ ] Verify expired/used recovery links are rejected safely.
- [ ] Resend signup confirmation and verify delivery and callback.
- [ ] Logout and login work reliably.
- [ ] Creating an organization creates the creator's owner membership.
- [ ] Second user can join only via a valid invitation.
- [ ] Owner/admin can create and revoke invitations; only owner can appoint admin.
- [ ] Owner/admin can change eligible roles and suspend/reactivate memberships; owner and self-membership protections hold.
- [ ] Invite acceptance rejects wrong-email, expired, reused and revoked tokens.
- [ ] An unauthenticated invitee retains the invitation token through login/signup and email confirmation, then returns to the same invitation.
- [ ] Invitation link delivery method is operational and understood (currently manual copy/send).
- [ ] Owner/admin/legal manager permissions match the intended matrix.
- [ ] Ordinary member cannot access restricted HR/investigation records.
- [ ] Cross-organization reads and writes are denied.
- [ ] Contracts, matters and legal requests can be created and then correctly retrieved.
- [ ] Contract and matter edits are restricted by role and each create/update/delete is recorded in audit_events.
- [ ] Legal request assignment rejects inactive and cross-organization users.
- [ ] Requesters cannot insert internal comments or read internal notes.
- [ ] Suspended members cannot access legal requests even if they originally requested or were assigned to one.
- [ ] Ordinary employees, auditors and members can see only requests they submitted or were assigned; legal-sensitive roles can access the organization queue.
- [ ] Approval steps execute in order; new steps cannot be inserted out of sequence or pre-approved, and direct status changes cannot bypass pending approvals.
- [ ] Completed/cancelled/rejected requests cannot be reopened or approved.
- [ ] Investigation evidence upload, download-link audit, SHA-256 and review events work.
- [ ] Submitted investigation minutes cannot be silently edited.
- [ ] No secrets or service-role keys are exposed to the browser.

## Release decision

**Not yet acceptance-tested as a complete MVP.** The production infrastructure and security baseline are present; account recovery, the bilingual organization invitation/member UI, legal-request details, and contract/legal-matter detail/edit screens are implemented and deployed. A live user acceptance pass, confirmation of Supabase Auth configuration, and completion of the workflow gaps above are still required before presenting the system as fully operational. Do not seed fake customer records in the production database for testing.
