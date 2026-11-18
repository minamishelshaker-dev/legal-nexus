# Database Migration Recovery — 18 November 2026

## Current state

The production Supabase project `vzeaiqogntexdqggqyiy` reports **63 applied migrations**. The current GitHub `main` tree contains only **16 SQL migration files** under `supabase/migrations/`.

A version-by-version comparison confirms that **47 applied migration versions have no matching SQL source file in the repository**. The 13 files currently present all match applied versions; there are no un-applied migration files in the current folder.

This is migration-source drift, not evidence that the live database is broken. The live schema, RLS policies, triggers and RPCs are present in production. However, a fresh Supabase project cannot be reliably reconstructed from the repository's migration folder alone.

## Applied migrations missing from GitHub

| Version | Applied migration |
|---|---|
| `20261117142026` | `initial_legal_nexus_foundation` |
| `20261117142040` | `restrict_sensitive_legal_records` |
| `20261117160835` | `harden_rls_helper_functions` |
| `20261117160847` | `add_foreign_key_indexes_and_dedupe_policies` |
| `20261117160856` | `optimize_profile_rls_policies` |
| `20261117161214` | `organization_owner_onboarding` |
| `20261117161354` | `index_organization_creator` |
| `20261117224327` | `enforce_role_based_access_for_core_records` |
| `20261117224334` | `remove_overlapping_select_policies` |
| `20261117224350` | `organization_member_invitations` |
| `20261117224355` | `expose_secure_invitation_rpc` |
| `20261117224403` | `optimize_invitation_access_policies` |
| `20261117224438` | `investigation_workflow_foundation` |
| `20261117224459` | `harden_investigation_record_integrity` |
| `20261117224504` | `grant_investigation_data_api_access` |
| `20261117224512` | `tighten_investigation_table_grants` |
| `20261117225831` | `legal_requests_and_approval_workflow` |
| `20261117225844` | `harden_legal_request_approval_controls` |
| `20261117225854` | `enforce_legal_request_org_integrity` |
| `20261117225907` | `complete_legal_request_approval_routing` |
| `20261117230153` | `enforce_same_organization_parent_hierarchy` |
| `20261117230159` | `index_same_organization_hierarchy_foreign_keys` |
| `20261117230216` | `revoke_anonymous_access_from_application_tables` |
| `20261117230639` | `organizational_positions_and_assignments_schema` |
| `20261117230648` | `secure_organizational_positions_and_assignments` |
| `20261117230704` | `harden_organizational_structure_integrity` |
| `20261117230721` | `index_organizational_structure_foreign_keys` |
| `20261118045334` | `employee_lifecycle_hr_confidential_foundation` |
| `20261118045402` | `harden_hr_lifecycle_access_and_role_routing` |
| `20261118045432` | `atomic_employee_hiring_workflow` |
| `20261118045507` | `employee_lifecycle_change_workflows` |
| `20261118045523` | `harden_employee_lifecycle_transitions` |
| `20261118050329` | `link_investigations_to_hr_employee_records` |
| `20261118050353` | `confidential_employee_document_registry` |
| `20261118050403` | `employee_profile_update_workflow` |
| `20261118050423` | `audited_hr_read_access_rpcs` |
| `20261118050448` | `harden_audited_hr_read_rpcs_and_indexes` |
| `20261118050517` | `lock_employee_document_storage_paths` |
| `20261118051154` | `secure_employee_record_storage_object_policies` |
| `20261118063339` | `align_employee_document_mime_allowlist` |
| `20261118064529` | `tighten_authenticated_table_privileges` |
| `20261118064556` | `restrict_audit_log_access_and_writes` |
| `20261118064608` | `remove_direct_audit_event_insert_policy` |
| `20261118064638` | `restrict_legal_record_read_access` |
| `20261118114603` | `secure_investigation_evidence_storage_and_custody` |
| `20261118114620` | `allow_case_readers_to_log_evidence_access` |
| `20261118114755` | `harden_evidence_file_integrity_and_custody_log` |

## Safety constraints

Until the migration history is recovered:

- Do not run `supabase db reset` against production.
- Do not replay the 63 migrations against production.
- Do not assume a new Supabase project or branch can be initialized faithfully from the current repository.
- Do not fabricate historical migration SQL from migration names alone.
- Do not delete or squash the applied migration history.

## Recovery plan

1. Preserve the current production project and its migration history unchanged.
2. Capture an authoritative schema inventory from the live database: schemas, tables, columns, constraints, indexes, RLS policies, grants, triggers, functions, extensions and storage policies.
3. Recover original SQL from any original development environment, backups, CI artifacts or developer machines where available.
4. Compare recovered SQL against the live schema. Keep the 12 existing migration files and the 47 missing versions version-aligned.
5. If original SQL cannot be recovered, prepare a separately reviewed baseline/snapshot strategy from the live schema. Do not pretend that a reconstructed snapshot is the original migration history.
6. Validate the recovered baseline on an isolated, disposable Supabase project before adopting it for future environments.
7. Only after validation, document how future schema changes are created, committed and applied in one controlled workflow.

## Verification

- Supabase applied migration count: 63.
- SQL migration files in GitHub `main`: 16.
- Applied versions without matching source file: 47.
- Current-folder SQL files not yet applied: 0.
- Supabase security advisor: no findings at the time of review.
- Supabase health advisor: no findings at the time of review.

This report describes repository/database drift and a recovery plan. It does not change the production database.
