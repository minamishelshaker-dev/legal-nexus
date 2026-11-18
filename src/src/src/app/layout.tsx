import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Legal Nexus | Legal Department Operating System', description: 'The operating system for corporate legal departments.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
