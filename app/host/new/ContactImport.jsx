"use client";

import { useEffect, useMemo, useState } from "react";

// Bulk guest-list import. Host pastes names + numbers (or, later, uses the
// Android phone picker which feeds the same list); we parse, let them fix the
// invite name (kept separate from the phone-book name), and merge couples into
// one household so only one invite goes out. Returns [{name, phone}] via onAdd.
//
// Suggestions are deliberately conservative: we only hint a merge for an exact
// pair sharing a surname, and stay silent once a surname appears 3+ times
// (lots of Patels/Khans must not get mixed up). Nothing merges without a tap.

const clean = (n) => n.replace(/\([^)]*\)/g, "").replace(/[,;]+$/, "").replace(/\s+/g, " ").trim();
const tokens = (n) => clean(n).split(" ").filter(Boolean);
const surnameOf = (n) => { const p = tokens(n); return p.length > 1 ? p[p.length - 1].toLowerCase() : ""; };
const firstOf = (n) => tokens(n)[0] || n;

function parseLines(text) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line, i) => {
      const m = line.match(/(\+?[\d][\d\s().-]{6,}\d)/);
      const num = m ? m[1].trim() : "";
      const pb = (m ? line.replace(m[1], "") : line).replace(/[,;]+$/, "").trim();
      return { id: `e${i}_${Math.random().toString(36).slice(2, 7)}`, members: [{ pb, num }], invite: clean(pb), primary: 0 };
    });
}

export default function ContactImport({ onAdd, onClose }) {
  const [text, setText] = useState("");
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState({});
  const [pickerSupported, setPickerSupported] = useState(false);
  const [pickError, setPickError] = useState(null);

  // The Contact Picker API is Android-web only (Chrome/Edge). Feature-detect on
  // the client so the button only shows where it actually works; paste covers
  // everyone else (iOS, desktop).
  useEffect(() => {
    setPickerSupported(
      typeof navigator !== "undefined" && "contacts" in navigator && typeof window !== "undefined" && "ContactsManager" in window
    );
  }, []);

  const onText = (v) => {
    setText(v);
    setEntries(parseLines(v));
    setSelected({});
  };

  // Open the phone's own contact picker, then feed the chosen contacts through
  // the same paste pipeline (append as lines) so rename + merge work identically
  // whichever way contacts came in.
  async function pickFromPhone() {
    setPickError(null);
    try {
      const contacts = await navigator.contacts.select(["name", "tel"], { multiple: true });
      const lines = (contacts || [])
        .map((c) => {
          const nm = Array.isArray(c.name) ? (c.name[0] || "") : (c.name || "");
          const tel = Array.isArray(c.tel) ? (c.tel[0] || "") : (c.tel || "");
          return `${nm}  ${tel}`.trim();
        })
        .filter(Boolean);
      if (!lines.length) return;
      onText((text ? text.trimEnd() + "\n" : "") + lines.join("\n"));
    } catch (e) {
      // User cancelled, or the browser blocked it — leave paste available.
      if (e && e.name !== "AbortError") setPickError("Couldn’t open contacts — paste the list instead.");
    }
  }

  const contactCount = useMemo(() => entries.reduce((n, e) => n + e.members.length, 0), [entries]);

  // Surname pairs (exactly two) → suggest. 3+ of a surname → suppress entirely.
  const { suggestions, suppressed } = useMemo(() => {
    const byS = {};
    for (const e of entries) {
      if (e.members.length > 1) continue;
      const s = surnameOf(e.members[0].pb);
      if (!s) continue;
      (byS[s] = byS[s] || []).push(e);
    }
    const suggestions = [];
    let suppressed = 0;
    for (const s of Object.keys(byS)) {
      if (byS[s].length === 2) suggestions.push(byS[s]);
      else if (byS[s].length >= 3) suppressed += 1;
    }
    return { suggestions, suppressed };
  }, [entries]);

  function merge(ids) {
    setEntries((prev) => {
      const group = prev.filter((e) => ids.includes(e.id));
      if (group.length < 2) return prev;
      const members = group.flatMap((e) => e.members);
      const firsts = group.map((e) => firstOf(e.invite || e.members[0].pb));
      const sn = surnameOf(group[0].members[0].pb);
      const invite = firsts.join(" & ") + (sn ? " " + sn.charAt(0).toUpperCase() + sn.slice(1) : "");
      const at = Math.min(...group.map((e) => prev.indexOf(e)));
      const rest = prev.filter((e) => !ids.includes(e.id));
      const merged = { id: `m_${Math.random().toString(36).slice(2, 7)}`, members, invite, primary: 0 };
      rest.splice(at, 0, merged);
      return rest;
    });
    setSelected({});
  }

  function unmerge(id) {
    setEntries((prev) => {
      const e = prev.find((x) => x.id === id);
      if (!e) return prev;
      const at = prev.indexOf(e);
      const singles = e.members.map((m) => ({ id: `s_${Math.random().toString(36).slice(2, 7)}`, members: [m], invite: clean(m.pb), primary: 0 }));
      const copy = prev.slice();
      copy.splice(at, 1, ...singles);
      return copy;
    });
  }

  const setInvite = (id, v) => setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, invite: v } : e)));
  const setPrimary = (id, i) => setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, primary: i } : e)));

  const selIds = Object.keys(selected).filter((k) => selected[k]);

  function addAll() {
    const rows = entries
      .map((e) => ({ name: (e.invite || "").trim(), phone: (e.members[e.primary] || e.members[0]).num }))
      .filter((r) => r.name);
    if (rows.length) onAdd(rows);
    onClose?.();
  }

  return (
    <div style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: 15 }}>Import from contacts</strong>
        <button onClick={onClose} style={xBtn} aria-label="Close import">×</button>
      </div>
      <p style={hintP}>
        Your phone-book name stays for reference; set what you want on the invite. Merge a couple into one invite so nobody’s invited twice.
      </p>

      {pickerSupported && (
        <>
          <button onClick={pickFromPhone} style={pickBtn}>
            📱 Pick from phone contacts
          </button>
          <div style={{ fontSize: 12, color: "#A39C88", margin: "6px 0 10px" }}>
            Choose guests from your phone — names and numbers come straight in. Or paste a list below.
          </div>
        </>
      )}
      {pickError && <div style={{ color: "#B0402C", fontSize: 13, marginBottom: 8 }}>{pickError}</div>}

      <textarea
        rows={5}
        value={text}
        onChange={(e) => onText(e.target.value)}
        placeholder={"Fat Bob  07911 123456\nSarah (Bob's wife)  07822 445566\nZainab Khan  07533 221144"}
        style={{ ...input, fontFamily: "ui-monospace, monospace", fontSize: 13, resize: "vertical" }}
      />

      {entries.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 10, margin: "12px 0" }}>
            <div style={stat}><div style={statLbl}>Contacts</div><div style={statNum}>{contactCount}</div></div>
            <div style={{ alignSelf: "center", color: "#A39C88" }}>→</div>
            <div style={{ ...stat, background: "#EEF2E3" }}><div style={statLbl}>Invites</div><div style={statNum}>{entries.length}</div></div>
          </div>

          {suggestions.map((g, i) => (
            <button key={i} onClick={() => merge(g.map((e) => e.id))} style={suggestBtn}>
              Same surname — are {g.map((e) => firstOf(e.invite)).join(" & ")} one household?
            </button>
          ))}
          {(suppressed > 0 || suggestions.length > 0) && (
            <div style={{ fontSize: 12, color: "#A39C88", margin: "4px 0 8px" }}>
              {suppressed > 0
                ? "Common surnames (3+) are left alone to avoid mix-ups — merge those by hand."
                : "Suggestions are hints only — nothing merges until you tap it."}
            </div>
          )}

          {selIds.length >= 2 && (
            <button onClick={() => merge(selIds)} style={{ ...ghostBtn, marginBottom: 8 }}>
              Merge selected ({selIds.length}) into one invite
            </button>
          )}

          <div style={{ display: "grid", gap: 8 }}>
            {entries.map((e) => {
              const merged = e.members.length > 1;
              return (
                <div key={e.id} style={{ ...rowCard, ...(selected[e.id] ? { borderColor: "#3B5D8A", borderWidth: 2, padding: "9px 11px" } : {}) }}>
                  <input
                    type="checkbox"
                    checked={!!selected[e.id]}
                    onChange={(ev) => setSelected((s) => ({ ...s, [e.id]: ev.target.checked }))}
                    style={{ marginTop: 4 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {merged ? (
                      <>
                        <div style={miniLbl}>In your phone</div>
                        {e.members.map((m, i) => (
                          <div key={i} style={memRow}>
                            <span>{m.pb || "—"} · {m.num || "no number"}</span>
                            <label style={{ marginLeft: "auto", fontSize: 11, color: "#77705F" }}>
                              <input type="radio" name={`pri-${e.id}`} checked={e.primary === i} onChange={() => setPrimary(e.id, i)} /> invite here
                            </label>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div style={{ fontSize: 13, color: "#5C563F" }}>
                        <span style={{ color: "#A39C88" }}>In your phone: </span>{e.members[0].pb || "—"}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                      <span style={miniLbl}>On the invite</span>
                      <input value={e.invite} onChange={(ev) => setInvite(e.id, ev.target.value)} style={{ ...input, flex: 1, padding: "7px 10px" }} />
                      {!merged && <span style={{ fontSize: 12, color: "#77705F", whiteSpace: "nowrap" }}>{e.members[0].num}</span>}
                    </div>
                    {merged && (
                      <button onClick={() => unmerge(e.id)} style={linkBtn}>↺ unmerge</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={addAll} style={{ ...addBtn, marginTop: 12 }}>
            Add {entries.length} {entries.length === 1 ? "household" : "households"} to the list
          </button>
        </>
      )}
    </div>
  );
}

const panel = { border: "1px solid #E5DCCC", borderRadius: 8, padding: 16, margin: "12px 0", background: "#FBF7EE" };
const hintP = { fontSize: 13, color: "#77705F", margin: "6px 0 10px", lineHeight: 1.5 };
const input = { width: "100%", padding: "10px 12px", border: "1px solid #D8D2C5", borderRadius: 6, fontSize: 15, boxSizing: "border-box" };
const stat = { background: "#fff", border: "1px solid #E5DCCC", borderRadius: 6, padding: "6px 12px", flex: 1 };
const statLbl = { fontSize: 11, color: "#77705F", textTransform: "uppercase", letterSpacing: 0.6 };
const statNum = { fontSize: 22, fontWeight: 600, color: "#33302A" };
const rowCard = { display: "flex", gap: 10, alignItems: "flex-start", background: "#fff", border: "1px solid #E5DCCC", borderRadius: 8, padding: "10px 12px" };
const miniLbl = { fontSize: 11, color: "#A39C88", textTransform: "uppercase", letterSpacing: 0.5 };
const memRow = { fontSize: 12, color: "#5C563F", display: "flex", alignItems: "center", gap: 8, marginTop: 4 };
const suggestBtn = { display: "block", width: "100%", textAlign: "left", background: "#EAF1FB", color: "#1F4E8A", border: "1px solid #C7DBF2", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer", marginBottom: 6 };
const addBtn = { padding: "10px 18px", borderRadius: 6, border: "1px solid #33302A", background: "#33302A", color: "#FBF7EE", fontSize: 14, cursor: "pointer" };
const pickBtn = { width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #1FAF57", background: "#1FAF57", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" };
const ghostBtn = { padding: "8px 14px", borderRadius: 6, border: "1px solid #C9C2AC", background: "#fff", color: "#33302A", fontSize: 13, cursor: "pointer" };
const linkBtn = { marginTop: 8, background: "none", border: "none", color: "#3B5D8A", fontSize: 12, cursor: "pointer", padding: 0 };
const xBtn = { border: "none", background: "none", fontSize: 20, color: "#A39C88", cursor: "pointer", lineHeight: 1 };
