import type { NextConfig } from "next";

// Content-Security-Policy tuned for this app's third parties:
//  - Firebase Auth (apis.google.com, gstatic, *.firebaseapp.com popup/iframe)
//  - WalletConnect / Reown (verify.walletconnect.* iframes, wss relays)
//  - Telegram Login Widget (oauth.telegram.org iframe + telegram.org script)
//  - Sepolia RPC over https/wss
// script/style keep 'unsafe-inline'/'unsafe-eval' because Next's runtime and the
// wallet SDKs require them; the policy still locks down object-src, base-uri,
// form-action and frame-ancestors, which blocks the most common injection/clickjacking.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://*.telegram.org https://apis.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://oauth.telegram.org https://*.telegram.org https://verify.walletconnect.com https://verify.walletconnect.org https://*.firebaseapp.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // don't advertise Next.js version
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
