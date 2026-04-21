import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

/** Always render from DB; avoid static/RSC cache of trade counts and metrics on Vercel. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trade Journal",
  description: "Trading journal: import performance CSV, score trades, review metrics and charts.",
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className="h-full flex"
        style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
      >
        <Sidebar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
        {modal}
      </body>
    </html>
  );
}
