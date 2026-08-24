import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  devIndicators: {
    position: "top-right",
  },
  /** Avoid bundling issues; Yahoo client uses dynamic imports internally. */
  serverExternalPackages: ["yahoo-finance2", "@react-pdf/renderer", "@resvg/resvg-js"],
  /** Ship the bundled wallpaper fonts into the serverless function (Vercel has no system fonts). */
  outputFileTracingIncludes: {
    "/api/wallpaper": ["./lib/wallpaper/fonts/**"],
  },
  async rewrites() {
    return [
      /** Legacy alias; the real route now lives at `app/api/import/finalize/route.ts`. */
      { source: "/api/import/score", destination: "/api/import/finalize" },
    ];
  },
};

export default nextConfig;
