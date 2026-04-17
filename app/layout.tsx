import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Trading Performance Review",
  description: "Trading performance review from CSV import",
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
