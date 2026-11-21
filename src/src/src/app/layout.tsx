import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import "./unify.css";
export const metadata: Metadata = { title: "Legal Nexus | Legal Department Operating System", description: "The operating system for corporate legal departments." };
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 const jar=await cookies(); const lang=jar.get("ln_lang")?.value==="ar"?"ar":"en";
 return <html lang={lang} dir={lang==="ar"?"rtl":"ltr"}><body>{children}</body></html>;
}
