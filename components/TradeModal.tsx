"use client";

import { useRouter } from "next/navigation";

export default function TradeModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={() => router.back()}
    >
      <div
        className="relative rounded-lg overflow-y-auto w-full max-w-2xl mx-4"
        style={{
          maxHeight: "90vh",
          background: "var(--bg-base)",
          border: "1px solid var(--bg-border)",
          boxShadow: "0 25px 50px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => router.back()}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-md text-sm transition-colors"
          style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}
        >
          ✕
        </button>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
