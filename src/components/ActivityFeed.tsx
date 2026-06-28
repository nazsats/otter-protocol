"use client";
import { useState, useEffect } from "react";
import { ExternalLink, Zap, Users, ArrowRight } from "lucide-react";
import { ActivityEntry } from "@/lib/missions";

const C = { card: "#111", border: "#1F1F1F", gold: "#C9A84C", text: "#E8E8E8", muted: "#5C5C5C", green: "#00C896", purple: "#A78BFA", orange: "#F5A623" };

const TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  join:         { label: "joined the Raft",     color: C.green,  icon: "🌊" },
  mission:      { label: "completed a mission", color: C.purple, icon: "⚡" },
  claim:        { label: "claimed OTTER",       color: C.gold,   icon: "🦦" },
  referral:     { label: "referred a friend",   color: C.orange, icon: "🤝" },
  transfer:     { label: "sent OTTER",          color: C.text,   icon: "➡️" },
  initiation:   { label: "earned signal",       color: C.gold,   icon: "◈" },
  admin_points: { label: "received points",     color: C.purple, icon: "✦" },
};

function timeAgo(seconds?: number): string {
  if (!seconds) return "just now";
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ActivityFeed() {
  const [feed,    setFeed]    = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res  = await fetch("/api/activity");
        const data = await res.json();
        setFeed(data.feed || []);
      } catch { setFeed([]); }
      setLoading(false);
    };
    load();
    // Refresh every 30s for "live" feel
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: C.green, animation: "pulse 2s ease-in-out infinite" }} />
          <span style={{ fontWeight: 700, fontSize: "15px" }}>Live Activity</span>
        </div>
        <span style={{ color: C.muted, fontSize: "12px" }}>updates every 30s</span>
      </div>

      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "32px" }}>
          <div style={{ width: "20px", height: "20px", border: "2px solid #1F1F1F", borderTopColor: C.gold, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      )}

      {!loading && feed.length === 0 && (
        <div style={{ textAlign: "center", color: C.muted, padding: "32px", fontSize: "13px" }}>
          No activity yet — be the first Rafter to claim OTTER!
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
        {feed.map((entry, i) => {
          const meta = TYPE_META[entry.type] || TYPE_META.claim;
          return (
            <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 0", borderBottom: i < feed.length - 1 ? `1px solid ${C.border}` : "none" }}>
              {/* Badge */}
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${meta.color}0A`, border: `1px solid ${meta.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "14px" }}>
                {entry.badge || meta.icon}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "13px", lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 700, color: meta.color }}>{entry.displayName || "A Rafter"}</span>
                  <span style={{ color: C.muted }}> {meta.label}</span>
                  {entry.mission && <span style={{ color: C.text }}> — <em style={{ fontStyle: "normal" }}>{entry.mission}</em></span>}
                </div>
                {entry.amount ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                    <Zap size={10} color={C.gold} />
                    <span style={{ color: C.gold, fontSize: "11px", fontWeight: 700 }}>+{entry.amount} OTTER</span>
                  </div>
                ) : entry.signal ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                    <Zap size={10} color={C.gold} />
                    <span style={{ color: C.gold, fontSize: "11px", fontWeight: 700 }}>+{entry.signal} SIGNAL</span>
                  </div>
                ) : null}
              </div>

              {/* Time + tx link */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
                <span style={{ color: C.muted, fontSize: "11px" }}>{timeAgo(entry.timestamp?.seconds)}</span>
                {entry.txHash && (
                  <a href={`https://sepolia.etherscan.io/tx/${entry.txHash}`} target="_blank" rel="noopener noreferrer"
                    style={{ color: C.muted, fontSize: "10px", textDecoration: "none", display: "flex", alignItems: "center", gap: "2px" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = C.gold)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}>
                    tx <ExternalLink size={9} />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
