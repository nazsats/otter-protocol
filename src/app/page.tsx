// Root route ("/") renders the landing page directly.
//
// The access-code gate has been retired (see GATE_ENABLED in src/proxy.ts). Its
// page is preserved at app/gate/page.tsx so it can be restored later. We reuse
// the existing landing component so `/` and `/about` show the same page and any
// existing /about links keep working.
export { default } from "./about/page";
