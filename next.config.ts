import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  basePath: "/paper",
  allowedDevOrigins: ["192.168.20.150", "aiclub.uit.edu.vn"],
  // Keep the native SQLite addon out of the bundler; load it at runtime.
  serverExternalPackages: ["better-sqlite3"],
  // Ensure the prebuilt native addon is traced into the standalone output.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/better-sqlite3/build/Release/*.node"],
  },
};

export default nextConfig;
