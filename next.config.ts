import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  // basePath must match the cookie path in lib/session.ts (COOKIE_PATH) — when
  // they drift the browser drops the session cookie on navigation.
  basePath: process.env.BASE_PATH || "/hub",
  allowedDevOrigins: ["192.168.20.150", "192.168.28.80", "aiclub.uit.edu.vn", "cs.uit.edu.vn"],
  // Keep the native SQLite addon out of the bundler; load it at runtime.
  serverExternalPackages: ["better-sqlite3"],
  // Ensure the prebuilt native addon is traced into the standalone output.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/better-sqlite3/build/Release/*.node"],
  },
};

export default nextConfig;
