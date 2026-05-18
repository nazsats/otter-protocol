"use client";
import Link from "next/link";
import { useState } from "react";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: "rgba(10, 14, 26, 0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(30, 42, 58, 0.8)",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "68px",
          }}
        >
          {/* Logo */}
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #00D4AA, #7B61FF)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
              }}
            >
              🦦
            </div>
            <span
              style={{
                fontWeight: 700,
                fontSize: "18px",
                background: "linear-gradient(135deg, #00D4AA 0%, #7B61FF 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              OTTER Protocol
            </span>
          </Link>

          {/* Desktop Nav */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "32px",
            }}
            className="hidden md:flex"
          >
            {[
              { label: "About", href: "#about" },
              { label: "EIP Proposal", href: "#eip" },
              { label: "Tokenomics", href: "#tokenomics" },
              { label: "Roadmap", href: "#roadmap" },
              { label: "The Raft", href: "#community" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                style={{
                  color: "#8A95A8",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: 500,
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => ((e.target as HTMLAnchorElement).style.color = "#00D4AA")}
                onMouseLeave={(e) => ((e.target as HTMLAnchorElement).style.color = "#8A95A8")}
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* CTA Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }} className="hidden md:flex">
            <a
              href="/eip"
              style={{
                color: "#00D4AA",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: 500,
                border: "1px solid rgba(0,212,170,0.3)",
                padding: "8px 16px",
                borderRadius: "8px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                const el = e.target as HTMLAnchorElement;
                el.style.background = "rgba(0,212,170,0.1)";
              }}
              onMouseLeave={(e) => {
                const el = e.target as HTMLAnchorElement;
                el.style.background = "transparent";
              }}
            >
              Read EIP
            </a>
            <a
              href="#community"
              style={{
                background: "linear-gradient(135deg, #00D4AA, #7B61FF)",
                color: "#fff",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: 600,
                padding: "8px 20px",
                borderRadius: "8px",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => ((e.target as HTMLAnchorElement).style.opacity = "0.85")}
              onMouseLeave={(e) => ((e.target as HTMLAnchorElement).style.opacity = "1")}
            >
              Join the Raft
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setOpen(!open)}
            style={{
              background: "none",
              border: "none",
              color: "#E8EDF5",
              cursor: "pointer",
              fontSize: "22px",
              padding: "4px",
            }}
            className="md:hidden"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile Menu */}
        {open && (
          <div
            style={{
              borderTop: "1px solid rgba(30,42,58,0.8)",
              paddingBottom: "16px",
            }}
            className="md:hidden"
          >
            {[
              { label: "About", href: "#about" },
              { label: "EIP Proposal", href: "#eip" },
              { label: "Tokenomics", href: "#tokenomics" },
              { label: "Roadmap", href: "#roadmap" },
              { label: "The Raft", href: "#community" },
              { label: "Read EIP →", href: "/eip" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                style={{
                  display: "block",
                  padding: "12px 0",
                  color: "#8A95A8",
                  textDecoration: "none",
                  fontSize: "15px",
                  borderBottom: "1px solid rgba(30,42,58,0.4)",
                }}
              >
                {item.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
