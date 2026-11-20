export type ModuleKey =
  | "requests"
  | "contracts"
  | "matters"
  | "investigations"
  | "documents"
  | "obligations"
  | "organization"
  | "members";

// Mirrors the database row-level security rules so users are only offered
// modules they can actually use. The database remains the source of truth.
const MODULE_ROLES: Record<ModuleKey, string[] | null> = {
  requests: null,
  documents: null,
  obligations: null,
  organization: null,
  contracts: ["owner", "admin", "legal_manager", "lawyer", "contract_manager"],
  matters: ["owner", "admin", "legal_manager", "lawyer"],
  investigations: ["owner", "admin", "legal_manager", "lawyer", "hr_investigator"],
  members: ["owner", "admin"],
};

export function canOpen(module: ModuleKey, role: string): boolean {
  const allowed = MODULE_ROLES[module];
  return !allowed || allowed.includes(role);
}

export const ROLE_LABELS: Record<string, { ar: string; en: string }> = {
  owner: { ar: "المالك", en: "Owner" },
  admin: { ar: "مدير النظام", en: "Administrator" },
  legal_manager: { ar: "مدير الشؤون القانونية", en: "Legal manager" },
  lawyer: { ar: "محامٍ", en: "Lawyer" },
  contract_manager: { ar: "مسؤول العقود", en: "Contract manager" },
  hr_manager: { ar: "مدير الموارد البشرية", en: "HR manager" },
  hr_investigator: { ar: "محقق موارد بشرية", en: "HR investigator" },
  employee: { ar: "موظف", en: "Employee" },
  auditor: { ar: "مراجع", en: "Auditor" },
  member: { ar: "عضو", en: "Member" },
};
