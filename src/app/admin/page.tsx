"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { MISSIONS } from "@/lib/missions";
import {
  Users, Settings, Star, Activity, Shield, ChevronDown,
  Search, Plus, Trash2, Check, X, RefreshCw, BarChart3,
} from "lucide-react";

const C = {
  bg:     "#000000",
  card:   "#0D0B07",
  cardH:  "#111008",
  border: "#1E1A10",
  borderH:"#2A2310",
  gold:   "#C9A84C",
  goldL:  "#E2BF6E",
  text:   "#E8DFC8",
  muted:  "#8C7A5C",
  mutedL: "#6A5A3A",
  green:  "#00C896",
  red:    "#FF4545",
  purple: "#A78BFA",
};

const ADMIN_EMAIL  = "nazsats@gmail.com";
const ADMIN_WALLET = "0x6d54ef5fa17d69717ff96d2d868e040034f26024";
const FONT = "var(--font-cinzel, Georgia, serif)";

// ── Types ─────────────────────────────────────────────────────────────────
interface Stats {
  totalUsers:        number;
  totalPoints:       number;
  totalOtterClaimed: number;
  totalClaims:       number;
  whitelistCount:    number;
  walletCount:       number;
  tiers: { NEWCOMER: number; MEMBER: number; OG: number };
  season: SeasonSettings;
}

interface UserRow {
  uid:              string;
  email:            string | null;
  displayName:      string;
  walletAddress:    string | null;
  points:           number;
  tier:             "NEWCOMER" | "MEMBER" | "OG";
  referralCount:    number;
  missionsCompleted: number;
  claimCount:       number;
  createdAt:        number;
}

interface WhitelistEntry {
  id:           string;
  uid:          string;
  displayName:  string;
  walletAddress: string | null;
  email:        string | null;
  allocation:   number;
  reason:       string;
  status:       string;
  addedAt:      number;
}

interface SeasonSettings {
  active:               boolean;
  name:                 string;
  number:               number;
  otterPrecious:        boolean;
  otterMinMissions:     number;
  otterMinReferrals:    number;
  otterMinTier:         string;
  requireManualApproval: boolean;
  activityPointsEnabled: boolean;
  memeArenaEnabled:      boolean;
  dropHuntEnabled:       boolean;
}

type Tab = "overview" | "users" | "whitelist" | "season" | "missions";

// ── Helpers ───────────────────────────────────────────────────────────────
function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
function fmtDate(seconds: number) {
  if (!seconds) return "—";
  return new Date(seconds * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

// ── AdminAPI helper ───────────────────────────────────────────────────────
async function adminFetch(path: string, token: string, opts?: RequestInit) {
  const res = await fetch(path, {
    ...opts,
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Sub-components ────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = C.gold }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "20px 24px" }}>
      <div style={{ fontFamily: FONT, fontSize: "10px", color: C.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "10px" }}>{label}</div>
      <div style={{ fontFamily: FONT, fontSize: "28px", fontWeight: 900, color, letterSpacing: "0.02em" }}>{value}</div>
      {sub && <div style={{ fontFamily: FONT, fontSize: "11px", color: C.mutedL, marginTop: "6px", letterSpacing: "0.06em" }}>{sub}</div>}
    </div>
  );
}

function Tag({ children, color = C.muted }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ display: "inline-block", background: `${color}18`, color, border: `1px solid ${color}30`, borderRadius: "20px", padding: "2px 10px", fontSize: "10px", fontFamily: FONT, fontWeight: 700, letterSpacing: "0.08em" }}>
      {children}
    </span>
  );
}

function AdminBtn({
  onClick, children, variant = "outline", disabled = false, small = false,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: "gold" | "outline" | "danger" | "ghost";
  disabled?: boolean;
  small?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    gold:    { background: `linear-gradient(135deg, ${C.gold}, ${C.goldL})`, color: "#000", border: "none" },
    outline: { background: "transparent", color: C.text, border: `1px solid ${C.border}` },
    danger:  { background: "transparent", color: C.red, border: `1px solid ${C.red}30` },
    ghost:   { background: "transparent", color: C.muted, border: "none" },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[variant],
        fontFamily: FONT, fontSize: small ? "10px" : "11px", fontWeight: 700,
        letterSpacing: "0.08em", padding: small ? "5px 10px" : "8px 16px",
        borderRadius: "6px", cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, transition: "opacity 0.15s",
      }}
    >
      {children}
    </button>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────
function useAdminToast() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const show = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  };
  const Toast = msg ? (
    <div style={{
      position: "fixed", bottom: "24px", right: "24px", zIndex: 999,
      background: msg.ok ? "#001A11" : "#1A0000",
      border: `1px solid ${msg.ok ? C.green : C.red}40`,
      borderRadius: "10px", padding: "12px 20px",
      fontFamily: FONT, fontSize: "12px", letterSpacing: "0.06em",
      color: msg.ok ? C.green : C.red,
    }}>
      {msg.ok ? "✓ " : "✗ "}{msg.text}
    </div>
  ) : null;
  return { show, Toast };
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Admin Page
// ═══════════════════════════════════════════════════════════════════════════

export default function AdminPage() {
  const { user, profile, loading } = useAuth();
  const [tab, setTab]     = useState<Tab>("overview");
  const [token, setToken] = useState<string>("");
  const toast = useAdminToast();

  // Verify admin
  const isAdmin = (
    user?.email?.toLowerCase() === ADMIN_EMAIL ||
    profile?.walletAddress?.toLowerCase() === ADMIN_WALLET
  );

  useEffect(() => {
    if (user) {
      user.getIdToken().then(setToken).catch(console.error);
    }
  }, [user]);

  if (loading) return <LoadingScreen />;
  if (!user)   return <AccessDenied reason="Sign in to access the admin panel." />;
  if (!isAdmin) return <AccessDenied reason="Your account is not authorized for admin access." />;

  const TABS: { id: Tab; label: string; glyph: string; icon: React.ReactNode }[] = [
    { id: "overview",  label: "OVERVIEW",  glyph: "א", icon: <BarChart3 size={12} /> },
    { id: "users",     label: "USERS",     glyph: "ב", icon: <Users size={12} /> },
    { id: "whitelist", label: "WHITELIST", glyph: "ג", icon: <Star size={12} /> },
    { id: "season",    label: "SEASON",    glyph: "ד", icon: <Settings size={12} /> },
    { id: "missions",  label: "MISSIONS",  glyph: "ה", icon: <Shield size={12} /> },
  ];

  return (
    <>
      {toast.Toast}
      <div style={{ minHeight: "100vh", background: C.bg, paddingTop: "64px" }}>

        {/* ── Header ── */}
        <div style={{ borderBottom: `1px solid ${C.border}`, background: "rgba(13,11,7,0.95)", padding: "20px 32px" }}>
          <div style={{ maxWidth: "1440px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: FONT, fontSize: "9px", color: C.muted, letterSpacing: "0.2em", marginBottom: "4px" }}>⟦ ADMIN CONTROL — RESTRICTED ⟧</div>
              <h1 style={{ fontFamily: FONT, fontSize: "18px", fontWeight: 900, letterSpacing: "0.08em", background: `linear-gradient(135deg, ${C.gold}, ${C.goldL})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                OTTER PROTOCOL · COMMAND SEAL
              </h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.green }} />
              <span style={{ fontFamily: FONT, fontSize: "10px", color: C.muted, letterSpacing: "0.1em" }}>
                {profile?.displayName || user.email?.split("@")[0]}
              </span>
            </div>
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div style={{ borderBottom: `1px solid ${C.border}`, background: C.card, padding: "0 32px" }}>
          <div style={{ maxWidth: "1440px", margin: "0 auto", display: "flex", gap: "0" }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  fontFamily: FONT, fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em",
                  padding: "14px 20px", background: "none", border: "none", cursor: "pointer",
                  color: tab === t.id ? C.gold : C.muted,
                  borderBottom: tab === t.id ? `2px solid ${C.gold}` : "2px solid transparent",
                  display: "flex", alignItems: "center", gap: "6px",
                  transition: "color 0.15s",
                }}
              >
                <span style={{ fontFamily: "Georgia, serif", fontSize: "12px" }}>{t.glyph}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "32px" }}>
          {tab === "overview"  && <OverviewTab  token={token} toast={toast.show} />}
          {tab === "users"     && <UsersTab     token={token} toast={toast.show} />}
          {tab === "whitelist" && <WhitelistTab token={token} toast={toast.show} />}
          {tab === "season"    && <SeasonTab    token={token} toast={toast.show} />}
          {tab === "missions"  && <MissionsTab  token={token} toast={toast.show} />}
        </div>
      </div>
    </>
  );
}

// ── Loading / Access Denied ───────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: FONT, color: C.gold, fontSize: "12px", letterSpacing: "0.2em" }}>VERIFYING SEAL…</div>
    </div>
  );
}

function AccessDenied({ reason }: { reason: string }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: "40px", color: C.red }}>⊗</div>
      <div style={{ fontFamily: FONT, fontSize: "14px", fontWeight: 700, color: C.text, letterSpacing: "0.08em" }}>ACCESS DENIED</div>
      <div style={{ fontFamily: FONT, fontSize: "11px", color: C.muted, letterSpacing: "0.06em" }}>{reason}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Overview Tab
// ═══════════════════════════════════════════════════════════════════════════
function OverviewTab({ token, toast }: { token: string; toast: (m: string, ok?: boolean) => void }) {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminFetch("/api/admin/stats", token);
      setStats(data);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load stats", false);
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (!stats)  return null;

  const tierColor = { NEWCOMER: C.muted, MEMBER: C.green, OG: C.gold };

  return (
    <div>
      <SectionHeader glyph="א" title="PROTOCOL OVERVIEW" action={<AdminBtn onClick={load} variant="ghost" small><RefreshCw size={12} /></AdminBtn>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px", marginBottom: "32px" }}>
        <StatCard label="Total Users"    value={stats.totalUsers}                    sub={`${stats.walletCount} with wallet`} />
        <StatCard label="Points Issued"  value={stats.totalPoints.toLocaleString()}  sub="across all users" />
        <StatCard label="OTTER Claimed"  value={stats.totalOtterClaimed.toLocaleString()} sub={`${stats.totalClaims} claims`} color={C.goldL} />
        <StatCard label="Whitelisted"    value={stats.whitelistCount}                sub="OTTER recipients" color={C.purple} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {/* Tier distribution */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "20px 24px" }}>
          <div style={{ fontFamily: FONT, fontSize: "10px", color: C.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "16px" }}>ג · Tier Distribution</div>
          {(["OG","MEMBER","NEWCOMER"] as const).map((t) => {
            const count = stats.tiers[t];
            const pct   = stats.totalUsers > 0 ? Math.round((count / stats.totalUsers) * 100) : 0;
            return (
              <div key={t} style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontFamily: FONT, fontSize: "11px", color: tierColor[t], letterSpacing: "0.08em" }}>{t}</span>
                  <span style={{ fontFamily: FONT, fontSize: "11px", color: C.muted }}>{count} ({pct}%)</span>
                </div>
                <div style={{ height: "4px", background: C.border, borderRadius: "2px" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: tierColor[t], borderRadius: "2px", transition: "width 0.4s" }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Season status */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "20px 24px" }}>
          <div style={{ fontFamily: FONT, fontSize: "10px", color: C.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "16px" }}>ד · Season Status</div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: stats.season?.active ? C.green : C.red }} />
            <span style={{ fontFamily: FONT, fontSize: "14px", fontWeight: 700, color: C.text, letterSpacing: "0.06em" }}>{stats.season?.name || "Season I"}</span>
          </div>
          <div style={{ fontFamily: FONT, fontSize: "11px", color: C.muted, letterSpacing: "0.06em" }}>
            Status: <span style={{ color: stats.season?.active ? C.green : C.red }}>{stats.season?.active ? "ACTIVE" : "PAUSED"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Users Tab
// ═══════════════════════════════════════════════════════════════════════════
function UsersTab({ token, toast }: { token: string; toast: (m: string, ok?: boolean) => void }) {
  const [users, setUsers]   = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]  = useState("");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [editing, setEditing]   = useState<{ points: string; tier: string; note: string }>({ points: "", tier: "", note: "" });
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async (q?: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminFetch(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`, token);
      setUsers(data.users);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load users", false);
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(search);
  };

  const openEdit = (u: UserRow) => {
    setSelected(u);
    setEditing({ points: String(u.points), tier: u.tier, note: "" });
  };

  const saveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await adminFetch("/api/admin/users", token, {
        method: "PUT",
        body: JSON.stringify({ uid: selected.uid, points: Number(editing.points), tier: editing.tier, note: editing.note }),
      });
      toast("User updated");
      setSelected(null);
      load(search);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Update failed", false);
    } finally {
      setSaving(false);
    }
  };

  const tierColor = { NEWCOMER: C.muted, MEMBER: C.green, OG: C.gold };

  return (
    <div>
      <SectionHeader glyph="ב" title="USER REGISTRY" action={<AdminBtn onClick={() => load()} variant="ghost" small><RefreshCw size={12} /></AdminBtn>} />

      {/* Search */}
      <form onSubmit={handleSearch} style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={14} color={C.muted} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, name, wallet, or uid…"
            style={{
              width: "100%", background: C.card, border: `1px solid ${C.border}`,
              borderRadius: "8px", padding: "10px 12px 10px 36px",
              fontFamily: FONT, fontSize: "12px", color: C.text, letterSpacing: "0.04em", outline: "none",
            }}
          />
        </div>
        <AdminBtn variant="outline">SEARCH</AdminBtn>
      </form>

      {loading ? <Spinner /> : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["USER","TIER","POINTS","WALLET","MISSIONS","REFERRALS","JOINED","ACTIONS"].map((h) => (
                    <th key={h} style={{ fontFamily: FONT, fontSize: "9px", color: C.muted, letterSpacing: "0.14em", padding: "12px 16px", textAlign: "left", fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.uid} style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.1s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.cardH)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontFamily: FONT, fontSize: "12px", color: C.text, fontWeight: 600, letterSpacing: "0.04em" }}>{u.displayName}</div>
                      <div style={{ fontFamily: FONT, fontSize: "10px", color: C.muted, marginTop: "2px", letterSpacing: "0.02em" }}>{u.email || "—"}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Tag color={(tierColor as Record<string, string>)[u.tier] || C.muted}>{u.tier}</Tag>
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: FONT, fontSize: "12px", color: C.gold, fontWeight: 700 }}>
                      {u.points.toLocaleString()}
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "11px", color: C.muted }}>
                      {u.walletAddress ? shortAddr(u.walletAddress) : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: FONT, fontSize: "12px", color: C.text, textAlign: "center" }}>{u.missionsCompleted}/14</td>
                    <td style={{ padding: "12px 16px", fontFamily: FONT, fontSize: "12px", color: C.text, textAlign: "center" }}>{u.referralCount}</td>
                    <td style={{ padding: "12px 16px", fontFamily: FONT, fontSize: "10px", color: C.muted }}>{fmtDate(u.createdAt)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <AdminBtn onClick={() => openEdit(u)} variant="outline" small>EDIT</AdminBtn>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: "32px", textAlign: "center", fontFamily: FONT, fontSize: "12px", color: C.muted, letterSpacing: "0.08em" }}>NO USERS FOUND</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#0D0B07", border: `1px solid ${C.border}`, borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "420px" }}>
            <div style={{ fontFamily: FONT, fontSize: "10px", color: C.muted, letterSpacing: "0.16em", marginBottom: "16px" }}>⟦ EDIT USER RECORD ⟧</div>
            <div style={{ fontFamily: FONT, fontSize: "15px", fontWeight: 700, color: C.text, letterSpacing: "0.04em", marginBottom: "20px" }}>{selected.displayName}</div>

            <Label>POINTS</Label>
            <input type="number" value={editing.points} onChange={(e) => setEditing({ ...editing, points: e.target.value })}
              style={inputStyle} />

            <Label>TIER</Label>
            <select value={editing.tier} onChange={(e) => setEditing({ ...editing, tier: e.target.value })}
              style={{ ...inputStyle, appearance: "none" }}>
              <option value="NEWCOMER">NEWCOMER</option>
              <option value="MEMBER">MEMBER</option>
              <option value="OG">OG</option>
            </select>

            <Label>NOTE (internal)</Label>
            <input value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })}
              placeholder="Why this change?"
              style={inputStyle} />

            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <AdminBtn onClick={saveEdit} variant="gold" disabled={saving}>{saving ? "SAVING…" : "SAVE"}</AdminBtn>
              <AdminBtn onClick={() => setSelected(null)} variant="ghost">CANCEL</AdminBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Whitelist Tab
// ═══════════════════════════════════════════════════════════════════════════
function WhitelistTab({ token, toast }: { token: string; toast: (m: string, ok?: boolean) => void }) {
  const [list, setList]       = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [form, setForm]       = useState({ uid: "", allocation: "500", reason: "" });
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminFetch("/api/admin/whitelist", token);
      setList(data.entries);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load whitelist", false);
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => { load(); }, [load]);

  const addToWhitelist = async () => {
    if (!form.uid) return;
    setSaving(true);
    try {
      await adminFetch("/api/admin/whitelist", token, {
        method: "POST",
        body:   JSON.stringify({ uid: form.uid, allocation: Number(form.allocation), reason: form.reason }),
      });
      toast("Added to OTTER whitelist");
      setAdding(false);
      setForm({ uid: "", allocation: "500", reason: "" });
      load();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to add", false);
    } finally {
      setSaving(false);
    }
  };

  const removeFromWhitelist = async (uid: string) => {
    if (!confirm("Remove this user from the OTTER whitelist?")) return;
    try {
      await adminFetch(`/api/admin/whitelist?uid=${uid}`, token, { method: "DELETE" });
      toast("Removed from whitelist");
      load();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to remove", false);
    }
  };

  return (
    <div>
      <SectionHeader
        glyph="ג"
        title="OTTER WHITELIST — PRECIOUS ALLOCATION"
        action={
          <div style={{ display: "flex", gap: "10px" }}>
            <AdminBtn onClick={() => load()} variant="ghost" small><RefreshCw size={12} /></AdminBtn>
            <AdminBtn onClick={() => setAdding(true)} variant="gold" small><Plus size={12} style={{ marginRight: "4px" }} />ADD</AdminBtn>
          </div>
        }
      />

      <div style={{ background: "rgba(201,168,76,0.04)", border: `1px solid rgba(201,168,76,0.2)`, borderRadius: "10px", padding: "14px 18px", marginBottom: "20px" }}>
        <p style={{ fontFamily: FONT, fontSize: "11px", color: C.muted, lineHeight: 1.8, letterSpacing: "0.04em" }}>
          ◈ OTTER is precious and scarce. Only whitelisted users can receive real OTTER tokens on mainnet launch. Requirements: OG tier + 8+ missions + 3+ referrals + manual admin approval.
        </p>
      </div>

      {loading ? <Spinner /> : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["USER","WALLET","ALLOCATION","REASON","STATUS","ADDED","ACTIONS"].map((h) => (
                  <th key={h} style={{ fontFamily: FONT, fontSize: "9px", color: C.muted, letterSpacing: "0.14em", padding: "12px 16px", textAlign: "left", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={(ev) => (ev.currentTarget.style.background = C.cardH)}
                  onMouseLeave={(ev) => (ev.currentTarget.style.background = "")}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontFamily: FONT, fontSize: "12px", color: C.text, fontWeight: 600 }}>{e.displayName}</div>
                    <div style={{ fontFamily: FONT, fontSize: "10px", color: C.muted, marginTop: "2px" }}>{e.email || e.uid}</div>
                  </td>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "11px", color: C.muted }}>
                    {e.walletAddress ? shortAddr(e.walletAddress) : "—"}
                  </td>
                  <td style={{ padding: "12px 16px", fontFamily: FONT, fontSize: "13px", fontWeight: 700, color: C.gold }}>
                    {e.allocation.toLocaleString()} OTTER
                  </td>
                  <td style={{ padding: "12px 16px", fontFamily: FONT, fontSize: "11px", color: C.muted, maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.reason || "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Tag color={e.status === "approved" ? C.green : C.muted}>{e.status.toUpperCase()}</Tag>
                  </td>
                  <td style={{ padding: "12px 16px", fontFamily: FONT, fontSize: "10px", color: C.muted }}>{fmtDate(e.addedAt)}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <AdminBtn onClick={() => removeFromWhitelist(e.uid)} variant="danger" small>
                      <Trash2 size={12} />
                    </AdminBtn>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={7} style={{ padding: "32px", textAlign: "center", fontFamily: FONT, fontSize: "12px", color: C.muted, letterSpacing: "0.08em" }}>NO WHITELISTED USERS YET</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {adding && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#0D0B07", border: `1px solid rgba(201,168,76,0.3)`, borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "420px" }}>
            <div style={{ fontFamily: FONT, fontSize: "10px", color: C.gold, letterSpacing: "0.16em", marginBottom: "16px" }}>⟦ ADD TO OTTER WHITELIST ⟧</div>

            <Label>USER UID</Label>
            <input value={form.uid} onChange={(e) => setForm({ ...form, uid: e.target.value })}
              placeholder="Firebase UID of the user"
              style={inputStyle} />

            <Label>OTTER ALLOCATION</Label>
            <input type="number" value={form.allocation} onChange={(e) => setForm({ ...form, allocation: e.target.value })}
              style={inputStyle} />

            <Label>REASON</Label>
            <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Why this user deserves OTTER"
              style={inputStyle} />

            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <AdminBtn onClick={addToWhitelist} variant="gold" disabled={saving || !form.uid}>{saving ? "ADDING…" : "ADD TO WHITELIST"}</AdminBtn>
              <AdminBtn onClick={() => setAdding(false)} variant="ghost">CANCEL</AdminBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Season Tab
// ═══════════════════════════════════════════════════════════════════════════
function SeasonTab({ token, toast }: { token: string; toast: (m: string, ok?: boolean) => void }) {
  const [settings, setSettings] = useState<SeasonSettings | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminFetch("/api/admin/settings", token);
      setSettings(data);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load settings", false);
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await adminFetch("/api/admin/settings", token, { method: "POST", body: JSON.stringify(settings) });
      toast("Settings saved");
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Save failed", false);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) return <Spinner />;

  const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontFamily: FONT, fontSize: "12px", color: C.text, letterSpacing: "0.06em" }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer",
          background: value ? C.green : C.border, transition: "background 0.2s", position: "relative",
        }}
      >
        <div style={{
          position: "absolute", top: "3px", left: value ? "23px" : "3px",
          width: "18px", height: "18px", borderRadius: "50%", background: "#fff",
          transition: "left 0.2s",
        }} />
      </button>
    </div>
  );

  return (
    <div>
      <SectionHeader glyph="ד" title="SEASON & PROTOCOL SETTINGS" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Season Config */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "24px" }}>
          <div style={{ fontFamily: FONT, fontSize: "10px", color: C.muted, letterSpacing: "0.14em", marginBottom: "20px" }}>SEASON CONFIGURATION</div>

          <Label>SEASON NAME</Label>
          <input value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })}
            style={inputStyle} />

          <Label>SEASON NUMBER</Label>
          <input type="number" value={settings.number} onChange={(e) => setSettings({ ...settings, number: Number(e.target.value) })}
            style={inputStyle} />

          <Toggle label="Season Active" value={settings.active} onChange={(v) => setSettings({ ...settings, active: v })} />
          <Toggle label="Meme Arena Enabled" value={settings.memeArenaEnabled} onChange={(v) => setSettings({ ...settings, memeArenaEnabled: v })} />
          <Toggle label="Drop Hunt Enabled" value={settings.dropHuntEnabled} onChange={(v) => setSettings({ ...settings, dropHuntEnabled: v })} />
          <Toggle label="Activity Points Enabled" value={settings.activityPointsEnabled} onChange={(v) => setSettings({ ...settings, activityPointsEnabled: v })} />
        </div>

        {/* OTTER Requirements */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "24px" }}>
          <div style={{ fontFamily: FONT, fontSize: "10px", color: C.muted, letterSpacing: "0.14em", marginBottom: "20px" }}>OTTER CLAIM REQUIREMENTS</div>

          <Label>MIN MISSIONS COMPLETED</Label>
          <input type="number" value={settings.otterMinMissions} onChange={(e) => setSettings({ ...settings, otterMinMissions: Number(e.target.value) })}
            style={inputStyle} />

          <Label>MIN REFERRALS</Label>
          <input type="number" value={settings.otterMinReferrals} onChange={(e) => setSettings({ ...settings, otterMinReferrals: Number(e.target.value) })}
            style={inputStyle} />

          <Label>MIN TIER REQUIRED</Label>
          <select value={settings.otterMinTier} onChange={(e) => setSettings({ ...settings, otterMinTier: e.target.value })}
            style={{ ...inputStyle, appearance: "none" }}>
            <option value="NEWCOMER">NEWCOMER</option>
            <option value="MEMBER">MEMBER</option>
            <option value="OG">OG</option>
          </select>

          <Toggle label="OTTER is Precious Mode" value={settings.otterPrecious ?? true} onChange={(v) => setSettings({ ...settings, otterPrecious: v })} />
          <Toggle label="Require Manual Admin Approval" value={settings.requireManualApproval} onChange={(v) => setSettings({ ...settings, requireManualApproval: v })} />
        </div>
      </div>

      <div style={{ marginTop: "20px" }}>
        <AdminBtn onClick={save} variant="gold" disabled={saving}>{saving ? "SAVING…" : "SAVE SETTINGS"}</AdminBtn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Missions Tab
// ═══════════════════════════════════════════════════════════════════════════
function MissionsTab({ token, toast }: { token: string; toast: (m: string, ok?: boolean) => void }) {
  const [uid, setUid]       = useState("");
  const [action, setAction] = useState<"complete"|"revoke">("complete");
  const [saving, setSaving] = useState<string | null>(null);
  const [openMission, setOpenMission] = useState<string | null>(null);

  const doMission = async (missionId: string) => {
    if (!uid.trim()) { toast("Enter a user UID first", false); return; }
    setSaving(missionId);
    try {
      await adminFetch("/api/admin/missions", token, {
        method: "POST",
        body:   JSON.stringify({ uid: uid.trim(), missionId, action }),
      });
      toast(`Mission ${action === "complete" ? "completed" : "revoked"}: ${missionId}`);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed", false);
    } finally {
      setSaving(null);
    }
  };

  const catColor: Record<string, string> = { onboarding: C.green, social: C.purple, onchain: C.gold, community: "#F5A623" };

  return (
    <div>
      <SectionHeader glyph="ה" title="MISSION MANAGEMENT" />

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "20px 24px", marginBottom: "24px" }}>
        <Label>USER UID</Label>
        <input value={uid} onChange={(e) => setUid(e.target.value)}
          placeholder="Enter Firebase UID of the user"
          style={{ ...inputStyle, marginBottom: "14px" }} />

        <div style={{ display: "flex", gap: "10px" }}>
          {(["complete","revoke"] as const).map((a) => (
            <button key={a} onClick={() => setAction(a)}
              style={{
                fontFamily: FONT, fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em",
                padding: "8px 16px", borderRadius: "6px", cursor: "pointer", border: "none",
                background: action === a ? (a === "complete" ? C.green : C.red) : C.border,
                color: action === a ? "#000" : C.muted, transition: "all 0.15s",
              }}>
              {a.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px" }}>
        {MISSIONS.map((m) => (
          <div key={m.id}
            style={{ background: C.card, border: `1px solid ${openMission === m.id ? C.border : C.border}`, borderRadius: "10px", padding: "16px", transition: "border-color 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.borderH)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px" }}>
              <div>
                <span style={{ fontSize: "16px", marginRight: "8px" }}>{m.badge}</span>
                <span style={{ fontFamily: FONT, fontSize: "12px", fontWeight: 700, color: C.text, letterSpacing: "0.04em" }}>{m.title}</span>
              </div>
              <Tag color={catColor[m.category] || C.muted}>{m.category.toUpperCase()}</Tag>
            </div>
            <div style={{ fontFamily: FONT, fontSize: "10px", color: C.muted, marginBottom: "12px", lineHeight: 1.6, letterSpacing: "0.02em" }}>{m.desc}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: FONT, fontSize: "11px", color: C.gold }}>+{m.points} pts</span>
              <AdminBtn
                onClick={() => doMission(m.id)}
                variant={action === "complete" ? "gold" : "danger"}
                disabled={saving === m.id || !uid.trim()}
                small
              >
                {saving === m.id ? "…" : action === "complete" ? <Check size={12} /> : <X size={12} />}
              </AdminBtn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Shared UI helpers ─────────────────────────────────────────────────────

function SectionHeader({ glyph, title, action }: { glyph: string; title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontFamily: "Georgia, serif", fontSize: "18px", color: C.gold }}>{glyph}</span>
        <h2 style={{ fontFamily: FONT, fontSize: "12px", fontWeight: 700, color: C.text, letterSpacing: "0.14em" }}>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: FONT, fontSize: "9px", color: C.muted, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "6px", marginTop: "14px" }}>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "48px" }}>
      <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: `2px solid ${C.border}`, borderTopColor: C.gold, animation: "spin 0.8s linear infinite" }} />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "#050400", border: `1px solid ${C.border}`,
  borderRadius: "8px", padding: "10px 14px",
  fontFamily: FONT, fontSize: "12px", color: C.text, letterSpacing: "0.04em",
  outline: "none", marginBottom: "4px",
};
