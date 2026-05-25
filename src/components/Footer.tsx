import Link from "next/link";

const C = { gold: "#C9A84C", border: "#1E1A10", muted: "#8C7A5C", text: "#E8DFC8" };

export default function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, background: "#000", padding: "60px 24px 32px" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr repeat(3, 1fr)", gap: "48px", marginBottom: "48px" }} className="footer-grid">

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "linear-gradient(135deg, #C9A84C, #E2BF6E)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontWeight: 900, fontSize: "10px", color: "#000", fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.05em" }}>OT</span>
              </div>
              <span style={{ fontFamily: "var(--font-cinzel, serif)", fontWeight: 900, fontSize: "13px", letterSpacing: "0.1em", background: "linear-gradient(135deg, #C9A84C, #E2BF6E)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                OTTER PROTOCOL
              </span>
            </div>
            <p style={{ fontFamily: "var(--font-cinzel, serif)", color: C.muted, fontSize: "12px", lineHeight: 1.9, maxWidth: "260px", marginBottom: "20px", letterSpacing: "0.02em" }}>
              Building the community-owned meme token standard on Ethereum. A Raft of builders.
            </p>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)",
              borderRadius: "20px", padding: "4px 12px",
            }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#F5A623", display: "inline-block" }} />
              <span style={{ fontFamily: "var(--font-cinzel, serif)", color: C.gold, fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em" }}>⟦ EIP DRAFT ⟧</span>
            </div>
          </div>

          {[
            { title: "Protocol", links: [{ l: "EIP Proposal", h: "/eip" }, { l: "Tokenomics", h: "#tokenomics" }, { l: "Smart Contract", h: "#" }, { l: "Security Audit", h: "#" }] },
            { title: "Community", links: [{ l: "Join the Raft", h: "#community" }, { l: "Twitter / X", h: "#" }, { l: "Medium Blog", h: "#" }, { l: "GitHub", h: "#" }] },
            { title: "Resources", links: [{ l: "Whitepaper", h: "#" }, { l: "Brand Kit", h: "#" }, { l: "FAQ", h: "#" }, { l: "Contact", h: "#" }] },
          ].map((col) => (
            <div key={col.title}>
              <h4 style={{ fontFamily: "var(--font-cinzel, serif)", color: C.text, fontWeight: 700, marginBottom: "16px", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                {col.title}
              </h4>
              {col.links.map((item) => (
                <Link key={item.l} href={item.h}
                  style={{ fontFamily: "var(--font-cinzel, serif)", display: "block", color: C.muted, textDecoration: "none", fontSize: "12px", marginBottom: "10px", transition: "color 0.15s", letterSpacing: "0.04em" }}
                  onMouseEnter={(e) => ((e.target as HTMLAnchorElement).style.color = C.text)}
                  onMouseLeave={(e) => ((e.target as HTMLAnchorElement).style.color = C.muted)}
                >
                  {item.l}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <p style={{ fontFamily: "var(--font-cinzel, serif)", color: C.muted, fontSize: "11px", letterSpacing: "0.06em" }}>© 2025 OTTER Protocol. Building on Ethereum.</p>
          <p style={{ fontFamily: "var(--font-cinzel, serif)", color: C.muted, fontSize: "11px", letterSpacing: "0.06em" }}>CC0 — No rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
