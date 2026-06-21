import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "urban-waddle-x5j5x4gv4673vqp5-3000.app.github.dev",
        "*.app.github.dev"
      ]
    }
  }
};

export default nextConfig;