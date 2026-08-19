import WallpaperPreview from "@/components/WallpaperPreview";
import CopyUrl from "@/components/CopyUrl";
import { getRequestOriginFromHeaders } from "@/lib/requestOrigin";

export const dynamic = "force-dynamic";

export default async function WallpaperPage() {
  const origin = await getRequestOriginFromHeaders();
  const url = `${origin}/api/wallpaper`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Wallpaper</h1>
        <a
          href="/api/wallpaper"
          download="mnq-iphone17promax.png"
          className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          style={{ background: "var(--accent)", color: "#0b0b0b" }}
        >
          Download PNG
        </a>
      </div>

      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        iPhone 17 Pro Max lock screen (1320 × 2868) generated live from the last 6
        five-minute MNQ candles. The image at <code>/api/wallpaper</code> is cached
        for 5 minutes, so it refreshes on its own — the top band stays clear for the
        iOS clock.
      </p>

      <div
        className="rounded-lg p-4 space-y-2"
        style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}
      >
        <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Live image URL — use this in an iOS Shortcut (Get Contents of URL → Set Wallpaper)
        </div>
        <CopyUrl url={url} />
      </div>

      <WallpaperPreview />
    </div>
  );
}
