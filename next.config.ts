import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  basePath: "/paper",
  allowedDevOrigins: ["192.168.20.150", "aiclub.uit.edu.vn"],
};

export default nextConfig;
