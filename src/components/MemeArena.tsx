"use client";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useToast } from "@/context/ToastContext";
import { authFetch } from "@/lib/api";
import {
  Flame, ThumbsUp, ThumbsDown, Trophy, Clock, Image as ImageIcon,
  Send, RefreshCw, ExternalLink, Zap, AlertTriangle, Lock,
} from "lucide-react";

const C = {
  black: "#000", card: "#111", card2: "#0D0D0D", border: "#1F1F1F",
  gold: "#C9A84C", goldL: "#E2BF6E", text: "#E8E8E8",
  muted: "#5C5C5C", mutedH: "#888",
  green: "#00C896", red: "#FF4545", purple: "#A78BFA",
};

const MEME_ABI = [
  "function submitMeme(bytes32 contentHash) returns (uint256)",
  "function voteOnMeme(uint256 memeId, bool upvote)",
  "function currentEpoch() view returns (uint256)",
  "function holderTier(address) view returns (uint8)",
];

const MEME_SUBMITTED_EVENT =
  "event MemeSubmitted(address indexed creator, bytes32 contentHash, uint256 indexed memeId, uint256 epoch)";

export interface MemeDoc {
  id:          string;
  memeId:      string;
  title:       string;
  imageUrl:    string;
  creator:     string;
  creatorName: string;
  epoch:       number;
  score:       number;
  upvotes:     number;
  downvotes:   number;
  txHash:      string;
  submittedAt: number;
}

interface Props {
  uid:            string | undefined;
  walletAddress:  string | null | undefined;
  isConnected:    boolean;
  isCorrectNetwork: boolean;
  getProvider:    () => ethers.BrowserProvider | null;
  getSigner:      () => Promise<ethers.JsonRpcSigner | null>;
  contractAddress: string | null;
}

type SubView = "gallery" | "submit";

export default function MemeArena({
  uid, walletAddress, isConnected, isCorrectNetwork,
  getProvider, getSigner, contractAddress,
}: Props) {
  const toast = useToast();

  const [subView,   setSubView]   = useState<SubView>("gallery");
  const [memes,     setMemes]     = useState<MemeDoc[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [epoch,     setEpoch]     = useState<number | null>(null);
  const [userTier,  setUserTier]  = useState<number>(0); // 0=NEWCOMER, 1=MEMBER, 2=OG
  const [userVotes, setUserVotes] = useState<Record<string, "up" | "down">>({});
  const [voting,    setVoting]    = useState<Record<string, boolean>>({});

  // Submit form
  const [imageUrl, setImageUrl] = useState("");
  const [title,    setTitle]    = useState("");
  const [preview,  setPreview]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastTx,   setLastTx]   = useState<string | null>(null);

  // ── Fetch memes from API ─────────────────────────────────────────────────
  const fetchMemes = useCallback(async (ep?: number) => {
    setLoading(true);
    try {
      const q = ep !== undefined ? `?epoch=${ep}` : "";
      const res = await fetch(`/api/meme/list${q}`);
      if (res.ok) {
        const data = await res.json();
        setMemes(data.memes ?? []);
        if (data.epoch !== undefined && ep === undefined) setEpoch(data.epoch);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  // ── Read current epoch + user tier from chain ───────────────────────────
  const fetchChainData = useCallback(async () => {
    if (!contractAddress || !getProvider()) return;
    try {
      const provider = getProvider()!;
      const contract = new ethers.Contract(contractAddress, MEME_ABI, provider);
      const ep = await contract.currentEpoch();
      setEpoch(Number(ep));
      if (walletAddress) {
        const tier = await contract.holderTier(walletAddress);
        setUserTier(Number(tier));
      }
    } catch { /* silent */ }
  }, [contractAddress, getProvider, walletAddress]);

  // ── Fetch user's existing votes ──────────────────────────────────────────
  const fetchUserVotes = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`/api/meme/votes?voter=${walletAddress}`);
      if (res.ok) {
        const data = await res.json();
        setUserVotes(data.votes ?? {});
      }
    } catch { /* silent */ }
  }, [walletAddress]);

  useEffect(() => {
    fetchChainData();
    fetchMemes();
    fetchUserVotes();
  }, [fetchChainData, fetchMemes, fetchUserVotes]);

  // ── Submit meme on-chain + record in Firestore ───────────────────────────
  const handleSubmit = async () => {
    if (!title.trim())     { toast("Enter a caption/title", "error"); return; }
    if (!imageUrl.trim())  { toast("Enter an image URL", "error"); return; }
    if (!contractAddress)  { toast("Contract not configured", "error"); return; }
    if (!isConnected || !isCorrectNetwork) { toast("Connect wallet to Sepolia first", "error"); return; }
    if (!uid || !walletAddress) { toast("Sign in first", "error"); return; }
    if (userTier < 1) {
      toast("MEMBER tier required to submit memes (hold OTTER 30+ days)", "error");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Compute content hash from metadata
      const contentData = JSON.stringify({ title: title.trim(), imageUrl: imageUrl.trim(), creator: walletAddress });
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes(contentData));

      // 2. Submit on-chain
      const signer   = await getSigner();
      if (!signer) throw new Error("No signer");
      const contract = new ethers.Contract(contractAddress, MEME_ABI, signer);
      const tx       = await contract.submitMeme(contentHash);
      toast("Meme submitted to chain — waiting for confirmation…", "info");
      const receipt  = await tx.wait();
      setLastTx(tx.hash);

      // 3. Parse MemeSubmitted event to get memeId
      const iface = new ethers.Interface([MEME_SUBMITTED_EVENT]);
      let memeId = "0";
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
          if (parsed?.name === "MemeSubmitted") {
            memeId = parsed.args.memeId.toString();
            break;
          }
        } catch { /* not our event */ }
      }

      // 4. Record in Firestore via API
      const res = await authFetch("/api/meme/submit", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          memeId, contentHash, title: title.trim(),
          imageUrl: imageUrl.trim(),
          creator: walletAddress, uid,
          epoch: epoch ?? 0, txHash: tx.hash,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Record failed");
      }

      toast("Meme submitted successfully!", "success");
      setTitle(""); setImageUrl(""); setPreview(false);
      setSubView("gallery");
      fetchMemes();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Submission failed";
      toast(msg.includes("rejected") ? "Transaction cancelled" : msg.slice(0, 80), "error");
    }
    setSubmitting(false);
  };

  // ── Vote on meme on-chain + record in Firestore ──────────────────────────
  const handleVote = async (memeId: string, upvote: boolean) => {
    if (!contractAddress)  { toast("Contract not configured", "error"); return; }
    if (!isConnected || !isCorrectNetwork) { toast("Connect wallet to Sepolia first", "error"); return; }
    if (!uid || !walletAddress) { toast("Sign in first", "error"); return; }
    if (userVotes[memeId])     { toast("Already voted on this meme", "info"); return; }

    setVoting((v) => ({ ...v, [memeId]: true }));
    try {
      const signer   = await getSigner();
      if (!signer) throw new Error("No signer");
      const contract = new ethers.Contract(contractAddress, MEME_ABI, signer);
      const tx       = await contract.voteOnMeme(BigInt(memeId), upvote);
      toast(`Vote submitted — waiting for confirmation…`, "info");
      await tx.wait();

      // Record in Firestore
      await authFetch("/api/meme/vote", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ memeId, voter: walletAddress, upvote, txHash: tx.hash, uid }),
      });

      setUserVotes((v) => ({ ...v, [memeId]: upvote ? "up" : "down" }));
      setMemes((ms) => ms.map((m) =>
        m.memeId === memeId
          ? { ...m, score: m.score + (upvote ? 1 : -1), upvotes: upvote ? m.upvotes + 1 : m.upvotes, downvotes: !upvote ? m.downvotes + 1 : m.downvotes }
          : m
      ));
      toast(`Vote recorded on-chain!`, "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Vote failed";
      toast(msg.includes("rejected") ? "Vote cancelled" : msg.slice(0, 80), "error");
    }
    setVoting((v) => ({ ...v, [memeId]: false }));
  };

  const canSubmit = userTier >= 1;
  const sortedMemes = [...memes].sort((a, b) => b.score - a.score);
  const top3 = sortedMemes.slice(0, 3);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* ── EPOCH HEADER ── */}
      <div className="season-pulse" style={{
        background: "linear-gradient(135deg, #0D0D0D 0%, #0A0A08 100%)",
        border: "1px solid rgba(201,168,76,0.18)", borderRadius: "16px", padding: "20px 24px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Flame size={16} color={C.gold} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "15px" }}>Meme Arena</div>
              <div style={{ color: C.muted, fontSize: "12px" }}>
                {epoch !== null ? `Epoch #${epoch} · ` : ""}
                Submit memes, vote on-chain, top 3 earn rewards
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{
              background: "rgba(0,200,150,0.08)", color: C.green,
              border: "1px solid rgba(0,200,150,0.2)", borderRadius: "20px",
              padding: "4px 12px", fontSize: "11px", fontWeight: 700,
            }}>
              LIVE · SEPOLIA
            </span>
            <button onClick={() => { fetchMemes(); fetchChainData(); }}
              style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: "8px", padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "11px" }}>
              <RefreshCw size={11} /> Refresh
            </button>
          </div>
        </div>

        {/* Rewards info strip */}
        <div style={{ marginTop: "14px", display: "flex", gap: "20px", flexWrap: "wrap" }}>
          {[
            { label: "Top 3 Creators", value: "Earn from rewards pool", color: C.gold },
            { label: "Epoch Duration", value: "7 days", color: C.purple },
            { label: "Memes This Epoch", value: String(memes.length), color: C.green },
          ].map((s) => (
            <div key={s.label} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: s.color }} />
              <span style={{ color: C.muted, fontSize: "11px" }}>{s.label}</span>
              <span style={{ color: s.color, fontSize: "11px", fontWeight: 700 }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── WALLET GATE ── */}
      {(!isConnected || !isCorrectNetwork) && (
        <div style={{ background: "rgba(201,168,76,0.04)", border: "1px solid rgba(201,168,76,0.12)", borderRadius: "12px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
          <AlertTriangle size={16} color={C.gold} />
          <span style={{ color: C.mutedH, fontSize: "13px" }}>Connect your wallet to Sepolia to submit and vote on memes.</span>
        </div>
      )}

      {/* ── SUB-TABS ── */}
      <div style={{ display: "flex", gap: "4px", background: C.card, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "4px" }}>
        {(["gallery", "submit"] as SubView[]).map((v) => (
          <button key={v} onClick={() => setSubView(v)}
            style={{ flex: 1, padding: "9px 8px", borderRadius: "7px", border: "none", background: subView === v ? "#1A1A1A" : "transparent", color: subView === v ? C.text : C.muted, fontSize: "12px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {v === "gallery" ? `Browse (${memes.length})` : "Submit Meme"}
          </button>
        ))}
      </div>

      {/* ═══ SUBMIT TAB ═══ */}
      {subView === "submit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* Tier requirement */}
          {!canSubmit && (
            <div style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: "12px", padding: "14px 18px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <Lock size={15} color={C.purple} style={{ flexShrink: 0, marginTop: "1px" }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: C.purple, marginBottom: "4px" }}>MEMBER Tier Required</div>
                <div style={{ color: C.muted, fontSize: "12px", lineHeight: 1.6 }}>
                  Hold OTTER for 30+ days on Sepolia to unlock meme submission. Your governance weight determines your vote&apos;s impact. You can still vote on memes below.
                </div>
              </div>
            </div>
          )}

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "24px", opacity: canSubmit ? 1 : 0.5, pointerEvents: canSubmit ? "auto" : "none" }}>
            <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
              <ImageIcon size={15} color={C.gold} /> Submit Meme to Epoch #{epoch ?? "—"}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Image URL */}
              <div>
                <div style={{ color: C.muted, fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", marginBottom: "6px" }}>IMAGE URL</div>
                <input
                  value={imageUrl}
                  onChange={(e) => { setImageUrl(e.target.value); setPreview(false); }}
                  placeholder="https://imgur.com/your-meme.png"
                  style={{ background: "#080808", border: `1px solid ${C.border}`, borderRadius: "8px", padding: "12px 14px", color: C.text, fontSize: "13px", outline: "none", width: "100%", boxSizing: "border-box" }}
                  onFocus={(e) => (e.target.style.borderColor = C.gold)}
                  onBlur={(e) => (e.target.style.borderColor = C.border)}
                />
                {imageUrl && (
                  <button onClick={() => setPreview(!preview)} style={{ background: "none", border: "none", color: C.gold, fontSize: "11px", cursor: "pointer", marginTop: "4px", padding: 0 }}>
                    {preview ? "Hide preview" : "Preview image"}
                  </button>
                )}
              </div>

              {/* Image preview */}
              {preview && imageUrl && (
                <div style={{ borderRadius: "10px", overflow: "hidden", border: `1px solid ${C.border}`, maxHeight: "240px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Preview" onError={() => setPreview(false)}
                    style={{ width: "100%", maxHeight: "240px", objectFit: "cover", display: "block" }} />
                </div>
              )}

              {/* Caption */}
              <div>
                <div style={{ color: C.muted, fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", marginBottom: "6px" }}>
                  CAPTION / TITLE <span style={{ color: title.length > 80 ? C.red : C.muted }}>({title.length}/100)</span>
                </div>
                <textarea
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                  placeholder="Write something degen…"
                  rows={2}
                  style={{ background: "#080808", border: `1px solid ${C.border}`, borderRadius: "8px", padding: "12px 14px", color: C.text, fontSize: "13px", outline: "none", width: "100%", boxSizing: "border-box", resize: "none", fontFamily: "inherit" }}
                  onFocus={(e) => (e.target.style.borderColor = C.gold)}
                  onBlur={(e) => (e.target.style.borderColor = C.border)}
                />
              </div>

              {/* Content hash preview */}
              {title && imageUrl && (
                <div style={{ background: "#060606", borderRadius: "8px", padding: "10px 12px", fontFamily: "monospace", fontSize: "10px", color: C.muted, wordBreak: "break-all" }}>
                  Content hash: {ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ title: title.trim(), imageUrl: imageUrl.trim(), creator: walletAddress ?? "" }))).slice(0, 18)}…
                </div>
              )}

              {/* Submit button */}
              <button
                onClick={handleSubmit}
                disabled={submitting || !title || !imageUrl || !isConnected || !isCorrectNetwork}
                style={{
                  background: !submitting && title && imageUrl && isConnected && isCorrectNetwork
                    ? "linear-gradient(135deg, #C9A84C, #E2BF6E)" : "#1A1A1A",
                  color: !submitting && title && imageUrl && isConnected && isCorrectNetwork ? "#000" : C.muted,
                  border: "none", borderRadius: "10px", padding: "13px 24px",
                  fontWeight: 700, fontSize: "13px", cursor: submitting ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  opacity: submitting ? 0.7 : 1, transition: "all 0.2s",
                }}
              >
                {submitting ? <><Spin />Submitting to Sepolia…</> : <><Send size={13} /> Submit Meme On-Chain</>}
              </button>

              {lastTx && (
                <a href={`https://sepolia.etherscan.io/tx/${lastTx}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: C.green, fontSize: "12px", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
                  Last tx: {lastTx.slice(0, 12)}… <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ GALLERY TAB ═══ */}
      {subView === "gallery" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Podium — top 3 */}
          {top3.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <Trophy size={15} color={C.gold} />
                <span style={{ fontWeight: 700, fontSize: "14px" }}>Top Memes This Epoch</span>
                <span style={{ color: C.muted, fontSize: "12px" }}>· Top 3 earn rewards at epoch end</span>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {top3.map((m, i) => (
                  <div key={m.memeId} style={{
                    flex: "1 1 140px", background: "#080808", borderRadius: "10px", overflow: "hidden",
                    border: `1px solid ${i === 0 ? "rgba(201,168,76,0.3)" : C.border}`,
                    position: "relative",
                  }}>
                    <div style={{ position: "absolute", top: "6px", left: "6px", zIndex: 1, fontSize: "14px" }}>
                      {["🥇", "🥈", "🥉"][i]}
                    </div>
                    {m.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.imageUrl} alt={m.title} style={{ width: "100%", height: "90px", objectFit: "cover", display: "block" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    )}
                    <div style={{ padding: "8px 10px" }}>
                      <div style={{ fontSize: "11px", color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</div>
                      <div style={{ fontSize: "10px", color: C.gold, fontWeight: 700, marginTop: "2px" }}>Score: {m.score > 0 ? "+" : ""}{m.score}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full gallery */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "48px", color: C.muted, fontSize: "13px" }}>
              <RefreshCw size={20} style={{ animation: "spin 0.8s linear infinite", marginBottom: "8px" }} />
              <div>Loading memes…</div>
            </div>
          ) : sortedMemes.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "48px", textAlign: "center" }}>
              <Flame size={32} color={C.gold} style={{ marginBottom: "12px", opacity: 0.5 }} />
              <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "6px" }}>No memes yet this epoch</div>
              <div style={{ color: C.muted, fontSize: "13px", marginBottom: "20px" }}>Be the first to submit a meme and earn rewards.</div>
              <button onClick={() => setSubView("submit")}
                style={{ background: "linear-gradient(135deg, #C9A84C, #E2BF6E)", color: "#000", border: "none", borderRadius: "10px", padding: "10px 24px", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>
                Submit First Meme
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
              {sortedMemes.map((meme, idx) => (
                <MemeCard
                  key={meme.memeId}
                  meme={meme}
                  rank={idx + 1}
                  userVote={userVotes[meme.memeId]}
                  voting={voting[meme.memeId] ?? false}
                  onVote={handleVote}
                  canVote={isConnected && isCorrectNetwork && !!uid}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Meme Card ────────────────────────────────────────────────────────────────
function MemeCard({
  meme, rank, userVote, voting, onVote, canVote,
}: {
  meme: MemeDoc;
  rank: number;
  userVote: "up" | "down" | undefined;
  voting: boolean;
  onVote: (id: string, upvote: boolean) => void;
  canVote: boolean;
}) {
  const rankColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
  const rankColor  = rank <= 3 ? rankColors[rank - 1] : C.muted;
  const scoreColor = meme.score > 0 ? C.green : meme.score < 0 ? C.red : C.muted;

  return (
    <div className="meme-appear" style={{
      background: C.card, border: `1px solid ${rank === 1 ? "rgba(201,168,76,0.25)" : C.border}`,
      borderRadius: "14px", overflow: "hidden",
      transition: "border-color 0.2s",
    }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(201,168,76,0.25)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = rank === 1 ? "rgba(201,168,76,0.25)" : C.border)}
    >
      {/* Image */}
      <div style={{ position: "relative", height: "160px", background: "#080808" }}>
        {meme.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={meme.imageUrl} alt={meme.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.background = "#111"; }} />
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={28} color={C.gold} style={{ opacity: 0.3 }} />
          </div>
        )}
        {/* Rank badge */}
        <div style={{
          position: "absolute", top: "8px", left: "8px",
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
          borderRadius: "6px", padding: "3px 8px",
          fontSize: "10px", fontWeight: 700, color: rankColor,
          letterSpacing: "0.06em",
        }}>
          #{rank}
        </div>
        {/* Score */}
        <div style={{
          position: "absolute", top: "8px", right: "8px",
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
          borderRadius: "6px", padding: "3px 8px",
          fontSize: "11px", fontWeight: 800, color: scoreColor,
        }}>
          {meme.score > 0 ? "+" : ""}{meme.score}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px" }}>
        <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "6px", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {meme.title}
        </div>
        <div style={{ color: C.muted, fontSize: "11px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
          <Clock size={10} />
          {meme.creatorName || `${meme.creator.slice(0, 6)}…${meme.creator.slice(-4)}`}
        </div>

        {/* Vote buttons */}
        <div style={{ display: "flex", gap: "6px" }}>
          <VoteBtn
            icon={<ThumbsUp size={12} />}
            count={meme.upvotes}
            active={userVote === "up"}
            activeColor={C.green}
            disabled={!canVote || voting || !!userVote}
            onClick={() => onVote(meme.memeId, true)}
          />
          <VoteBtn
            icon={<ThumbsDown size={12} />}
            count={meme.downvotes}
            active={userVote === "down"}
            activeColor={C.red}
            disabled={!canVote || voting || !!userVote}
            onClick={() => onVote(meme.memeId, false)}
          />
          {meme.txHash && (
            <a href={`https://sepolia.etherscan.io/tx/${meme.txHash}`}
              target="_blank" rel="noopener noreferrer"
              style={{ marginLeft: "auto", display: "flex", alignItems: "center", color: C.muted, textDecoration: "none" }}>
              <ExternalLink size={11} />
            </a>
          )}
        </div>
        {voting && (
          <div style={{ color: C.muted, fontSize: "10px", marginTop: "6px", textAlign: "center" }}>
            Broadcasting vote…
          </div>
        )}
      </div>
    </div>
  );
}

function VoteBtn({ icon, count, active, activeColor, disabled, onClick }: {
  icon: React.ReactNode; count: number; active: boolean;
  activeColor: string; disabled: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
        padding: "7px 10px", borderRadius: "7px", border: "none", cursor: disabled ? "not-allowed" : "pointer",
        background: active ? `${activeColor}18` : "#0A0A0A",
        color: active ? activeColor : C.muted,
        fontSize: "11px", fontWeight: active ? 700 : 400,
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => { if (!disabled && !active) e.currentTarget.style.background = "#161616"; }}
      onMouseLeave={(e) => { if (!disabled && !active) e.currentTarget.style.background = "#0A0A0A"; }}
    >
      {icon} {count}
    </button>
  );
}

function Spin() {
  return <span style={{ width: "12px", height: "12px", border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#000", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />;
}
