import type { Metadata, Viewport } from "next";
import "./globals.css";
import { prisma } from "@/lib/db/prisma";
import { getActiveAccount } from "@/lib/activeAccount";
import Sidebar from "@/components/Sidebar";

/** Always render from DB; avoid static/RSC cache of trade counts and metrics on Vercel. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trade Journal",
  description: "Trading journal: import performance CSV, score trades, review metrics and charts.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  const [activeAccount, allAccounts] = await Promise.all([
    getActiveAccount(),
    prisma.account.findMany({
      where: { hiddenFromStats: false },
      orderBy: { id: "asc" },
      select: { id: true, name: true, propfirmName: true, initialBalance: true },
    }),
  ]);
  return (
    <html lang="en" className="h-full">
      <body
        className="h-full flex flex-col md:flex-row"
        style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
      >
        <Sidebar activeAccount={activeAccount} accounts={allAccounts} />
        <main className="flex-1 min-w-0 overflow-auto p-4 pt-20 md:p-6 md:pt-6">{children}</main>
        {modal}
      </body>
    </html>
  );
}
