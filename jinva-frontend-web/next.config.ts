import type { NextConfig } from "next";
import { securityHeaderRules } from "./src/lib/csp";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image only. Vercel builds
  // natively and never sets this, so its output is unchanged.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,

  // Opt-in same-origin API proxy, for sharing a dev machine through ONE tunnel
  // URL. Auth depends on the backend's cookies (jinva_session, refresh_token)
  // landing on the frontend's host so middleware can read them; with separate
  // frontend/backend hosts they never do and every /dashboard bounces to
  // /login. Set API_PROXY_TARGET (e.g. http://localhost:8000) together with
  // NEXT_PUBLIC_API_URL=/api/v1. Unset — as on Vercel — nothing changes.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET;
    if (!target) return [];
    return [
      { source: "/api/v1/:path*", destination: `${target}/api/v1/:path*` },
      { source: "/uploads/:path*", destination: `${target}/uploads/:path*` },
    ];
  },

  // SEC-32 security headers (04-implementation-plan §4.1). The CSP ships as
  // Content-Security-Policy-Report-Only until CSP_ENFORCE=1; the other
  // headers (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy)
  // are always enforced. The policy itself is built in src/lib/csp.ts.
  async headers() {
    return securityHeaderRules({
      apiUrl: process.env.NEXT_PUBLIC_API_URL,
      mediaOrigins: process.env.NEXT_PUBLIC_MEDIA_ORIGINS,
      dev: process.env.NODE_ENV === "development",
      enforce: process.env.CSP_ENFORCE === "1",
      reportUri: process.env.CSP_REPORT_URI,
    });
  },
};

export default nextConfig;
