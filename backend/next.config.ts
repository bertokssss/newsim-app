import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@newsim/types", "@newsim/utils", "@newsim/database", "@newsim/auth", "@newsim/ui"],
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
    "192.168.101.24",
    "*.local",
    "*.lan",
  ],
};

export default nextConfig;
