import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  devIndicators: {
    position: "top-right",
  },
  /** Avoid bundling issues; Yahoo client uses dynamic imports internally. */
  serverExternalPackages: ["yahoo-finance2"],
  async rewrites() {
    return [
      /** Legacy alias; segment config must live only on `app/api/import/score/route.ts`. */
      { source: "/api/import/finalize", destination: "/api/import/score" },
    ];
  },
};

export default nextConfig;
