# Legal Nexus

This repository contains the application source files that were available from the existing Legal Nexus production deployment on 2026-11-18.

## Application

- Framework: Next.js 15
- React: 19
- Supabase SSR and JavaScript clients
- Application source is preserved under `src/src/`.
- Vercel project root directory must be set to `src/src` when connecting this repository.

## Supabase

The connected Supabase project currently records 44 applied migrations and 27 public tables with RLS enabled. See [the migration inventory](supabase/migrations/README.md).

**Important:** The original SQL bodies for the 44 applied migrations were not exposed by the migration-history API, so this repository currently contains their version/name inventory, not replayable migration SQL. Recover the original migration files from the development workspace before treating this repository as a reproducible database setup.

## Deployment and configuration

- The existing Vercel production project has not yet been linked to this GitHub repository. Connect it through Vercel Project Settings → Git, or create a separate Git-connected Vercel project after confirming the intended deployment workflow.
- Configure the existing Supabase URL and publishable key as Vercel environment variables. No secret values are committed here.
- For local development, copy `src/src/.env.example` to `src/src/.env.local` and fill in the authorized project values.

## Import scope

This import includes the 19 source/configuration files exposed by the production deployment, plus repository documentation and safe local configuration templates. Files excluded from the deployment (for example, local-only assets, lockfiles, ignored files, or original migration SQL) cannot be assumed to have been recovered.
