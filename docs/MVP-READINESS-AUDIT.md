# MVP Readiness Audit — 18 November 2026

## Executive status

The production deployment is READY and points to GitHub `main`. Latest verified production deployment:

- Deployment: `dpl_43YqzeWW1idFqDGhcPHrWH66a7hP` (READY)
- Deployed commit: `c0ad5cd4c7b2a2355f7ff35a4fca7619e5007405`
- Commit message: `Add legal request detail route`
- Production alias: https://legal-nexus-hayah7.vercel.app
- Framework: Next.js 15.5.29
- Build completed and the deployment output includes `/workspace/requests/[id]` and 19 static-generation steps.
- The separate SWC lockfile warning remains open.

**Deployment boundary:** subsequent source refinements are committed to GitHub `main`, but a fresh production deployment is pending. Vercel rejected a manual deployment request with HTTP 402 because the team exceeded its daily deployment API limit (retry after 24 hours). The latest successful production deployment above remains active; do not treat later unbuilt source commits as live.

This is an infrastructure and source review, not a completed end-to-end acceptance test. The production database currently has zero organization memberships, so no owner/admin/member/invitee workflow has been exercised with real organization users. Signup, email confirmation, login, logout, password recovery and organization creation also remain pending live acceptance testing.

## Verified infrastructure

- Vercel project: `legal-nexus`; framework: Next.js.
- GitHub repository: `minamishelshaker-dev/legal-nexus`; branch: `main`.
- Supabase project ref: `vzeaiqogntexdqggqyiy`; status: `ACTIVE_HEALTHY`; region: `eu-central-1`.
- Applied Supabase migration history: 59 entries, including audited membership lifecycle, same-organization request assignment, internal-comment visibility and approval-state integrity.
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

### Organization membership and invitation UI — source and production build verified

The following bilingual screens are present in the current production build:

- `/workspace/members`: lists memberships visible to an authenticated organization member.
- Owner/admin can create invitations using the existing `create_org_invitation` RPC, choose a supported role, and copy a generated invitation URL.
- Owner/admin can view pending invitations and revoke them using `revoke_org_invitation`.
- `/invite?token=...`: allows a signed-in user to accept an invitation through `accept_org_invitation`; the database function checks that the authenticated email matches the invited email, the token is valid and unexpired, and no membership already exists.
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

**Important boundary:** the initial request-detail route is present in the last READY deployment. The request-list link and later refinements are committed to `main` but await a fresh deployment because of the Vercel daily API limit. No organization memberships or real legal requests currently exist in the production database, so assignment, comments, approval ordering and role access remain untested end-to-end with real users.

### Account recovery implementation — source and production build verified

The following bilingual account-recovery UI and callback routing are present in the current `main` branch and included in the latest READY production deployment:

- `/forgot-password`: requests a reset email using Supabase `resetPasswordForEmail`.
- `/reset-password`: checks for an authenticated recovery session, validates matching passwords and updates the password through Supabase `updateUser`.
- `/resend-confirmation`: requests a fresh signup confirmation email using Supabase `resend`.
- The sign-in page links to password recovery and confirmation resend.
- The callback routes recovery links to `/reset-password` when the OTP type is `recovery` or the callback includes the controlled `next=/reset-password` parameter.
- Recovery callbacks do not depend on profile upsert succeeding, so an unrelated profile-provisioning issue cannot block the password change.
- The latest Vercel build output lists `/forgot-password`, `/reset-password`, `/resend-confirmation` and `/auth/callback`, and completed static generation (19/19) in the member-management build.

**Important boundary:** source implementation and successful deployment do not prove that Supabase sends the emails, that the configured redirect allowlist and email templates are correct, or that a user can complete the recovery flow. These still require a real test account and mailbox.

## Known limitations / follow-up work

1. **Authentication acceptance test is outstanding.** Signup source uses the canonical production callback URL `https://legal-nexus-hayah7.vercel.app/auth/callback`. This is appropriate for the production hostname; preview deployments do not automatically use their own callback URL.
2. **Supabase Auth configuration is not verified.** The Site URL, redirect allowlist and email templates were not read or changed during this review. Confirm that the canonical production callback URL is allowlisted and that confirmation and recovery templates point to the callback route.
3. **Membership workflow acceptance test is outstanding.** The database currently contains zero organization memberships, so the owner/admin/invitee flows could not be exercised against an existing real organization without creating test accounts and organization data. The role/status RPC was applied and its execute grants and Supabase security/health advisors were checked; end-to-end acceptance still needs real accounts.
4. **Legal request workflow acceptance test is outstanding.** The detail UI and database integrity controls are implemented, but the production database currently has zero organization memberships and no legal-request records, so role-specific assignment, comments and sequential approvals have not been exercised with real users.
5. **Lockfile/dependency reproducibility needs follow-up.** Repository inventory did not show a package lockfile at the repository root or configured app root (`src/src`). A previous Vercel build emitted `Found lockfile missing swc dependencies`. The latest inspected build completed successfully, but no validated lockfile has been added. Do not hand-edit or invent lockfile entries; generate and validate the correct lockfile with the intended package manager before changing dependency resolution.
6. Test member administration end-to-end with separate owner, admin and invitee accounts: create invitation, send copied link, accept with matching email, reject wrong-email and expired links, and revoke an unused invitation.
7. Add automated invitation email delivery and member role editing/removal only after defining the notification and audit requirements.
8. Test signup confirmation end-to-end, including the exact link generated by the configured Supabase email template, callback exchange, profile upsert and redirect to onboarding.
9. Test password reset end-to-end: email delivery, callback exchange, recovery session, password update, and login with the new password. Also test expired and already-used links.
10. Test resend-confirmation email delivery and verify that its link reaches the canonical callback.
11. Test first-organization creation and verify the database trigger creates exactly one active owner membership.
12. Add edit/detail screens for contracts and legal matters; current `CoreRecords` component primarily creates and lists records.
13. The legal-request detail workflow is now implemented; complete its end-to-end acceptance tests, including same-organization assignment, internal comment visibility, sequential approvals and terminal-state protections.
14. Complete full role-matrix testing for owner, admin, legal manager, lawyer, HR investigator and ordinary member. Verify cross-organization isolation using two independent test organizations.
15. Verify investigation state transitions and all evidence/minutes/recommendation/decision/appeal flows with real authenticated users, including denied actions.
16. Review the deployment's environment variables and Supabase Auth URL configuration in their dashboards. Values/secrets were not read or changed during this audit.

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
- [ ] Invitation link delivery method is operational and understood (currently manual copy/send).
- [ ] Owner/admin/legal manager permissions match the intended matrix.
- [ ] Ordinary member cannot access restricted HR/investigation records.
- [ ] Cross-organization reads and writes are denied.
- [ ] Contracts, matters and legal requests can be created and then correctly retrieved.
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

**Not yet acceptance-tested as a complete MVP.** The production infrastructure and security baseline are present; account recovery and the bilingual organization invitation/member UI are implemented and deployed. A live user acceptance pass, confirmation of Supabase Auth configuration, and completion of the workflow gaps above are still required before presenting the system as fully operational. Do not seed fake customer records in the production database for testing.
