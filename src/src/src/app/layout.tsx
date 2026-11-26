import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { MARK_DATA_URI } from "@/lib/brand-svg";
import "./globals.css";
import "./unify.css";
import "./theme.css";

export const metadata: Metadata = {
  title: "Legal Nexus | Legal Management & Enterprise Solutions",
  description: "The operating system for corporate legal departments: legal requests, contracts, matters, investigations, deadlines and spend in one secure workspace.",
  icons: { icon: [{ url: MARK_DATA_URI, type: "image/svg+xml" }] },
};

export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f3f6fb" }, { media: "(prefers-color-scheme: dark)", color: "#071427" }] };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jar = await cookies();
  const lang = jar.get("ln_lang")?.value === "ar" ? "ar" : "en";
  const theme = jar.get("ln_theme")?.value === "dark" ? "dark" : "light";
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} data-theme={theme} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
