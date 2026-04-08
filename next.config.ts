import type { NextConfig } from "next";

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  worker-src 'self' blob:;
  connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com;
  img-src 'self' blob: data:;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'none';
`.replace(/\n/g, " ").trim();

const nextConfig: NextConfig = {
  experimental: {
    turbo: {},
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.wgsl$/,
      type: "asset/source",
    });
    return config;
  },
};

export default nextConfig;
