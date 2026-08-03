"use client";

import { useState } from "react";

// Copy-for-WhatsApp per household. Builds the invite URL from the browser's
// own origin so it works on localhost, previews and production alike.
export default function HouseholdActions({ token, householdName, coupleName, phone }) {
  const [copied, setCopied] = useState(false);

  const link = () => `${window.location.origin}/i/${token}`;
  const message = () =>
    `You are warmly invited to the wedding of ${coupleName}. ${householdName}, please open your invitation and RSVP here: ${link()}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message());
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked in some webviews — fall back to prompt.
      window.prompt("Copy this message:", message());
    }
  };

  const wa = () => {
    const digits = (phone || "").replace(/\D/g, "");
    const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(message())}`, "_blank", "noopener");
  };

  return (
    <span style={{ display: "inline-flex", gap: 8 }}>
      <button onClick={copy} style={btn}>{copied ? "Copied ✓" : "Copy invite"}</button>
      <button onClick={wa} style={{ ...btn, background: "#1FAF57", borderColor: "#1FAF57", color: "#fff" }}>
        WhatsApp →
      </button>
    </span>
  );
}

const btn = {
  fontSize: 12, padding: "6px 10px", borderRadius: 7, cursor: "pointer",
  background: "#FBF8F0", border: "1px solid #C9C2AC", color: "#3B3527",
};
