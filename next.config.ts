import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "pdf-parse"],
  outputFileTracingIncludes: {
    '/api/generate': ['./scripts/**/*'],
  },
};

export default nextConfig;
