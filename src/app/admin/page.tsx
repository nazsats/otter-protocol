"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { MISSIONS } from "@/lib/missions";
import {
  INITIATION_TASKS, CATEGORY_META, DIFFICULTY_META,
  getPendingApprovals, approveManualTask, rejectManualTask,
  saveTaskOverride, getTaskOverrides, applyTaskOverrides,
  type PendingApproval, type InitiationTask, type TaskCategory, type TaskOverride,
} from "@/lib/initiation";
import {
  Users, Settings, Star, Activity, Shield, ChevronDown,
  Search, Plus, Trash2, Check, X, RefreshCw, BarChart3, Key, Copy, ToggleLeft, ToggleRight, Mail,
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
  amber:  "#F5A623",
  blue:   "#60A5FA",
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

type Tab = "overview" | "users" | "whitelist" | "season" | "missions" | "initiation" | "approvals" | "access" | "config";

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
    { id: "overview",   label: "OVERVIEW",    glyph: "א", icon: <BarChart3 size={12} /> },
    { id: "users",      label: "USERS",       glyph: "ב", icon: <Users size={12} /> },
    { id: "initiation", label: "◈ INITIATION",glyph: "ג", icon: <Activity size={12} /> },
    { id: "approvals",  label: "APPROVALS",   glyph: "ד", icon: <Check size={12} /> },
    { id: "whitelist",  label: "WHITELIST",   glyph: "ה", icon: <Star size={12} /> },
    { id: "season",     label: "SEASON",      glyph: "ו", icon: <Settings size={12} /> },
    { id: "missions",   label: "MISSIONS",    glyph: "ז", icon: <Shield size={12} /> },
    { id: "access",     label: "ACCESS CODES", glyph: "ח", icon: <Key size={12} /> },
    { id: "config",     label: "⚙ CONFIG",     glyph: "ט", icon: <Settings size={12} /> },
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
          {tab === "overview"   && <OverviewTab      token={token} toast={toast.show} />}
          {tab === "users"      && <UsersTab         token={token} toast={toast.show} />}
          {tab === "initiation" && <InitiationAdminTab toast={toast.show} />}
          {tab === "approvals"  && <ApprovalsTab     toast={toast.show} />}
          {tab === "whitelist"  && <WhitelistTab     token={token} toast={toast.show} />}
          {tab === "season"     && <SeasonTab        token={token} toast={toast.show} />}
          {tab === "missions"   && <MissionsTab      token={token} toast={toast.show} />}
          {tab === "access"     && <AccessCodesTab   token={token} toast={toast.show} />}
          {tab === "config"     && <ConfigTab        token={token} toast={toast.show} />}
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
// ═══════════════════════════════════════════════════════════════════════════
// Initiation Admin Tab — Task CRUD + on-chain info
// ═══════════════════════════════════════════════════════════════════════════
function InitiationAdminTab({ toast }: { toast: (m: string, ok?: boolean) => void }) {
  const [filterCat,  setFilterCat]  = useState<TaskCategory | "ALL">("ALL");
  const [editTask,   setEditTask]   = useState<InitiationTask | null>(null);
  const [editTitle,  setEditTitle]  = useState("");
  const [editSignal, setEditSignal] = useState("");
  const [editLink,   setEditLink]   = useState("");
  const [editDesc,   setEditDesc]   = useState("");
  const [editActive, setEditActive] = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [overrides,  setOverrides]  = useState<Record<string, TaskOverride>>({});

  useEffect(() => {
    getTaskOverrides().then(setOverrides).catch(() => {});
  }, []);

  const tasks = applyTaskOverrides(INITIATION_TASKS, overrides);

  const openEdit = (task: InitiationTask) => {
    const ov = overrides[task.id];
    setEditTask(task);
    setEditTitle(ov?.title  ?? task.title);
    setEditSignal(String(ov?.signal ?? task.signal));
    setEditLink(ov?.link  ?? task.link  ?? "");
    setEditDesc(ov?.desc  ?? task.desc);
    setEditActive(ov?.active ?? true);
  };

  const saveEdit = async () => {
    if (!editTask) return;
    setSaving(true);
    try {
      await saveTaskOverride(editTask.id, {
        title:  editTitle,
        signal: Number(editSignal),
        link:   editLink || undefined,
        desc:   editDesc,
        active: editActive,
      });
      const updated = await getTaskOverrides();
      setOverrides(updated);
      toast(`Task "${editTitle}" updated`, true);
      setEditTask(null);
    } catch {
      toast("Update failed", false);
    }
    setSaving(false);
  };

  const cats: (TaskCategory | "ALL")[] = ["ALL", "SIGNAL_ACQUISITION", "KNOWLEDGE_ARCHIVE", "CONTRIBUTION", "CIPHER_HUNT", "SIGNAL_RELAY", "GOVERNANCE"];
  const visible = filterCat === "ALL"
    ? tasks
    : tasks.filter((t) => t.category === filterCat);

  const catDone  = (cat: TaskCategory) => tasks.filter((t) => t.category === cat).length;
  const totalSignal = tasks.reduce((s, t) => s + t.signal, 0);

  return (
    <div>
      <SectionHeader glyph="ג" title="INITIATION TERMINAL — TASK REGISTRY"
        action={
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: "9px", color: C.muted, letterSpacing: "0.12em" }}>
            {tasks.length} TASKS · {totalSignal.toLocaleString()} MAX SIGNAL
          </div>
        }
      />

      {/* Overview stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: "10px", marginBottom: "24px" }}>
        {Object.entries(CATEGORY_META).map(([cat, meta]) => (
          <div key={cat} style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: "8px", padding: "14px 16px",
          }}>
            <div style={{ fontFamily: "var(--font-geist-mono)", color: meta.color, fontSize: "18px", marginBottom: "6px" }}>{meta.glyph}</div>
            <div style={{ fontFamily: FONT, color: C.text, fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "2px" }}>
              {meta.label.slice(0, 14)}
            </div>
            <div style={{ fontFamily: "var(--font-geist-mono)", color: C.muted, fontSize: "9px" }}>
              {catDone(cat as TaskCategory)} TASKS
            </div>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {editTask && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
          zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
        }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "28px", width: "100%", maxWidth: "520px" }}>
            <div style={{ fontFamily: FONT, fontSize: "9px", color: C.muted, letterSpacing: "0.2em", marginBottom: "16px" }}>
              ◈ EDIT TASK — {editTask.id.toUpperCase()}
            </div>
            <div style={{ marginBottom: "14px" }}>
              <Label>TASK TITLE</Label>
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                style={{ ...inputStyle }} />
            </div>
            <div style={{ marginBottom: "14px" }}>
              <Label>DESCRIPTION</Label>
              <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
            </div>
            <div style={{ marginBottom: "14px" }}>
              <Label>REDIRECT LINK / SOCIAL URL</Label>
              <input value={editLink} onChange={(e) => setEditLink(e.target.value)}
                placeholder="https://… or /internal-path"
                style={{ ...inputStyle }} />
            </div>
            <div style={{ marginBottom: "14px" }}>
              <Label>SIGNAL REWARD</Label>
              <input value={editSignal} onChange={(e) => setEditSignal(e.target.value)}
                type="number" style={{ ...inputStyle }} />
            </div>
            <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
              <Label>ACTIVE</Label>
              <button onClick={() => setEditActive((v) => !v)}
                style={{
                  fontFamily: FONT, fontSize: "10px", fontWeight: 700, padding: "6px 14px",
                  borderRadius: "6px", border: "none", cursor: "pointer",
                  background: editActive ? C.green : C.red, color: "#000", letterSpacing: "0.1em",
                }}>
                {editActive ? "ACTIVE" : "INACTIVE"}
              </button>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <AdminBtn onClick={saveEdit} variant="gold" disabled={saving}>
                {saving ? "SAVING…" : "SAVE CHANGES"}
              </AdminBtn>
              <AdminBtn onClick={() => setEditTask(null)} variant="outline">CANCEL</AdminBtn>
            </div>
            <div style={{ marginTop: "14px", fontFamily: "var(--font-geist-mono)", fontSize: "9px", color: C.muted, lineHeight: 1.7 }}>
              Note: Title/reward changes require an on-chain tx via guardian wallet<br/>
              (contract.updateTask()) once OTTERInitiation.sol is deployed to Sepolia.
            </div>
          </div>
        </div>
      )}

      {/* Category filter */}
      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "16px" }}>
        {cats.map((cat) => {
          const meta = cat === "ALL" ? null : CATEGORY_META[cat as TaskCategory];
          const color = meta?.color ?? C.gold;
          const isActive = filterCat === cat;
          return (
            <button key={cat} onClick={() => setFilterCat(cat as TaskCategory | "ALL")}
              style={{
                fontFamily: "var(--font-geist-mono)", fontSize: "8px", fontWeight: 700,
                padding: "5px 10px", borderRadius: "4px", border: "none",
                cursor: "pointer", letterSpacing: "0.1em",
                background: isActive ? color + "18" : "transparent",
                color: isActive ? color : C.mutedL,
                borderBottom: isActive ? `2px solid ${color}` : "2px solid transparent",
              }}>
              {cat === "ALL" ? "ALL TASKS" : (meta?.glyph + " " + cat.replace(/_/g, " "))}
            </button>
          );
        })}
      </div>

      {/* Task list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {visible.map((task) => {
          const diff = DIFFICULTY_META[task.difficulty];
          const catMeta = CATEGORY_META[task.category];
          return (
            <div key={task.id} style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: "8px", padding: "14px 18px",
              display: "flex", alignItems: "center", gap: "14px",
            }}>
              {/* Category glyph */}
              <span style={{ fontFamily: "var(--font-geist-mono)", color: catMeta.color, fontSize: "16px", flexShrink: 0, width: "24px", textAlign: "center" }}>
                {catMeta.glyph}
              </span>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: FONT, color: C.text, fontSize: "12px", fontWeight: 700, letterSpacing: "0.04em" }}>
                    {task.badge} {task.title}
                  </span>
                  <span style={{
                    fontFamily: "var(--font-geist-mono)", fontSize: "8px", color: diff.color,
                    background: diff.color + "12", border: `1px solid ${diff.color}25`,
                    padding: "1px 6px", borderRadius: "2px", letterSpacing: "0.1em",
                  }}>{diff.label}</span>
                  {task.requiresApproval && (
                    <span style={{
                      fontFamily: "var(--font-geist-mono)", fontSize: "8px", color: C.amber,
                      background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)",
                      padding: "1px 6px", borderRadius: "2px",
                    }}>MANUAL</span>
                  )}
                  {task.hidden && (
                    <span style={{
                      fontFamily: "var(--font-geist-mono)", fontSize: "8px", color: C.purple,
                      background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)",
                      padding: "1px 6px", borderRadius: "2px",
                    }}>HIDDEN</span>
                  )}
                  {task.repeatable && (
                    <span style={{
                      fontFamily: "var(--font-geist-mono)", fontSize: "8px", color: C.blue,
                      background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)",
                      padding: "1px 6px", borderRadius: "2px",
                    }}>REPEATABLE</span>
                  )}
                </div>
                <div style={{ fontFamily: "var(--font-geist-mono)", color: C.mutedL, fontSize: "9px", letterSpacing: "0.06em" }}>
                  {task.id} · contract: {task.contractId.slice(0, 12)}…
                </div>
              </div>

              {/* Signal */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "var(--font-geist-mono)", color: C.gold, fontWeight: 700, fontSize: "13px" }}>
                  +{task.signal.toLocaleString()}
                </div>
                <div style={{ fontFamily: "var(--font-geist-mono)", color: C.mutedL, fontSize: "8px" }}>SIGNAL</div>
              </div>

              {/* Edit button */}
              <AdminBtn onClick={() => openEdit(task)} variant="outline" small>EDIT</AdminBtn>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Approvals Tab — Manual task submission review queue
// ═══════════════════════════════════════════════════════════════════════════
function ApprovalsTab({ toast }: { toast: (m: string, ok?: boolean) => void }) {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [busy,      setBusy]      = useState<string | null>(null);
  const [filter,    setFilter]    = useState<"pending" | "approved" | "rejected" | "all">("pending");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPendingApprovals();
      setApprovals(data);
    } catch {
      toast("Failed to load approvals", false);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (a: PendingApproval) => {
    setBusy(a.id);
    try {
      await approveManualTask(a.id, a.uid, a.taskId);
      toast(`Approved: ${a.taskId}`, true);
      await load();
    } catch {
      toast("Approval failed", false);
    }
    setBusy(null);
  };

  const handleReject = async (a: PendingApproval) => {
    setBusy(a.id + "_r");
    try {
      await rejectManualTask(a.id);
      toast(`Rejected: ${a.taskId}`, true);
      await load();
    } catch {
      toast("Rejection failed", false);
    }
    setBusy(null);
  };

  const visible = filter === "all" ? approvals : approvals.filter((a) => a.status === filter);
  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionHeader glyph="ד" title="APPROVAL QUEUE — GUARDIAN REVIEW"
        action={
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {pendingCount > 0 && (
              <span style={{
                fontFamily: "var(--font-geist-mono)", fontSize: "9px", color: C.amber,
                background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.3)",
                padding: "3px 10px", borderRadius: "3px", letterSpacing: "0.1em",
              }}>
                {pendingCount} PENDING
              </span>
            )}
            <AdminBtn onClick={load} variant="ghost" small><RefreshCw size={12} /></AdminBtn>
          </div>
        }
      />

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px" }}>
        {(["pending", "approved", "rejected", "all"] as const).map((f) => {
          const colors = { pending: C.amber, approved: C.green, rejected: C.red, all: C.gold };
          return (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                fontFamily: "var(--font-geist-mono)", fontSize: "9px", fontWeight: 700,
                padding: "6px 14px", borderRadius: "4px", border: "none",
                cursor: "pointer", letterSpacing: "0.1em",
                background: filter === f ? colors[f] + "15" : "transparent",
                color: filter === f ? colors[f] : C.mutedL,
                borderBottom: filter === f ? `2px solid ${colors[f]}` : "2px solid transparent",
              }}>
              {f.toUpperCase()} {f === "pending" ? `(${pendingCount})` : ""}
            </button>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: "8px", padding: "40px", textAlign: "center",
        }}>
          <div style={{ fontFamily: "var(--font-geist-mono)", color: C.muted, fontSize: "10px", letterSpacing: "0.16em" }}>
            {filter === "pending" ? "> NO PENDING SUBMISSIONS" : `> NO ${filter.toUpperCase()} ITEMS`}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {visible.map((a) => {
          const task = INITIATION_TASKS.find((t) => t.id === a.taskId);
          const statusColor = { pending: C.amber, approved: C.green, rejected: C.red }[a.status];
          const date = a.submittedAt?.seconds
            ? new Date(a.submittedAt.seconds * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })
            : "—";

          return (
            <div key={a.id} style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${statusColor}`,
              borderRadius: "8px", padding: "16px 20px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "10px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontFamily: FONT, color: C.text, fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em" }}>
                      {task?.badge} {task?.title ?? a.taskId}
                    </span>
                    <span style={{
                      fontFamily: "var(--font-geist-mono)", fontSize: "8px", color: statusColor,
                      background: statusColor + "10", border: `1px solid ${statusColor}30`,
                      padding: "1px 8px", borderRadius: "3px", letterSpacing: "0.1em",
                    }}>{a.status.toUpperCase()}</span>
                    {task && (
                      <span style={{
                        fontFamily: "var(--font-geist-mono)", fontSize: "8px", color: C.gold,
                      }}>+{task.signal} SIGNAL</span>
                    )}
                  </div>
                  <div style={{ fontFamily: "var(--font-geist-mono)", color: C.mutedL, fontSize: "9px" }}>
                    UID: {a.uid.slice(0, 12)}… · {date}
                  </div>
                </div>

                {a.status === "pending" && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <AdminBtn
                      onClick={() => handleApprove(a)}
                      variant="gold"
                      disabled={busy === a.id}
                      small
                    >
                      {busy === a.id ? "…" : "APPROVE"}
                    </AdminBtn>
                    <AdminBtn
                      onClick={() => handleReject(a)}
                      variant="danger"
                      disabled={busy === a.id + "_r"}
                      small
                    >
                      {busy === a.id + "_r" ? "…" : "REJECT"}
                    </AdminBtn>
                  </div>
                )}
              </div>

              {/* Proof */}
              {a.proofUrl && (
                <div style={{ marginBottom: "8px" }}>
                  <div style={{ fontFamily: "var(--font-geist-mono)", color: C.mutedL, fontSize: "8px", letterSpacing: "0.12em", marginBottom: "4px" }}>PROOF URL</div>
                  <a href={a.proofUrl} target="_blank" rel="noopener noreferrer"
                    style={{ fontFamily: "var(--font-geist-mono)", color: C.blue, fontSize: "10px", wordBreak: "break-all" }}>
                    {a.proofUrl}
                  </a>
                </div>
              )}
              {a.note && (
                <div>
                  <div style={{ fontFamily: "var(--font-geist-mono)", color: C.mutedL, fontSize: "8px", letterSpacing: "0.12em", marginBottom: "4px" }}>NOTE</div>
                  <div style={{ fontFamily: FONT, color: C.muted, fontSize: "11px", lineHeight: 1.7 }}>{a.note}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

// ═══════════════════════════════════════════════════════════════════════════
// Access Codes Tab
// ═══════════════════════════════════════════════════════════════════════════

interface AccessCode {
  id:        string;
  code:      string;
  label:     string;
  uses:      number;
  active:    boolean;
  createdAt: number;
}

interface WaitlistEntry {
  id:        string;
  email:     string;
  createdAt: number;
}

function AccessCodesTab({ token, toast }: { token: string; toast: (m: string, ok?: boolean) => void }) {
  const [codes,    setCodes]    = useState<AccessCode[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [label,    setLabel]    = useState("");
  const [creating, setCreating] = useState(false);
  const [copied,   setCopied]   = useState<string | null>(null);
  const [view,     setView]     = useState<"codes" | "waitlist">("codes");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [codeRes, waitRes] = await Promise.all([
        adminFetch("/api/admin/access-codes", token),
        adminFetch("/api/admin/waitlist", token),
      ]);
      setCodes(codeRes.codes ?? []);
      setWaitlist(waitRes.entries ?? []);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load", false);
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => { load(); }, [load]);

  const createCode = async () => {
    setCreating(true);
    try {
      const newCode = await adminFetch("/api/admin/access-codes", token, {
        method: "POST",
        body: JSON.stringify({ label: label.trim() || "Manual" }),
      });
      setCodes((prev) => [newCode, ...prev]);
      setLabel("");
      toast(`Code created: ${formatDisplayCode(newCode.code)}`);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to create", false);
    } finally {
      setCreating(false);
    }
  };

  const deleteCode = async (id: string) => {
    if (!confirm("Delete this access code?")) return;
    try {
      await adminFetch("/api/admin/access-codes", token, {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      setCodes((prev) => prev.filter((c) => c.id !== id));
      toast("Code deleted");
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to delete", false);
    }
  };

  const toggleCode = async (id: string, active: boolean) => {
    try {
      await adminFetch("/api/admin/access-codes", token, {
        method: "PATCH",
        body: JSON.stringify({ id, active: !active }),
      });
      setCodes((prev) => prev.map((c) => c.id === id ? { ...c, active: !active } : c));
      toast(active ? "Code deactivated" : "Code activated");
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to toggle", false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(formatDisplayCode(code)).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 1800);
    toast("Copied to clipboard");
  };

  function formatDisplayCode(raw: string) {
    const clean = raw.replace(/-/g, "").toUpperCase().slice(0, 24);
    const parts: string[] = [];
    for (let i = 0; i < clean.length; i += 6) parts.push(clean.slice(i, i + 6));
    return parts.join("-");
  }

  function fmtTs(ms: number) {
    if (!ms) return "—";
    return new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
  }

  const exportWaitlist = () => {
    const csv = ["email,date", ...waitlist.map((e) => `${e.email},${fmtTs(e.createdAt)}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "waitlist.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Spinner />;

  return (
    <div>
      {/* View switcher */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "28px" }}>
        {(["codes", "waitlist"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} style={{
            fontFamily: FONT, fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em",
            padding: "8px 18px", borderRadius: "6px", cursor: "pointer",
            background: view === v ? `linear-gradient(135deg, ${C.gold}, ${C.goldL})` : "transparent",
            color: view === v ? "#000" : C.muted,
            border: view === v ? "none" : `1px solid ${C.border}`,
          }}>
            {v === "codes" ? `⟦ ACCESS CODES (${codes.length}) ⟧` : `⟦ WAITLIST (${waitlist.length}) ⟧`}
          </button>
        ))}
        <button onClick={load} style={{ marginLeft: "auto", background: "none", border: `1px solid ${C.border}`, borderRadius: "6px", cursor: "pointer", padding: "8px 12px", color: C.muted }}>
          <RefreshCw size={12} />
        </button>
      </div>

      {view === "codes" && (
        <>
          {/* Create new code */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "20px 24px", marginBottom: "24px" }}>
            <div style={{ fontFamily: FONT, fontSize: "10px", color: C.muted, letterSpacing: "0.14em", marginBottom: "14px" }}>⟦ GENERATE NEW CODE ⟧</div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input
                placeholder="Label (e.g. Twitter giveaway, Discord event…)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createCode()}
                style={{ ...inputStyle, flex: 1, minWidth: "220px", marginBottom: 0 }}
              />
              <AdminBtn variant="gold" onClick={createCode} disabled={creating}>
                <Plus size={11} style={{ marginRight: "5px" }} />
                {creating ? "GENERATING…" : "GENERATE CODE"}
              </AdminBtn>
            </div>
          </div>

          {/* Code list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {codes.length === 0 && (
              <div style={{ fontFamily: FONT, fontSize: "11px", color: C.muted, textAlign: "center", padding: "40px" }}>
                No access codes yet. Generate one above.
              </div>
            )}
            {codes.map((c) => (
              <div key={c.id} style={{
                background: C.card, border: `1px solid ${c.active ? C.border : C.red + "30"}`,
                borderRadius: "10px", padding: "14px 20px",
                display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap",
                opacity: c.active ? 1 : 0.55,
              }}>
                {/* Code */}
                <code style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: "14px", letterSpacing: "0.12em", color: c.active ? C.gold : C.muted, flex: "1 1 200px" }}>
                  {formatDisplayCode(c.code)}
                </code>

                {/* Label */}
                <span style={{ fontFamily: FONT, fontSize: "10px", color: C.mutedL, flex: "1 1 120px" }}>
                  {c.label || "—"}
                </span>

                {/* Uses */}
                <span style={{ fontFamily: FONT, fontSize: "10px", color: C.muted, minWidth: "60px" }}>
                  {c.uses} use{c.uses !== 1 ? "s" : ""}
                </span>

                {/* Date */}
                <span style={{ fontFamily: FONT, fontSize: "10px", color: C.mutedL, minWidth: "70px" }}>
                  {fmtTs(c.createdAt)}
                </span>

                {/* Status badge */}
                <Tag color={c.active ? C.green : C.red}>{c.active ? "ACTIVE" : "DISABLED"}</Tag>

                {/* Actions */}
                <div style={{ display: "flex", gap: "6px", marginLeft: "auto" }}>
                  <button onClick={() => copyCode(c.code)} title="Copy code"
                    style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: "6px", padding: "6px 8px", cursor: "pointer", color: copied === c.code ? C.green : C.muted }}>
                    <Copy size={12} />
                  </button>
                  <button onClick={() => toggleCode(c.id, c.active)} title={c.active ? "Deactivate" : "Activate"}
                    style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: "6px", padding: "6px 8px", cursor: "pointer", color: c.active ? C.amber : C.green }}>
                    {c.active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                  </button>
                  <button onClick={() => deleteCode(c.id)} title="Delete"
                    style={{ background: "none", border: `1px solid ${C.red}30`, borderRadius: "6px", padding: "6px 8px", cursor: "pointer", color: C.red }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {view === "waitlist" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ fontFamily: FONT, fontSize: "10px", color: C.muted, letterSpacing: "0.12em" }}>
              {waitlist.length} email{waitlist.length !== 1 ? "s" : ""} waiting
            </div>
            <AdminBtn variant="outline" small onClick={exportWaitlist}>
              <Mail size={10} style={{ marginRight: "5px" }} /> EXPORT CSV
            </AdminBtn>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {waitlist.length === 0 && (
              <div style={{ fontFamily: FONT, fontSize: "11px", color: C.muted, textAlign: "center", padding: "40px" }}>
                No waitlist entries yet.
              </div>
            )}
            {waitlist.map((entry, i) => (
              <div key={entry.id} style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: "8px",
                padding: "12px 18px", display: "flex", alignItems: "center", gap: "16px",
              }}>
                <span style={{ fontFamily: FONT, fontSize: "10px", color: C.mutedL, minWidth: "32px" }}>#{i + 1}</span>
                <span style={{ fontFamily: FONT, fontSize: "12px", color: C.text, flex: 1 }}>{entry.email}</span>
                <span style={{ fontFamily: FONT, fontSize: "10px", color: C.mutedL }}>{fmtTs(entry.createdAt)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Config Tab — Contracts, Social Links, Mission Overrides
// ═══════════════════════════════════════════════════════════════════════════

function ConfigTab({ token, toast }: { token: string; toast: (m: string, ok?: boolean) => void }) {
  // ── Contracts ──────────────────────────────────────────────────────────
  const [contracts, setContracts] = useState({ otterContract: "", initiationContract: "", network: "sepolia" });
  const [savingC,   setSavingC]   = useState(false);

  // ── Social Links ────────────────────────────────────────────────────────
  const [social,  setSocial]  = useState({ twitter: "", discord: "", medium: "", telegram: "", website: "" });
  const [savingS, setSavingS] = useState(false);

  // ── Mission Overrides ───────────────────────────────────────────────────
  const [overrides,    setOverrides]    = useState<Record<string, { title?: string; desc?: string; points?: number; link?: string; active?: boolean }>>({});
  const [editMission,  setEditMission]  = useState<string | null>(null);
  const [editFields,   setEditFields]   = useState({ title: "", desc: "", points: 0, link: "", active: true });
  const [savingM,      setSavingM]      = useState(false);
  const [loadingM,     setLoadingM]     = useState(true);

  const { MISSIONS } = require("@/lib/missions") as { MISSIONS: { id: string; title: string; desc: string; points: number; link?: string; category: string }[] };

  useEffect(() => {
    if (!token) return;
    Promise.all([
      adminFetch("/api/admin/contracts",  token),
      adminFetch("/api/admin/social-links", token),
      adminFetch("/api/admin/mission-overrides", token),
    ]).then(([c, s, m]) => {
      setContracts(c);
      setSocial(s);
      setOverrides(m.overrides ?? {});
      setLoadingM(false);
    }).catch((e: unknown) => {
      toast(e instanceof Error ? e.message : "Failed to load config", false);
      setLoadingM(false);
    });
  }, [token, toast]);

  const saveContracts = async () => {
    setSavingC(true);
    try {
      await adminFetch("/api/admin/contracts", token, { method: "POST", body: JSON.stringify(contracts) });
      toast("Contract addresses saved — app will use new addresses immediately");
    } catch (e: unknown) { toast(e instanceof Error ? e.message : "Save failed", false); }
    setSavingC(false);
  };

  const saveSocial = async () => {
    setSavingS(true);
    try {
      await adminFetch("/api/admin/social-links", token, { method: "POST", body: JSON.stringify(social) });
      toast("Social links saved");
    } catch (e: unknown) { toast(e instanceof Error ? e.message : "Save failed", false); }
    setSavingS(false);
  };

  const openMissionEdit = (m: { id: string; title: string; desc: string; points: number; link?: string }) => {
    const ov = overrides[m.id] ?? {};
    setEditFields({ title: ov.title ?? m.title, desc: ov.desc ?? m.desc, points: ov.points ?? m.points, link: ov.link ?? m.link ?? "", active: ov.active !== false });
    setEditMission(m.id);
  };

  const saveMissionEdit = async () => {
    if (!editMission) return;
    setSavingM(true);
    try {
      await adminFetch("/api/admin/mission-overrides", token, { method: "POST", body: JSON.stringify({ missionId: editMission, ...editFields }) });
      setOverrides((p) => ({ ...p, [editMission]: editFields }));
      toast(`Mission updated: ${editMission}`);
      setEditMission(null);
    } catch (e: unknown) { toast(e instanceof Error ? e.message : "Save failed", false); }
    setSavingM(false);
  };

  const resetMission = async (missionId: string) => {
    try {
      await adminFetch("/api/admin/mission-overrides", token, { method: "DELETE", body: JSON.stringify({ missionId }) });
      setOverrides((p) => { const n = { ...p }; delete n[missionId]; return n; });
      toast("Mission reset to default");
    } catch (e: unknown) { toast(e instanceof Error ? e.message : "Failed", false); }
  };

  const catColor: Record<string, string> = { onboarding: C.green, social: C.purple, onchain: C.gold, community: "#F5A623" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

      {/* ── CONTRACT ADDRESSES ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "24px" }}>
        <div style={{ fontFamily: FONT, fontSize: "10px", color: C.gold, letterSpacing: "0.18em", marginBottom: "20px" }}>⟦ CONTRACT ADDRESSES ⟧</div>
        <p style={{ fontFamily: FONT, fontSize: "11px", color: C.muted, marginBottom: "20px", lineHeight: 1.7 }}>
          Update contract addresses here — the app reads from Firestore at runtime, no redeploy needed.
        </p>

        <Label>OTTER TOKEN CONTRACT (Sepolia)</Label>
        <input value={contracts.otterContract} onChange={(e) => setContracts({ ...contracts, otterContract: e.target.value })}
          placeholder="0x…" style={inputStyle} />

        <Label>INITIATION CONTRACT (Sepolia)</Label>
        <input value={contracts.initiationContract} onChange={(e) => setContracts({ ...contracts, initiationContract: e.target.value })}
          placeholder="0x…" style={inputStyle} />

        <Label>NETWORK</Label>
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          {["sepolia", "mainnet"].map((n) => (
            <button key={n} onClick={() => setContracts({ ...contracts, network: n })}
              style={{ fontFamily: FONT, fontSize: "10px", fontWeight: 700, padding: "6px 18px", borderRadius: "6px", cursor: "pointer", border: "none", letterSpacing: "0.08em",
                background: contracts.network === n ? (n === "mainnet" ? C.gold : C.green) : C.border,
                color: contracts.network === n ? "#000" : C.muted,
              }}>
              {n.toUpperCase()}
            </button>
          ))}
        </div>

        <AdminBtn variant="gold" onClick={saveContracts} disabled={savingC}>
          {savingC ? "SAVING…" : "SAVE CONTRACT ADDRESSES"}
        </AdminBtn>
      </div>

      {/* ── SOCIAL LINKS ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "24px" }}>
        <div style={{ fontFamily: FONT, fontSize: "10px", color: C.gold, letterSpacing: "0.18em", marginBottom: "20px" }}>⟦ SOCIAL LINKS ⟧</div>

        {[
          { key: "twitter",  label: "TWITTER / X" },
          { key: "discord",  label: "DISCORD INVITE" },
          { key: "medium",   label: "MEDIUM BLOG" },
          { key: "telegram", label: "TELEGRAM CHANNEL" },
          { key: "website",  label: "WEBSITE" },
        ].map(({ key, label }) => (
          <div key={key}>
            <Label>{label}</Label>
            <input value={(social as Record<string, string>)[key] ?? ""} onChange={(e) => setSocial({ ...social, [key]: e.target.value })}
              placeholder="https://…" style={inputStyle} />
          </div>
        ))}

        <div style={{ marginTop: "16px" }}>
          <AdminBtn variant="gold" onClick={saveSocial} disabled={savingS}>
            {savingS ? "SAVING…" : "SAVE SOCIAL LINKS"}
          </AdminBtn>
        </div>
      </div>

      {/* ── MISSION OVERRIDES ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "24px" }}>
        <div style={{ fontFamily: FONT, fontSize: "10px", color: C.gold, letterSpacing: "0.18em", marginBottom: "8px" }}>⟦ MISSION DEFINITIONS ⟧</div>
        <p style={{ fontFamily: FONT, fontSize: "11px", color: C.muted, marginBottom: "20px", lineHeight: 1.7 }}>
          Edit mission titles, descriptions, point values, links, or disable missions entirely.
          Overridden fields are shown in gold. Reset restores the default.
        </p>

        {loadingM ? <Spinner /> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "10px" }}>
            {MISSIONS.map((m) => {
              const ov = overrides[m.id];
              const isOverridden = !!ov;
              const isDisabled   = ov?.active === false;
              return (
                <div key={m.id} style={{
                  background: C.cardH, border: `1px solid ${isDisabled ? C.red + "40" : isOverridden ? C.gold + "30" : C.border}`,
                  borderRadius: "8px", padding: "14px", opacity: isDisabled ? 0.6 : 1,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <span style={{ fontFamily: FONT, fontSize: "11px", fontWeight: 700, color: isOverridden ? C.gold : C.text, flex: 1, letterSpacing: "0.04em" }}>
                      {ov?.title ?? m.title}
                    </span>
                    <Tag color={catColor[m.category] || C.muted}>{m.category.slice(0, 4).toUpperCase()}</Tag>
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: "10px", color: C.muted, marginBottom: "10px", lineHeight: 1.6 }}>
                    {ov?.desc ?? m.desc}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--font-geist-mono,monospace)", fontSize: "11px", color: isOverridden ? C.gold : C.mutedL, fontWeight: 700 }}>
                      +{ov?.points ?? m.points} pts
                      {isDisabled && <span style={{ color: C.red, marginLeft: "8px" }}>DISABLED</span>}
                    </span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {isOverridden && (
                        <AdminBtn small variant="ghost" onClick={() => resetMission(m.id)}>RESET</AdminBtn>
                      )}
                      <AdminBtn small variant="outline" onClick={() => openMissionEdit(m)}>EDIT</AdminBtn>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MISSION EDIT MODAL ── */}
      {editMission && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditMission(null); }}>
          <div style={{ background: "#0D0B07", border: `1px solid ${C.gold}40`, borderRadius: "14px", padding: "28px", width: "100%", maxWidth: "520px" }}>
            <div style={{ fontFamily: FONT, fontSize: "11px", color: C.gold, letterSpacing: "0.18em", marginBottom: "20px" }}>
              EDIT MISSION — {editMission.toUpperCase()}
            </div>

            <Label>TITLE</Label>
            <input value={editFields.title} onChange={(e) => setEditFields({ ...editFields, title: e.target.value })} style={inputStyle} />

            <Label>DESCRIPTION</Label>
            <textarea value={editFields.desc} onChange={(e) => setEditFields({ ...editFields, desc: e.target.value })} rows={3}
              style={{ ...inputStyle, resize: "vertical", height: "auto" }} />

            <Label>LINK (optional)</Label>
            <input value={editFields.link} onChange={(e) => setEditFields({ ...editFields, link: e.target.value })} placeholder="https://…" style={inputStyle} />

            <Label>POINTS</Label>
            <input type="number" value={editFields.points} onChange={(e) => setEditFields({ ...editFields, points: Number(e.target.value) })} style={inputStyle} />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: `1px solid ${C.border}`, marginBottom: "20px" }}>
              <span style={{ fontFamily: FONT, fontSize: "12px", color: C.text }}>Mission Active</span>
              <button onClick={() => setEditFields({ ...editFields, active: !editFields.active })}
                style={{ width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer",
                  background: editFields.active ? C.green : C.border, position: "relative", transition: "background 0.2s" }}>
                <div style={{ position: "absolute", top: "3px", left: editFields.active ? "23px" : "3px",
                  width: "18px", height: "18px", borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
              </button>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <AdminBtn variant="gold" onClick={saveMissionEdit} disabled={savingM}>
                {savingM ? "SAVING…" : "SAVE CHANGES"}
              </AdminBtn>
              <AdminBtn variant="outline" onClick={() => setEditMission(null)}>CANCEL</AdminBtn>
            </div>
          </div>
        </div>
      )}
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
