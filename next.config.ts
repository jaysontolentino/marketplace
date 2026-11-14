import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.NEXT_TEST_DIST_DIR || ".next",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: { root: process.cwd() },
};
export default config;
