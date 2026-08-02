import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "ui-avatars.com" },
      { protocol: "https", hostname: "rsa.ugm.ac.id" },
      { protocol: "https", hostname: "imotions.com" },
      { protocol: "https", hostname: "glomeda.co.id" },
      { protocol: "https", hostname: "portal.riau24.com" },
    ],
  },
};

export default nextConfig;
