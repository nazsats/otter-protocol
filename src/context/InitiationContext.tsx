"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/hooks/useWallet";

// OTTERSigil contract — set after deploy
const SIGIL_CONTRACT = process.env.NEXT_PUBLIC_SIGIL_CONTRACT || null;
const SIGIL_ABI = ["function balanceOf(address) view returns (uint256)"];

export interface InitiationState {
  gate_passed: boolean;
  sigil_claimed: boolean;
  contribution_done: boolean;
  referral_done: boolean;
  currentStage: 1 | 2 | 3 | 4;
  percentComplete: 0 | 25 | 50 | 75 | 100;
  isInitiated: boolean;
  setGatePassed: () => void;
  refresh: () => void;
}

const InitiationContext = createContext<InitiationState | null>(null);

export function InitiationProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();

  const [gate_passed,       setGatePassedState]   = useState(false);
  const [sigil_claimed,     setSigilClaimed]       = useState(false);
  const [contribution_done] = useState(false); // wired in Prompt 3
  const [referral_done]     = useState(false); // wired in Prompt 4

  // Restore gate from localStorage (survives page reload)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("otter_gate_passed") === "true") {
      setGatePassedState(true);
    }
  }, []);

  // Check sigil on-chain whenever wallet or contract changes
  const checkSigil = () => {
    if (!wallet.address || !SIGIL_CONTRACT) return;
    const provider = wallet.getProvider?.();
    if (!provider) return;
    const contract = new ethers.Contract(SIGIL_CONTRACT, SIGIL_ABI, provider);
    contract
      .balanceOf(wallet.address)
      .then((bal: bigint) => setSigilClaimed(BigInt(bal) > BigInt(0)))
      .catch(() => {});
  };

  useEffect(() => {
    checkSigil();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.address, SIGIL_CONTRACT]);

  const setGatePassed = () => {
    setGatePassedState(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("otter_gate_passed", "true");
    }
  };

  // Derive stage + progress
  const stages = [gate_passed, sigil_claimed, contribution_done, referral_done];
  const completedCount = stages.filter(Boolean).length;
  const currentStage = Math.min(completedCount + 1, 4) as 1 | 2 | 3 | 4;
  const percentComplete = (completedCount * 25) as 0 | 25 | 50 | 75 | 100;
  const isInitiated = stages.every(Boolean);

  return (
    <InitiationContext.Provider value={{
      gate_passed, sigil_claimed, contribution_done, referral_done,
      currentStage, percentComplete, isInitiated,
      setGatePassed,
      refresh: checkSigil,
    }}>
      {children}
    </InitiationContext.Provider>
  );
}

export function useInitiation() {
  const ctx = useContext(InitiationContext);
  if (!ctx) throw new Error("useInitiation must be inside <InitiationProvider>");
  return ctx;
}
