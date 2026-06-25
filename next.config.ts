import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Keep the headless-Chromium deps out of the server bundle (native binaries).
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
};

export default nextConfig;
