import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow profile photos from Supabase Storage and Google accounts (same as OutNYC)
    remotePatterns: [
      new URL("https://stvkpfljyavatafrqcvv.supabase.co/storage/v1/object/public/**"),
      new URL("https://lh3.googleusercontent.com/**"),
    ],
  },
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
