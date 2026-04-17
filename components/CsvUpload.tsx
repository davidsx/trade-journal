"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function CsvUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      setStatus("error");
      setMessage("Please upload a .csv file");
      return;
    }

    setStatus("uploading");
    setMessage(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/import", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      setStatus("done");
      setMessage(`${data.imported} trades imported (${data.symbol})`);
      router.refresh();
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Error");
    }

    setTimeout(() => {
      setStatus("idle");
      setMessage(null);
    }, 6000);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const isLoading = status === "uploading";

  return (
    <div className="mt-auto space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleChange}
      />

      {/* Drop zone / button */}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isLoading}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="w-full py-2 px-3 rounded-md text-sm font-medium transition-colors text-center"
        style={{
          background: isLoading ? "var(--accent-dim)" : "var(--accent)",
          color: "#000",
          opacity: isLoading ? 0.7 : 1,
          cursor: isLoading ? "not-allowed" : "pointer",
          border: "1px dashed transparent",
        }}
      >
        {isLoading ? "Importing…" : "Import CSV"}
      </button>

      {message && (
        <p
          className="text-xs text-center px-1"
          style={{
            color: status === "error" ? "var(--loss)" : status === "done" ? "var(--profit)" : "var(--text-muted)",
          }}
        >
          {message}
        </p>
      )}

      <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
        Use your broker’s Performance / P&L export:
        <br />
        tabular CSV with fills, prices, and timestamps
      </p>
    </div>
  );
}
