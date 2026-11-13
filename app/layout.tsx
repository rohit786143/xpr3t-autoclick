import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoClick Engine — 24h Automated Playwright Manager",
  description:
    "Full-stack automation platform for managing user accounts and executing persistent 24-hour background Playwright click routines.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}

