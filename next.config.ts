import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["leadflowtool.com", "www.leadflowtool.com", "*.leadflowtool.com"],
    },
  },
};

export default nextConfig;
