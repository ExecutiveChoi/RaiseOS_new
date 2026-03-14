import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["supabase.co", "lh3.googleusercontent.com"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
