# Legal Nexus

Legal Nexus is a bilingual (Arabic / English) corporate legal operations platform built with Next.js 15, React 19 and Supabase.

## Current application baseline

- Public bilingual landing page describing the platform and its capabilities.
- Email/password sign-in and account registration with Supabase Auth.
- Email confirmation callback at `/auth/callback`.
- First-organization onboarding and organization-scoped workspace.
- Organization governance: corporate entities and departments.
- Contract records and legal matters register.
- Internal legal requests intake and approval workflow foundation.
- Administrative investigations intake and case workflow foundation.
- Investigation evidence, custody events and immutable submitted minutes are supported by database-side controls; the user interface and end-to-end operational testing still require further validation.

Some areas shown on the landing page are roadmap capabilities, not completed features. See the workspace for the currently exposed modules.

## Source and deployment

- GitHub repository: `minamishelshaker-dev/legal-nexus`
- Production branch: `main`
- Existing Vercel project: `legal-nexus`
- Vercel Root Directory: `src/src`
- Application source directory: `src/src/src`
- Production domain: https://legal-nexus-hayah7.vercel.app

This repository is a recovered working baseline from the existing deployment, not a guaranteed complete archive of the original development workspace. The source files exposed by the deployment were recovered, but local-only files, lockfiles, ignored assets and the full original migration SQL history were not all available.

## Supabase

- Project: `Legal Nexus`
- Project ref: `vzeaiqogntexdqggqyiy`
- Region: `eu-central-1`
- Applied migration history: 51 migrations.
- Public database tables: 28; row-level security is enabled on all 28 tables.
- Security and health advisor checks returned no lint findings at the latest verification.

The migration inventory is documented in [supabase/migrations/README.md](supabase/migrations/README.md). Migration history in the live database does not mean that all original SQL files are present in this repository. Recover missing migration bodies before treating this repository as a reproducible infrastructure source. Do not blindly replay schema SQL against the existing production database.

## Local development

1. Install dependencies from `src/src`.
2. Copy `src/src/.env.example` to `src/src/.env.local`.
3. Populate the authorized Supabase project URL and publishable key locally; do not commit secrets.
4. Run `npm run dev` from `src/src`.

## Required next validation

- Confirm Supabase Auth Site URL and redirect allowlist include the production domain and `/auth/callback`.
- Test signup, email confirmation, login, logout and first-organization onboarding using a dedicated test account.
- Test each module with owner, admin, legal manager and ordinary member roles.
- Verify cross-organization isolation and forbidden operations against real authenticated sessions.
- Complete the missing edit/review/approval and operational screens before describing roadmap modules as production-ready.
