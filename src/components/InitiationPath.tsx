"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useInitiation } from "@/context/InitiationContext";

// ─── Design tokens (match existing palette exactly) ───────────────────────────
const C = {
  black:  "#000000",
  card:   "#0D0B07",
  border: "#1E1A10",
  gold:   "#C9A84C",
  goldL:  "#E2BF6E",
  green:  "#00C896",
  text:   "#E8DFC8",
  muted:  "#5C4A2A",
  mutedH: "#8C7A5C",
};
const FONT = "var(--font-cinzel, Georgia, serif)";
const MONO = "var(--font-geist-mono, monospace)";

const STAGES = [
  {
    num:   "I",
    key:   "gate_passed",
    label: "GATE",
    title: "CRACK THE GATE",
    desc:  "Three fragments. Three platforms. One password.",
    path:  "/",
    icon:  "◈",
    whereAmI: "Stage I: The cipher gate. This is how you entered. Proves you found the community.",
  },
  {
    num:   "II",
    key:   "sigil_claimed",
    label: "SIGIL",
    title: "CLAIM THE SIGIL",
    desc:  "Link your wallet. Mint your mark. It costs nothing.",
    path:  "/initiation",
    icon:  "◆",
    whereAmI: "Stage II: Mint a free soulbound badge — permanently yours, can't be sold or moved. Gas only.",
  },
  {
    num:   "III",
    key:   "contribution_done",
    label: "CONTRIBUTION",
    title: "FIRST CONTRIBUTION",
    desc:  "Vote on three memes, or submit your own.",
    path:  "/dapp?tab=memes",
    icon:  "▲",
    whereAmI: "Stage III: Participate in the Meme Arena. Vote 3 times or submit your own meme.",
  },
  {
    num:   "IV",
    key:   "referral_done",
    label: "RECRUIT",
    title: "RECRUIT ONE OTTER",
    desc:  "Bring one through the gate. Initiation complete.",
    path:  "/initiation#recruit",
    icon:  "⟳",
    whereAmI: "Stage IV: Share your referral link. One verified recruit completes your initiation.",
  },
] as const;

type StageKey = typeof STAGES[number]["key"];

interface Props {
  variant?: "compact" | "full";
}

export default function InitiationPath({ variant = "full" }: Props) {
  const router = useRouter();
  const initiation = useInitiation();
  const [tooltip, setTooltip] = useState<string | null>(null);

  const isComplete = (key: StageKey) => initiation[key];
  const isActive   = (index: number) => {
    const completedCount = STAGES.filter(s => initiation[s.key]).length;
    return index === completedCount;
  };
  const isLocked   = (index: number) => {
    const completedCount = STAGES.filter(s => initiation[s.key]).length;
    return index > completedCount;
  };

  if (variant === "compact") {
    return (
      <div
        role="navigation"
        aria-label="Initiation Path progress"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0",
          padding: "10px 0",
        }}
      >
        <style>{`
          @keyframes pulse-gold {
            0%,100% { box-shadow: 0 0 0 0 rgba(201,168,76,0.4); }
            50%      { box-shadow: 0 0 0 6px rgba(201,168,76,0); }
          }
        `}</style>
        {STAGES.map((stage, i) => {
          const done   = isComplete(stage.key);
          const active = isActive(i);
          const locked = isLocked(i);
          const isLast = i === STAGES.length - 1;

          const markerBorder = done   ? C.green
                             : active ? C.gold
                             : C.border;
          const markerColor  = done   ? C.green
                             : active ? C.gold
                             : C.muted;
          const markerBg     = done   ? "rgba(0,200,150,0.08)"
                             : active ? "rgba(201,168,76,0.08)"
                             : C.black;

          return (
            <div key={stage.key} style={{ display: "flex", alignItems: "center", flex: isLast ? "0 0 auto" : "1 0 auto" }}>
              <button
                aria-current={active ? "step" : undefined}
                aria-label={`${stage.title}${done ? " — complete" : active ? " — active" : " — locked"}`}
                title={locked ? `COMPLETE STAGE ${STAGES[i-1]?.num || "I"} FIRST` : stage.whereAmI}
                onClick={() => {
                  if (!locked) router.push(stage.path);
                }}
                style={{
                  width: "28px", height: "28px",
                  borderRadius: "6px",
                  border: `1.5px solid ${markerBorder}`,
                  background: markerBg,
                  color: markerColor,
                  fontSize: "10px",
                  fontFamily: MONO,
                  fontWeight: 700,
                  cursor: locked ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.2s",
                  animation: active ? "pulse-gold 2.5s ease-in-out infinite" : "none",
                  outline: "none",
                  flexShrink: 0,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline = `2px solid ${C.gold}`;
                  e.currentTarget.style.outlineOffset = "2px";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = "none";
                }}
              >
                {done ? "✓" : locked ? "🔒" : stage.num}
              </button>
              {!isLast && (
                <div style={{
                  flex: 1,
                  height: "1px",
                  background: done
                    ? `linear-gradient(90deg, ${C.green}, rgba(0,200,150,0.3))`
                    : C.border,
                  transition: "background 0.4s",
                  minWidth: "8px",
                }} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Full variant ──────────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%" }}>
      <style>{`
        @keyframes pulse-gold {
          0%,100% { box-shadow: 0 0 0 0 rgba(201,168,76,0.45); }
          50%      { box-shadow: 0 0 0 8px rgba(201,168,76,0); }
        }
        @keyframes slide-up {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .stage-marker:focus { outline: 2px solid ${C.gold}; outline-offset: 3px; }
      `}</style>

      {/* ── Horizontal connector row ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        marginBottom: "32px",
        gap: "0",
        overflowX: "auto",
        paddingBottom: "4px",
      }}>
        {STAGES.map((stage, i) => {
          const done   = isComplete(stage.key);
          const active = isActive(i);
          const locked = isLocked(i);
          const isLast = i === STAGES.length - 1;

          const markerBorder = done   ? C.green
                             : active ? C.gold
                             : C.border;
          const markerColor  = done   ? C.green
                             : active ? C.gold
                             : C.muted;
          const markerBg     = done   ? "rgba(0,200,150,0.08)"
                             : active ? "rgba(201,168,76,0.06)"
                             : C.black;
          const labelColor   = done   ? C.green
                             : active ? C.goldL
                             : C.muted;

          return (
            <div
              key={stage.key}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                flex: isLast ? "0 0 auto" : "1 0 auto",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                <button
                  className="stage-marker"
                  aria-current={active ? "step" : undefined}
                  aria-label={`${stage.title}${done ? " — complete" : active ? " — active" : " — locked"}`}
                  title={locked ? `COMPLETE STAGE ${STAGES[i-1]?.num} FIRST` : stage.whereAmI}
                  onClick={() => {
                    if (!locked) router.push(stage.path);
                    else setTooltip(stage.key === tooltip ? null : stage.key);
                  }}
                  style={{
                    width: "48px", height: "48px",
                    minWidth: "48px",
                    borderRadius: "8px",
                    border: `1.5px solid ${markerBorder}`,
                    background: markerBg,
                    color: markerColor,
                    fontSize: "15px",
                    fontFamily: MONO,
                    fontWeight: 700,
                    cursor: locked ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.25s",
                    animation: active ? "pulse-gold 2.5s ease-in-out infinite" : "none",
                    boxShadow: active ? `0 0 0 1px rgba(201,168,76,0.2), 0 0 20px rgba(201,168,76,0.1)` : "none",
                  }}
                >
                  {done ? "✓" : locked ? "⌀" : stage.num}
                </button>
                {!isLast && (
                  <div style={{
                    flex: 1,
                    height: "1px",
                    background: done
                      ? `linear-gradient(90deg, ${C.green}, rgba(0,200,150,0.25))`
                      : C.border,
                    transition: "background 0.5s",
                    minWidth: "12px",
                  }} />
                )}
              </div>
              <div style={{
                marginTop: "8px",
                fontSize: "clamp(8px,1.5vw,9px)",
                fontFamily: FONT,
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: labelColor,
                textAlign: "center",
                whiteSpace: "nowrap",
              }}>
                {stage.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Locked tooltip ── */}
      {tooltip && (
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "6px",
          padding: "10px 16px",
          marginBottom: "16px",
          fontSize: "10px",
          fontFamily: MONO,
          color: C.mutedH,
          letterSpacing: "0.06em",
          animation: "slide-up 0.25s ease",
        }}>
          {STAGES.find(s => s.key === tooltip)?.whereAmI}
        </div>
      )}
    </div>
  );
}
