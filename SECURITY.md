# OTTER Protocol — Security & Scale

This document records the hardening done for ~10k concurrent users plus the
**actions you must take to activate it**. Code-level changes are already in the
repo; the steps in "Required actions" are operational and must be done by you.

---

## What changed (in code)

### 1. Identity is now verified from a Firebase ID token — not a body `uid`
Previously every authenticated API route trusted whatever `uid` the caller put
in the request body, so anyone who knew a victim's uid could act as them.

- New `src/lib/auth-verify.ts` → `verifyUser()` / `verifyUserMatches()` verify
  the `Authorization: Bearer <idToken>` header server-side (revocation-checked).
- Applied to: `claim-mission`, `claim-all`, `drop/redeem`, `meme/submit`,
  `meme/vote`, `verify/telegram`, and `verify/discord` (start).
- `verify/discord` no longer redirects from a `?uid=` query — the client
  `fetch`es it with the token and the server returns the OAuth URL, so signal
  can only ever be credited to the authenticated account.
- New `src/lib/api.ts` → `authFetch()` attaches the token; all client call sites
  (MissionBoard, DropHunt, MemeArena, InitiationTerminal) use it.

### 2. DDoS / abuse defense
- **Edge burst throttle** in `src/proxy.ts`: best-effort per-IP sliding window
  (60 req / 10s) on `/api/*`, runs before any route handler / DB call.
- **Security headers** in `next.config.ts`: CSP, HSTS, X-Frame-Options: DENY,
  X-Content-Type-Options, Referrer-Policy, Permissions-Policy; `poweredByHeader`
  disabled.
- `meme/submit` gained rate limiting; image URLs are now restricted to an
  allow-list of hosts (`src/lib/validate.ts`) — blocks SSRF / `javascript:` /
  `data:` / phishing links in the public feed.

### 3. Firestore scale
- `firestore.indexes.json` added (composite indexes for `otter_claims`,
  `memes`, `drops`, `access_codes`).
- `admin/stats` rewritten to use **aggregation queries** (`count()`/`sum()`)
  instead of downloading the entire `users` collection — was an OOM/timeout at
  scale.
- Activity-feed write rule tightened: clients may only create `type: "join"`
  entries with no `amount`/`txHash`, so fake "claimed N OTTER" lines can't be
  forged. Value events are Admin-SDK only.
- `rate_limits` docs now carry an `expireAt` Timestamp for a TTL policy.

### 4. Blockchain layer (`src/lib/chain.ts`)
- **RPC failover** across multiple endpoints + retry with backoff on transient
  errors (single RPC outage no longer fails all claims).
- **Nonce lock**: nonces are reserved through a Firestore counter
  (`treasury_state`), so concurrent serverless invocations can't grab the same
  nonce and silently drop a transaction.
- Per-transfer amount cap retained; balance checked before sending.

### 5. Access gate cookie is now unforgeable
The early-access gate used a static cookie value (`otter_access=1`) — anyone
could bypass the whole site by setting that cookie by hand. It's now an
**HMAC-signed token** (`<issuedAt>.<hmac>`, [access-token.ts](src/lib/access-token.ts))
minted by `/api/auth/access` and verified in [proxy.ts](src/proxy.ts). Forging
it requires the server secret; tokens also expire after 30 days. Uses Web Crypto
so the same module runs in both the Node route and the Edge middleware.

> Requires `ACCESS_GATE_SECRET` (or the existing `ADMIN_SECRET`) to be set.
> After deploy, existing visitors holding the old `otter_access=1` cookie are
> redirected to the gate to re-enter the code once — expected.

### 6. OTTERToken.sol accounting bugs fixed
- **Double-debit**: the taxable path debited the sender both in `_transfer` and
  in `_distributeTax` — sender lost `amount + tax`. Now debited once.
- **Burn invariant**: burn credited `address(0)` *and* reduced `totalSupply`,
  breaking the balances-sum invariant. Now reduces supply only.
- **Rewards backing**: the rewards tax share was counted but never held, so
  `claimRewards()` underflowed. Rewards are now credited to the contract;
  `claimRewards()` is also capped to the contract's actual balance.

---

## Required actions (you must do these)

### A. Deploy Firestore rules + indexes
```bash
npx firebase deploy --only firestore:rules,firestore:indexes
```
Indexes take a few minutes to build; queries 400 until they're ready.

### B. Configure the `rate_limits` TTL policy (one-time)
Firebase console → Firestore → **TTL** → create policy on collection
`rate_limits`, field `expireAt`. Auto-deletes stale counters so the collection
doesn't grow forever.

### C. Set environment variables (Vercel → Project → Settings → Env Vars)
Required for the new code paths:
```
# already in use
DEPLOYER_PRIVATE_KEY        # treasury signer
SEPOLIA_RPC_URL             # primary RPC
ADMIN_SECRET                # HMAC signing for OAuth state
DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET / DISCORD_GUILD_ID
TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID
NEXT_PUBLIC_APP_URL         # e.g. https://otterprotocol.xyz

# new (optional but recommended)
SEPOLIA_RPC_URL_2           # second RPC endpoint for failover
```

### D. Discord OAuth redirect URI
discord.com/developers → your app → OAuth2 → Redirects → add:
`https://otterprotocol.xyz/api/verify/discord/callback`

### E. Telegram bot must be an admin of the channel
Otherwise `getChatMember` can't confirm membership.

### F. Redeploy the fixed OTTERToken
Recompile + redeploy to Sepolia and update `NEXT_PUBLIC_OTTER_CONTRACT`
(and the admin contracts doc) with the new address. The old token has the
double-debit bug.
```bash
cd contracts && npx hardhat compile
# then your deploy script, then update the contract address everywhere
```

### G. Turn on platform DDoS protection (the real L7 defense)
The edge throttle is per-instance and best-effort. For a determined attack,
enable **Vercel WAF / Attack Challenge Mode** (Vercel → Firewall), or put
**Cloudflare** in front with rate-limiting rules. This is the single biggest
win for surviving a real DDoS and is configuration, not code.

---

## Known follow-ups (not done yet)

- **Meme score is a single hot document.** Firestore caps ~1 write/sec/doc, so a
  genuinely viral meme (>1 vote/sec sustained) can drop votes. Fix: shard the
  score into N sub-counters + a Vercel Cron rollup into a sortable `score`
  field. Deferred because it changes score-ordering semantics.
- **Rate limiter stays on Firestore** (your choice). It's fine for normal load
  with the edge throttle in front, but a sustained flood still costs Firestore
  writes. Moving to Upstash Redis / Vercel KV is the upgrade path.
- **Treasury key is a single hot key** (deployer == treasury) in env. Consider a
  dedicated treasury signer, a spend cap, and balance alerting.
- **Nonce-gap edge case**: if a reserved nonce's tx fails to broadcast, later
  txs queue until the chain catches up; the counter self-heals from the
  confirmed count, but a monitored alert on stuck nonces is worth adding.
- **Stricter CSP**: current policy keeps `unsafe-inline`/`unsafe-eval` for the
  Next runtime + wallet SDKs. A nonce-based CSP is a future hardening.
- **Full smart-contract audit** before any mainnet deployment. The contracts are
  reference implementations.
