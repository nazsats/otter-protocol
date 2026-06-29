"use client";
import { createContext, useContext, useState, useCallback, useRef, useMemo, ReactNode } from "react";

/**
 * Global celebration confetti. Any component can fire a burst via
 * `useCelebration().celebrate()` — e.g. when a task is completed, a spin is won,
 * or the welcome bonus is claimed. Dependency-free: pure CSS-animated pieces
 * rendered in a fixed, pointer-events-none overlay, auto-cleaned after the run.
 */
interface CelebrationCtx { celebrate: (intensity?: number) => void; }
const Ctx = createContext<CelebrationCtx | null>(null);

const COLORS = ["#C9A84C", "#E2BF6E", "#F4DC8A", "#00C896", "#34E0B0", "#FFFFFF"];

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [bursts, setBursts] = useState<{ id: number; count: number }[]>([]);
  const idRef = useRef(0);

  const celebrate = useCallback((intensity = 1) => {
    const id = ++idRef.current;
    const count = Math.min(160, Math.round(70 * intensity));
    setBursts((b) => [...b, { id, count }]);
    // Pieces finish within ~2.8s; remove the burst afterwards.
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 3000);
  }, []);

  return (
    <Ctx.Provider value={{ celebrate }}>
      {children}
      <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 10000, overflow: "hidden" }}>
        {bursts.map((b) => <ConfettiBurst key={b.id} count={b.count} />)}
      </div>
    </Ctx.Provider>
  );
}

function ConfettiBurst({ count }: { count: number }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => {
    const fromCenter = (Math.random() - 0.5) * 28;   // start spread around center-top (%)
    return {
      i,
      left:  50 + fromCenter,
      dx:    (Math.random() - 0.5) * 90,              // horizontal drift (vw)
      rot:   Math.random() * 900 - 450,               // total rotation (deg)
      delay: Math.random() * 0.18,                    // s
      dur:   1.9 + Math.random() * 1.1,               // s
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      w:     6 + Math.random() * 7,
      h:     8 + Math.random() * 8,
      round: Math.random() > 0.55,
    };
  }), [count]);

  return (
    <>
      {pieces.map((p) => (
        <span
          key={p.i}
          style={{
            position: "absolute", top: "-24px", left: `${p.left}%`,
            width: `${p.w}px`, height: `${p.h}px`,
            background: p.color,
            borderRadius: p.round ? "50%" : "2px",
            opacity: 0,
            // per-piece custom props consumed by the @keyframes in globals.css
            ["--cf-dx" as string]:  `${p.dx}vw`,
            ["--cf-rot" as string]: `${p.rot}deg`,
            animation: `confetti-fall ${p.dur}s cubic-bezier(.18,.7,.4,1) ${p.delay}s forwards`,
            willChange: "transform, opacity",
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}

/** Returns a no-op celebrate() if used outside the provider (safe to call anywhere). */
export function useCelebration(): CelebrationCtx {
  return useContext(Ctx) ?? { celebrate: () => {} };
}
