# Supabase migrations

Project: `vzeaiqogntexdqggqyiy` (Legal Nexus)
Last verified: 2026-11-19

This directory contains one executable SQL file for every migration recorded in the connected Supabase database's `supabase_migrations.schema_migrations` history: 63 files, from `20261117142026_initial_legal_nexus_foundation.sql` to `20261118213518_harden_document_and_obligation_integrity.sql`.

## Provenance

- 16 files were committed originally.
- 47 files were recovered on 2026-11-19 by reading the stored statements from the database's migration history and committing them unchanged. File names follow `<version>_<name>.sql`, matching the recorded version and name.
- The files are the source of record for the schema, row-level security policies, functions, triggers, and storage bucket policies. The recovered text was not re-executed against any database.

## Using these files

- Apply them in file-name order to provision a new, empty environment (for example with the Supabase CLI).
- Do not replay them against the existing production database; they are already applied there.
- Some migrations depend on earlier ones (for example the evidence and HR storage policies require the `storage` schema and buckets created in the same files), so applying a subset will fail.

## Known follow-ups

- Verify a clean rebuild: apply all files to a scratch Supabase project and compare the resulting schema to production before relying on this directory for disaster recovery.
- New schema changes should be added here as new migration files in the same commit as the code that depends on them.
