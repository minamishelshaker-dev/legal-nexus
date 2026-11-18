# Supabase migration inventory

Project: `vzeaiqogntexdqggqyiy` (Legal Nexus)
Snapshot date: 2026-11-18

The following 51 migration versions are recorded as applied in the connected Supabase database. The last three evidence-storage migrations and the investigation-minutes hardening migration are preserved as executable SQL files in this repository. The original SQL bodies for the first three evidence-storage migrations and the earlier migrations are not present here and must be recovered before treating it as a reproducible infrastructure source.

| Version | Migration |
|---|---|
| 20261117142026 | initial_legal_nexus_foundation |
| 20261117142040 | restrict_sensitive_legal_records |
| 20261117160835 | harden_rls_helper_functions |
| 20261117160847 | add_foreign_key_indexes_and_dedupe_policies |
| 20261117160856 | optimize_profile_rls_policies |
| 20261117161214 | organization_owner_onboarding |
| 20261117161354 | index_organization_creator |
| 20261117224327 | enforce_role_based_access_for_core_records |
| 20261117224334 | remove_overlapping_select_policies |
| 20261117224350 | organization_member_invitations |
| 20261117224355 | expose_secure_invitation_rpc |
| 20261117224403 | optimize_invitation_access_policies |
| 20261117224438 | investigation_workflow_foundation |
| 20261117224459 | harden_investigation_record_integrity |
| 20261117224504 | grant_investigation_data_api_access |
| 20261117224512 | tighten_investigation_table_grants |
| 20261117225831 | legal_requests_and_approval_workflow |
| 20261117225844 | harden_legal_request_approval_controls |
| 20261117225854 | enforce_legal_request_org_integrity |
| 20261117225907 | complete_legal_request_approval_routing |
| 20261117230153 | enforce_same_organization_parent_hierarchy |
| 20261117230159 | index_same_organization_hierarchy_foreign_keys |
| 20261117230216 | revoke_anonymous_access_from_application_tables |
| 20261117230639 | organizational_positions_and_assignments_schema |
| 20261117230648 | secure_organizational_positions_and_assignments |
| 20261117230704 | harden_organizational_structure_integrity |
| 20261117230721 | index_organizational_structure_foreign_keys |
| 20261118045334 | employee_lifecycle_hr_confidential_foundation |
| 20261118045402 | harden_hr_lifecycle_access_and_role_routing |
| 20261118045432 | atomic_employee_hiring_workflow |
| 20261118045507 | employee_lifecycle_change_workflows |
| 20261118045523 | harden_employee_lifecycle_transitions |
| 20261118050329 | link_investigations_to_hr_employee_records |
| 20261118050353 | confidential_employee_document_registry |
| 20261118050403 | employee_profile_update_workflow |
| 20261118050423 | audited_hr_read_access_rpcs |
| 20261118050448 | harden_audited_hr_read_rpcs_and_indexes |
| 20261118050517 | lock_employee_document_storage_paths |
| 20261118051154 | secure_employee_record_storage_object_policies |
| 20261118063339 | align_employee_document_mime_allowlist |
| 20261118064529 | tighten_authenticated_table_privileges |
| 20261118064556 | restrict_audit_log_access_and_writes |
| 20261118064608 | remove_direct_audit_event_insert_policy |
| 20261118064638 | restrict_legal_record_read_access |
| 20261118114603 | secure_investigation_evidence_storage_and_custody |
| 20261118114620 | allow_case_readers_to_log_evidence_access |
| 20261118114755 | harden_evidence_file_integrity_and_custody_log |
| 20261118115344 | fix_evidence_access_link_audit_policy |
| 20261118115645 | make_evidence_upload_and_review_atomic |
| 20261118115713 | validate_evidence_upload_storage_object |
| 20261118120500 | make_submitted_investigation_minutes_immutable |

## Current schema snapshot

- 28 public tables were returned by the database inventory.
- Row-level security is enabled on all 28 tables.
- The investigation evidence and evidence custody-event tables are empty; no evidence files have been uploaded.
- No user, organization, employee, or test records were created as part of this repository import or evidence-storage work.
- Submitted investigation minutes are now immutable: only an authorized legal leader can approve them without changing their content; corrections require a new version.

## Required follow-up

Recover the original SQL migration files from the original development workspace or an authenticated Supabase CLI/database source before treating this repository as a reproducible infrastructure source. The first three evidence-storage migrations were applied directly to the connected database; their SQL bodies should be recovered and committed as executable migration files before using this repository to provision another environment. Do not blindly replay schema SQL against the existing production database.
