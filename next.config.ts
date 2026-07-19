import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["leadflowtool.com", "www.leadflowtool.com", "*.leadflowtool.com"],
    },
  },
};

export default nextConfig;
