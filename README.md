# Legal Nexus

This repository contains the application source files recovered from the existing Legal Nexus deployment and the supporting project notes.

## Application

- Framework: Next.js 15
- React: 19
- Supabase SSR and JavaScript clients
- Application source and package manifest: `src/src/`
- The existing Vercel project is linked to this repository.
- Vercel project Root Directory: `src/src`
- Production branch: `main`

## Supabase

The connected Supabase project currently records 44 applied migrations and 27 public tables with RLS enabled. See [the migration inventory](supabase/migrations/README.md).

**Important:** The original SQL bodies for the 44 applied migrations were not exposed by the migration-history API, so this repository currently contains their version/name inventory, not replayable migration SQL. Recover the original migration files from the development workspace before treating this repository as a reproducible database setup.

## Deployment and configuration

- Existing Vercel project: `legal-nexus` (the existing project, not a duplicate).
- GitHub repository: `minamishelshaker-dev/legal-nexus`
- Production branch: `main`
- Root Directory: `src/src`
- Supabase environment variables are configured in Vercel. Secret values must remain in Vercel and must not be committed.
- For local development, copy `src/src/.env.example` to `src/src/.env.local` and fill in authorized project values.

## Import scope and limitations

This import includes the 19 source/configuration files exposed by the previous production deployment, plus repository documentation and safe local configuration templates. Files excluded from that deployment (for example, local-only assets, lockfiles, ignored files, or original migration SQL) cannot be assumed to have been recovered. The source tree should be treated as a recovered baseline, not a complete archival copy of every original development file.
