"use client";

import { useMemo, useState } from "react";

const SIDE_COLOR = { groom: "#3B5D8A", bride: "#A34C6B", mutual: "#77705F", community: "#7A8F52" };
const SIDE_LABEL = { groom: "Groom's", bride: "Bride's", mutual: "Mutual", community: "Community" };

export default function InvitationsSender({ weddingId, coupleName, rows }) {
  // Sent state lives in the DB (invite_sent_at); mirror it locally for instant
  // UI and optimistic updates.
  const [sent, setSent] = useState(() =>
    Object.fromEntries(rows.map((r) => [r.id, !!r.sentAt]))
  );
  const [error, setError] = useState(null);
  const [hideDone, setHideDone] = useState(false);

  const total = rows.length;
  const doneCount = useMemo(() => Object.values(sent).filter(Boolean).length, [sent]);
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  const inviteUrl = (token) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/i/${token}`;
  const messageFor = (r) =>
    `You are warmly invited to the wedding of ${coupleName}. ${r.name}, please open your invitation and RSVP here: ${inviteUrl(r.token)}`;

  async function mark(id, value) {
    setSent((s) => ({ ...s, [id]: value }));
    setError(null);
    try {
      const res = await fetch("/api/host/invite-sent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId: id, sent: value }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not save");
      }
    } catch (e) {
      setError(e.message);
      setSent((s) => ({ ...s, [id]: !value })); // revert
    }
  }

  function send(r) {
    const digits = (r.phone || "").replace(/\D/g, "");
    const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(messageFor(r))}`, "_blank", "noopener");
    if (!sent[r.id]) mark(r.id, true); // opening the send counts as sent; toggle off if needed
  }

  async function copy(r) {
    try {
      await navigator.clipboard.writeText(messageFor(r));
      setError(null);
    } catch {
      window.prompt("Copy this message:", messageFor(r));
    }
  }

  const visible = hideDone ? rows.filter((r) => !sent[r.id]) : rows;

  return (
    <div style={{ marginTop: 18 }}>
      {/* Progress */}
      <div style={{ background: "#FBF8F0", border: "1px solid #E4DECB", borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <strong style={{ color: "#3B3527" }}>{doneCount} / {total} invited</strong>
          <span style={{ fontSize: 12, color: "#77705F" }}>{pct}%</span>
        </div>
        <div style={{ height: 8, background: "#E9E2CF", borderRadius: 999, marginTop: 8, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "#7A8F52", transition: "width .2s" }} />
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#77705F", marginTop: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
          Hide the ones I’ve done
        </label>
      </div>

      {error && (
        <div style={{ background: "#F7E2DC", color: "#8A3B28", border: "1px solid #E0B4A8", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginTop: 12 }}>
          {error}
        </div>
      )}

      {/* Household list */}
      <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
        {visible.map((r) => {
          const isSent = !!sent[r.id];
          return (
            <div key={r.id} style={{ ...card, opacity: isSent && !hideDone ? 0.62 : 1 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "#3B3527", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {isSent && <span style={{ color: "#5C8A3A" }}>✓</span>}
                  {r.name}
                  {r.side && <span style={badge(r.side)}>{SIDE_LABEL[r.side] || r.side}</span>}
                </div>
                <div style={{ fontSize: 12, color: "#77705F", marginTop: 2 }}>
                  {r.invited} invited · {r.phone ? r.phone : <span style={{ color: "#B0402C" }}>no number</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                <button onClick={() => copy(r)} style={btnGhost} title="Copy message">Copy</button>
                <button onClick={() => send(r)} style={btnWa} title={r.phone ? "Open WhatsApp" : "No number — opens WhatsApp to pick a contact"}>
                  {isSent ? "Resend" : "Send"} →
                </button>
                {isSent && (
                  <button onClick={() => mark(r.id, false)} style={btnUndo} title="Mark as not sent">↺</button>
                )}
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <p style={{ color: "#5C8A3A", textAlign: "center", padding: "20px 0" }}>All invitations sent 🎉</p>
        )}
      </div>
    </div>
  );
}

const card = {
  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
  background: "#FBF8F0", border: "1px solid #E4DECB", borderRadius: 10, padding: "10px 14px",
};
const btnWa = { fontSize: 13, padding: "7px 12px", borderRadius: 7, cursor: "pointer", background: "#1FAF57", border: "1px solid #1FAF57", color: "#fff", fontFamily: "Georgia, serif" };
const btnGhost = { fontSize: 12.5, padding: "7px 11px", borderRadius: 7, cursor: "pointer", background: "#FBF8F0", border: "1px solid #C9C2AC", color: "#3B3527", fontFamily: "Georgia, serif" };
const btnUndo = { fontSize: 14, padding: "5px 9px", borderRadius: 7, cursor: "pointer", background: "transparent", border: "1px solid #D8D2C5", color: "#77705F" };
const badge = (side) => ({
  fontSize: 11, fontWeight: 400, color: SIDE_COLOR[side] || "#77705F",
  border: `1px solid ${(SIDE_COLOR[side] || "#77705F")}55`, borderRadius: 999, padding: "1px 8px",
});
