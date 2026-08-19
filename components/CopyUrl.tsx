"use client";

import { useState } from "react";

/** Read-only URL field with a copy button. */
export default function CopyUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — user can still select the text */
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 min-w-0 rounded-md px-3 py-2 text-sm font-mono"
        style={{
          background: "var(--bg-base)",
          border: "1px solid var(--bg-border)",
          color: "var(--text-primary)",
        }}
      />
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors"
        style={{
          background: copied ? "var(--profit)" : "var(--bg-card-hover)",
          color: copied ? "#0b0b0b" : "var(--text-primary)",
          border: "1px solid var(--bg-border)",
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
