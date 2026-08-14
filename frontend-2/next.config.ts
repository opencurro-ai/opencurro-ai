import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The browser talks only to this Next.js app; the /api/* route handlers proxy
  // to the curro-ai backend (see CURRO_API_URL) so localhost from the server works.
  env: {
    CURRO_API_URL: process.env.CURRO_API_URL ?? "http://localhost:8787",
  },
};

export default nextConfig;
