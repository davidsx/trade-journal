"use client";

import { useState } from "react";

/** Live preview of /api/wallpaper with a manual refresh (cache-busts the 5-min edge cache). */
export default function WallpaperPreview() {
  const [v, setV] = useState(0);
  const src = v === 0 ? "/api/wallpaper" : `/api/wallpaper?v=${v}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setV(Date.now())}
          className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          style={{ background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--bg-border)" }}
        >
          Refresh now
        </button>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Auto-refreshes every 5 min; tap to force the latest candles.
        </span>
      </div>

      <div
        className="rounded-lg p-4 flex justify-center"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={src}
          src={src}
          alt="MNQ last-6-candles iPhone wallpaper"
          className="rounded-[32px]"
          style={{ width: "auto", maxHeight: "80vh", border: "1px solid var(--bg-border)" }}
        />
      </div>
    </div>
  );
}
