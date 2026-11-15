import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  transpilePackages: ["@newsim/types", "@newsim/utils", "@newsim/ui", "@newsim/auth", "@newsim/database"],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion", "@newsim/ui"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()" },
        ],
      },
    ];
  },
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
    "192.168.101.24",
    "*.local",
    "*.lan",
    "*.devtunnels.ms",
    "*.*.devtunnels.ms",
    "*.asse.devtunnels.ms",
    "*.use.devtunnels.ms",
    "*.inc1.devtunnels.ms",
    "*.uks.devtunnels.ms",
    "*.euw.devtunnels.ms",
    "*.apne.devtunnels.ms",
    "*.tunnels.ms",
    "*.*.tunnels.ms",
    "*.app.github.dev",
    "*.github.dev",
    "*.ngrok.io",
    "*.ngrok.app",
    "*.ngrok-free.app",
    "*.trycloudflare.com",
    "*.loca.lt",
  ],
  ...(process.env.ENABLE_EXTERNAL_API_REWRITE === "true" &&
  process.env.NEXT_PUBLIC_API_URL &&
  !/localhost|127\.0\.0\.1/i.test(process.env.NEXT_PUBLIC_API_URL)
    ? {
        async rewrites() {
          return {
            fallback: [
              {
                source: "/api/:path*",
                destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
              },
            ],
          };
        },
      }
    : {}),
};

export default nextConfig;
