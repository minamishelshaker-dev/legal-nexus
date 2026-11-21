"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import SignOutButton from "@/components/sign-out-button";
import LanguageSwitcher from "@/components/language-switcher";
import GlobalSearch from "@/components/global-search";
import NotificationBell from "@/components/notification-bell";
import { BrandMark, Icon } from "@/components/icons";
import { canOpen, ROLE_LABELS } from "@/lib/access";
import type { ModuleKey } from "@/lib/access";

type Item = { key: ModuleKey | "home"; href: string; icon: string; ar: string; en: string };
type Group = { ar: string; en: string; items: Item[] };

const GROUPS: Group[] = [
  {
    ar: "نظرة عامة",
    en: "Overview",
    items: [{ key: "home", href: "/workspace", icon: "home", ar: "لوحة التحكم", en: "Dashboard" }],
  },
  {
    ar: "العمليات القانونية",
    en: "Legal operations",
    items: [
      { key: "requests", href: "/workspace/requests", icon: "inbox", ar: "الطلبات القانونية", en: "Legal requests" },
      { key: "contracts", href: "/workspace/contracts", icon: "contract", ar: "العقود", en: "Contracts" },
      { key: "matters", href: "/workspace/matters", icon: "scale", ar: "القضايا والمنازعات", en: "Matters" },
      { key: "investigations", href: "/workspace/investigations", icon: "shield", ar: "التحقيقات الإدارية", en: "Investigations" },
    ],
  },
  {
    ar: "الموارد البشرية",
    en: "People",
    items: [{ key: "people", href: "/workspace/people", icon: "badge", ar: "الموظفون", en: "Employees" }],
  },
  {
    ar: "الحوكمة والمعرفة",
    en: "Governance",
    items: [
      { key: "documents", href: "/workspace/documents", icon: "folder", ar: "المستندات", en: "Documents" },
      { key: "obligations", href: "/workspace/obligations", icon: "clock", ar: "الالتزامات والمواعيد", en: "Obligations" },
      { key: "organization", href: "/workspace/organization", icon: "building", ar: "المؤسسة والهيكل", en: "Organization" },
      { key: "members", href: "/workspace/members", icon: "users", ar: "الأعضاء والصلاحيات", en: "Members & access" },
    ],
  },
];

export default function AppShell({
  lang,
  orgName,
  organizationId,
  userId,
  role,
  email,
  children,
}: {
  lang: "ar" | "en";
  orgName: string;
  organizationId: string;
  userId: string;
  role: string;
  email: string;
  children: ReactNode;
}) {
  const ar = lang === "ar";
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const roleLabel = ROLE_LABELS[role] ? ROLE_LABELS[role][lang] : role;
  const initial = (orgName || "L").trim().charAt(0).toUpperCase();
  const userInitial = (email || "U").trim().charAt(0).toUpperCase();

  function isActive(href: string) {
    if (href === "/workspace") return pathname === "/workspace";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className={"app-shell " + (ar ? "is-ar " : "") + (open ? "nav-open" : "")} dir={ar ? "rtl" : "ltr"}>
      <aside className="app-sidebar" aria-label={ar ? "التنقل الرئيسي" : "Main navigation"}>
        <Link href="/workspace" className="app-brand">
          <BrandMark />
          <span>
            LEGAL <b>NEXUS</b>
          </span>
        </Link>

        <div className="org-card">
          <span className="org-avatar">{initial}</span>
          <span className="org-meta">
            <strong title={orgName}>{orgName || (ar ? "مؤسستك" : "Your organization")}</strong>
            <small>{roleLabel}</small>
          </span>
        </div>

        <nav className="app-nav">
          {GROUPS.map((group) => {
            const items = group.items.filter((item) => item.key === "home" || canOpen(item.key as ModuleKey, role));
            if (!items.length) return null;
            return (
              <div key={group.en}>
                <div className="nav-group-label">{ar ? group.ar : group.en}</div>
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={"nav-item" + (isActive(item.href) ? " active" : "")}
                    aria-current={isActive(item.href) ? "page" : undefined}
                  >
                    <Icon name={item.icon} />
                    <span>{ar ? item.ar : item.en}</span>
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-foot">{ar ? "نظام التشغيل للإدارات القانونية" : "The operating system for corporate legal departments"}</div>
      </aside>

      <button type="button" className="app-scrim" aria-label={ar ? "إغلاق القائمة" : "Close menu"} onClick={() => setOpen(false)} />

      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-start">
            <button type="button" className="menu-btn" aria-label={ar ? "فتح القائمة" : "Open menu"} onClick={() => setOpen(true)}>
              <Icon name="menu" size={20} />
            </button>
            <GlobalSearch organizationId={organizationId} role={role} lang={lang} />
          </div>
          <div className="topbar-end">
            <NotificationBell organizationId={organizationId} userId={userId} lang={lang} />
            <LanguageSwitcher lang={lang} />
            <span className="user-chip" title={email}>
              <span className="user-avatar">{userInitial}</span>
              <span className="user-email">{email}</span>
            </span>
            <SignOutButton lang={lang} />
          </div>
        </header>
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
