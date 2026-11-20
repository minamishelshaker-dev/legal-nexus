export type Lang = "ar" | "en";

export type Employee = {
  id: string;
  organization_id: string;
  employee_number: string;
  full_name: string;
  work_email: string | null;
  phone_number: string | null;
  employment_status: string;
  hire_date: string | null;
  termination_date: string | null;
  department_id: string | null;
  manager_employee_id: string | null;
  corporate_entity_id: string | null;
  user_id: string | null;
  notes: string | null;
  created_at: string;
};

export type Option = { id: string; name: string };
export type Position = { id: string; title: string; department_id: string | null; status: string; authority_level?: string };

export const STATUS: Record<string, { ar: string; en: string; tone: string }> = {
  pre_hire: { ar: "قبل التعيين", en: "Pre-hire", tone: "" },
  active: { ar: "نشط", en: "Active", tone: "ok" },
  on_leave: { ar: "في إجازة", en: "On leave", tone: "warn" },
  suspended: { ar: "موقوف", en: "Suspended", tone: "danger" },
  terminated: { ar: "منتهي الخدمة", en: "Terminated", tone: "" },
};

export const EVENTS: Record<string, { ar: string; en: string }> = {
  hired: { ar: "تعيين", en: "Hired" },
  transferred: { ar: "نقل", en: "Transfer" },
  promoted: { ar: "ترقية", en: "Promotion" },
  demoted: { ar: "تخفيض درجة", en: "Demotion" },
  manager_changed: { ar: "تغيير المدير المباشر", en: "Manager change" },
  status_changed: { ar: "تغيير الحالة", en: "Status change" },
  leave_started: { ar: "بداية إجازة", en: "Leave started" },
  leave_ended: { ar: "انتهاء إجازة", en: "Leave ended" },
  terminated: { ar: "إنهاء خدمة", en: "Termination" },
  rehired: { ar: "إعادة تعيين", en: "Rehired" },
  assignment_created: { ar: "إسناد وظيفة", en: "Assignment created" },
  assignment_ended: { ar: "إنهاء إسناد", en: "Assignment ended" },
  profile_updated: { ar: "تحديث البيانات", en: "Profile updated" },
};

export const AUTHORITY: Record<string, { ar: string; en: string }> = {
  executive: { ar: "إدارة تنفيذية", en: "Executive" },
  senior_management: { ar: "إدارة عليا", en: "Senior management" },
  management: { ar: "إدارة", en: "Management" },
  supervisory: { ar: "إشرافي", en: "Supervisory" },
  standard: { ar: "قياسي", en: "Standard" },
};

export const DOC_TYPES: Record<string, { ar: string; en: string }> = {
  employment_contract: { ar: "عقد عمل", en: "Employment contract" },
  identity_document: { ar: "مستند هوية", en: "Identity document" },
  qualification: { ar: "مؤهل", en: "Qualification" },
  experience_letter: { ar: "شهادة خبرة", en: "Experience letter" },
  job_description: { ar: "وصف وظيفي", en: "Job description" },
  performance_review: { ar: "تقييم أداء", en: "Performance review" },
  leave_document: { ar: "مستند إجازة", en: "Leave document" },
  disciplinary_notice: { ar: "إشعار تأديبي", en: "Disciplinary notice" },
  termination_document: { ar: "مستند إنهاء خدمة", en: "Termination document" },
  other: { ar: "أخرى", en: "Other" },
};

export const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0].charAt(0) + (parts.length > 1 ? parts[1].charAt(0) : "")).toUpperCase();
}

export function fmtDate(d: string | null | undefined, lang: Lang): string {
  if (!d) return "—";
  const date = new Date(d.length === 10 ? d + "T00:00:00Z" : d);
  return date.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
