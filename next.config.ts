import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: "https", hostname: "images.pexels.com", pathname: "/**" },
      { protocol: "https", hostname: "www.shopinexbd.com", pathname: "/**" },
      { protocol: "https", hostname: "shopinexbd.com", pathname: "/**" },
      { protocol: "https", hostname: "**.supabase.co", pathname: "/**" },
    ],
  },
  // Media files are streamed by /api/media/file (see app/api/media/file/route.ts)
  // because files uploaded after the build are not part of the static public map.
  // Heavy native/bundled packages stay external on the Node server.
  serverExternalPackages: [
    "sharp",
    "nsfwjs",
    "@tensorflow/tfjs",
    "ffmpeg-static",
    "toxicity",
  ],
};

export default nextConfig;
