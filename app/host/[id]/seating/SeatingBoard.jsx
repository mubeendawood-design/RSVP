"use client";

import { useMemo, useState } from "react";

// Side colours mirror the host dashboard badges.
const SIDE_COLOR = { groom: "#3B5D8A", bride: "#A34C6B", mutual: "#77705F", community: "#7A8F52" };
const SIDE_LABEL = { groom: "Groom's side", bride: "Bride's side", mutual: "Mutual", community: "Community" };

// Palette the host picks a table colour from (family group colour-coding).
const TABLE_COLORS = ["#3B5D8A", "#A34C6B", "#7A8F52", "#B08D4F", "#8A5A9E", "#4C9AA3", "#C06B3E", "#5C6370"];

export default function SeatingBoard({ weddingId, board }) {
  const [activeId, setActiveId] = useState(board[0]?.id || null);
  // Per-event mutable layout: { [eventId]: { tables, assignments } }. Seats are
  // static (they come from confirmed RSVPs); only tables + assignments change.
  const [layout, setLayout] = useState(() =>
    Object.fromEntries(board.map((e) => [e.id, { tables: e.tables || [], assignments: e.assignments || {} }]))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [dragKey, setDragKey] = useState(null);

  const ev = board.find((e) => e.id === activeId);
  const state = layout[activeId] || { tables: [], assignments: {} };

  const seatByKey = useMemo(() => {
    const m = new Map();
    (ev?.seats || []).forEach((s) => m.set(s.key, s));
    return m;
  }, [ev]);

  const knownTableIds = new Set(state.tables.map((t) => t.id));
  const unseated = (ev?.seats || []).filter((s) => {
    const t = state.assignments[s.key];
    return !t || !knownTableIds.has(t);
  });
  const seatsAtTable = (tableId) =>
    (ev?.seats || []).filter((s) => state.assignments[s.key] === tableId);

  async function post(payload) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/host/seating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Request failed");
      return json;
    } finally {
      setBusy(false);
    }
  }

  function patchEvent(eventId, fn) {
    setLayout((prev) => ({ ...prev, [eventId]: fn(prev[eventId]) }));
  }

  async function assign(seatKey, tableId) {
    const seat = seatByKey.get(seatKey);
    if (!seat) return;
    const prevTable = state.assignments[seatKey] || null;
    patchEvent(activeId, (s) => ({ ...s, assignments: { ...s.assignments, [seatKey]: tableId } }));
    try {
      await post({
        action: "assign", weddingId, eventId: activeId, seatKey, tableId,
        householdId: seat.householdId, label: seat.label,
      });
    } catch (e) {
      setError(e.message);
      patchEvent(activeId, (s) => {
        const next = { ...s.assignments };
        if (prevTable) next[seatKey] = prevTable; else delete next[seatKey];
        return { ...s, assignments: next };
      });
    }
  }

  async function unassign(seatKey) {
    const prevTable = state.assignments[seatKey];
    if (!prevTable) return;
    patchEvent(activeId, (s) => {
      const next = { ...s.assignments }; delete next[seatKey];
      return { ...s, assignments: next };
    });
    try {
      await post({ action: "unassign", eventId: activeId, seatKey });
    } catch (e) {
      setError(e.message);
      patchEvent(activeId, (s) => ({ ...s, assignments: { ...s.assignments, [seatKey]: prevTable } }));
    }
  }

  async function addTable(label, capacity, color) {
    try {
      const { table } = await post({ action: "create_table", weddingId, eventId: activeId, label, capacity, color });
      patchEvent(activeId, (s) => ({ ...s, tables: [...s.tables, table] }));
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteTable(tableId) {
    const prev = layout[activeId];
    // Optimistic: drop the table and free its seats back to the pool.
    patchEvent(activeId, (s) => {
      const assignments = { ...s.assignments };
      for (const k of Object.keys(assignments)) if (assignments[k] === tableId) delete assignments[k];
      return { tables: s.tables.filter((t) => t.id !== tableId), assignments };
    });
    try {
      await post({ action: "delete_table", tableId });
    } catch (e) {
      setError(e.message);
      setLayout((p) => ({ ...p, [activeId]: prev }));
    }
  }

  if (!ev) return <p style={{ color: "#77705F" }}>No events to seat yet.</p>;

  const totalConfirmed = ev.seats.length;

  return (
    <div style={{ marginTop: 18 }}>
      {/* Event tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {board.map((e) => (
          <button
            key={e.id}
            onClick={() => setActiveId(e.id)}
            style={{
              padding: "6px 14px", borderRadius: 999, fontFamily: "Georgia, serif", fontSize: 14, cursor: "pointer",
              border: `1px solid ${e.id === activeId ? "#3B3527" : "#D8D2C5"}`,
              background: e.id === activeId ? "#3B3527" : "#FBF8F0",
              color: e.id === activeId ? "#FBF7EE" : "#5C563F",
            }}
          >
            {e.label} <span style={{ opacity: 0.7 }}>· {e.seats.length}</span>
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: "#F7E2DC", color: "#8A3B28", border: "1px solid #E0B4A8", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {totalConfirmed === 0 ? (
        <div style={emptyCard}>No confirmed guests for {ev.label} yet. Once guests RSVP “yes”, they’ll appear here to seat.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 280px) 1fr", gap: 20, alignItems: "start" }}>
          {/* Unseated pool */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const k = e.dataTransfer.getData("text/plain"); if (k) unassign(k); setDragKey(null); }}
            style={{ ...panel, minHeight: 200, background: dragKey ? "#F3EEDD" : "#FBF8F0" }}
          >
            <div style={panelHead}>
              Unseated <span style={{ color: "#A39C88" }}>· {unseated.length}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {unseated.map((s) => (
                <Chip key={s.key} seat={s} onDragStart={() => setDragKey(s.key)} onDragEnd={() => setDragKey(null)} />
              ))}
              {unseated.length === 0 && <span style={{ color: "#A39C88", fontSize: 13 }}>Everyone’s seated 🎉</span>}
            </div>
            <SideLegend />
          </div>

          {/* Tables */}
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14 }}>
              {state.tables.map((t) => {
                const seated = seatsAtTable(t.id);
                const over = seated.length > t.capacity;
                return (
                  <div
                    key={t.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const k = e.dataTransfer.getData("text/plain"); if (k) assign(k, t.id); setDragKey(null); }}
                    style={{ ...panel, borderTop: `4px solid ${t.color || "#D8D2C5"}` }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ fontWeight: 600, color: "#3B3527" }}>{t.label}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, color: over ? "#B0402C" : "#77705F", fontWeight: over ? 600 : 400 }}>
                          {seated.length}/{t.capacity}
                        </span>
                        <button onClick={() => deleteTable(t.id)} title="Delete table" style={xBtn}>×</button>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, minHeight: 40 }}>
                      {seated.map((s) => (
                        <Chip key={s.key} seat={s} onDragStart={() => setDragKey(s.key)} onDragEnd={() => setDragKey(null)} />
                      ))}
                      {seated.length === 0 && <span style={{ color: "#C3BCA6", fontSize: 12, fontStyle: "italic" }}>drag guests here</span>}
                    </div>
                  </div>
                );
              })}
              <AddTable onAdd={addTable} disabled={busy} nextIndex={state.tables.length} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ seat, onDragStart, onDragEnd }) {
  const border = seat.side ? SIDE_COLOR[seat.side] : "#C3BCA6";
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", seat.key); e.dataTransfer.effectAllowed = "move"; onDragStart?.(); }}
      onDragEnd={onDragEnd}
      title={[seat.householdName, seat.band, seat.gender, ...(seat.flags || [])].filter(Boolean).join(" · ")}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, cursor: "grab",
        background: seat.placeholder ? "#FBF8F0" : "#fff",
        border: `1px solid ${border}`, borderLeft: `4px solid ${border}`,
        borderStyle: seat.placeholder ? "dashed" : "solid",
        borderRadius: 7, padding: "4px 9px", fontFamily: "Georgia, serif", fontSize: 13, color: "#3B3527",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      }}
    >
      <span>{seat.label}</span>
      {seat.band && <span style={{ fontSize: 10.5, color: "#77705F", background: "#F3EEDD", borderRadius: 4, padding: "0 5px" }}>{seat.band}</span>}
    </div>
  );
}

function SideLegend() {
  return (
    <div style={{ marginTop: 16, borderTop: "1px solid #E4DECB", paddingTop: 10, display: "flex", flexWrap: "wrap", gap: 10 }}>
      {Object.entries(SIDE_LABEL).map(([k, label]) => (
        <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#77705F" }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: SIDE_COLOR[k], display: "inline-block" }} />
          {label}
        </span>
      ))}
    </div>
  );
}

function AddTable({ onAdd, disabled, nextIndex }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [capacity, setCapacity] = useState(10);
  const [color, setColor] = useState(TABLE_COLORS[0]);

  function submit() {
    const l = label.trim() || `Table ${nextIndex + 1}`;
    onAdd(l, capacity, color);
    setLabel(""); setCapacity(10); setColor(TABLE_COLORS[0]); setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ ...panel, border: "1.5px dashed #C3BCA6", background: "transparent", color: "#77705F", cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 15, minHeight: 96 }}
      >
        + Add table
      </button>
    );
  }
  return (
    <div style={{ ...panel, borderTop: `4px solid ${color}` }}>
      <input
        autoFocus placeholder={`Table ${nextIndex + 1}`} value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        style={inp}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <label style={{ fontSize: 12, color: "#77705F" }}>Seats</label>
        <input type="number" min={1} max={50} value={capacity} onChange={(e) => setCapacity(e.target.value)} style={{ ...inp, width: 64 }} />
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {TABLE_COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)} title={c}
            style={{ width: 20, height: 20, borderRadius: 5, background: c, cursor: "pointer", border: color === c ? "2px solid #3B3527" : "2px solid transparent" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={submit} disabled={disabled} style={primaryBtn}>Add</button>
        <button onClick={() => setOpen(false)} style={ghostBtn}>Cancel</button>
      </div>
    </div>
  );
}

const panel = { background: "#FBF8F0", border: "1px solid #E4DECB", borderRadius: 12, padding: "14px 16px" };
const panelHead = { fontWeight: 600, color: "#3B3527", fontSize: 15 };
const emptyCard = { background: "#FBF8F0", border: "1px solid #E4DECB", borderRadius: 12, padding: "28px 20px", color: "#77705F", textAlign: "center" };
const inp = { padding: "8px 10px", border: "1px solid #D8D2C5", borderRadius: 6, fontSize: 14, fontFamily: "Georgia, serif", boxSizing: "border-box", width: "100%" };
const primaryBtn = { padding: "7px 16px", borderRadius: 6, border: "1px solid #3B3527", background: "#3B3527", color: "#FBF7EE", fontSize: 13, cursor: "pointer", fontFamily: "Georgia, serif" };
const ghostBtn = { padding: "7px 14px", borderRadius: 6, border: "1px solid #D8D2C5", background: "transparent", color: "#77705F", fontSize: 13, cursor: "pointer", fontFamily: "Georgia, serif" };
const xBtn = { border: "none", background: "transparent", color: "#B0A896", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 };
