"use client";

import { useState } from "react";
import ContactImport from "./ContactImport";

const makeId = () => Math.random().toString(36).slice(2, 9);
const emptyEvent = () => ({ id: makeId(), label: "", date: "", time: "", venue: "", dress: "", parking: "" });
const emptyHousehold = () => ({ id: makeId(), name: "", phone: "", side: "", eventCounts: {} }); // eventCounts: { [eventId]: number }
const DEFAULT_COUNT = 4;

const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// "17:00" -> "5:00 PM"
function formatTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}
function splitDate(isoDate) {
  if (!isoDate) return { dayLabel: "", dateNum: "", monthLabel: "", yearLabel: "" };
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    dayLabel: DAY_NAMES[dt.getDay()],
    dateNum: String(d),
    monthLabel: MONTH_NAMES[m - 1],
    yearLabel: String(y),
  };
}

export default function HostNewPage() {
  const [coupleName, setCoupleName] = useState("");
  const [themeKey, setThemeKey] = useState("ivory");
  const [events, setEvents] = useState([emptyEvent()]);
  const [households, setHouseholds] = useState([emptyHousehold()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [showImport, setShowImport] = useState(false);

  // Append imported rows ({name, phone}) as households. If the list is still a
  // single blank starter row, replace it rather than leaving an empty entry.
  function addImported(rows) {
    setHouseholds((hs) => {
      const base = hs.length === 1 && !hs[0].name.trim() && !hs[0].phone.trim() ? [] : hs;
      const added = rows.map((r) => ({ ...emptyHousehold(), name: r.name, phone: r.phone || "" }));
      return [...base, ...added];
    });
  }

  const updateEvent = (i, field, value) =>
    setEvents((ev) => ev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));
  const updateHousehold = (i, field, value) =>
    setHouseholds((hs) => hs.map((h, idx) => (idx === i ? { ...h, [field]: value } : h)));
  const updateHouseholdCount = (i, eventId, value) =>
    setHouseholds((hs) =>
      hs.map((h, idx) => (idx === i ? { ...h, eventCounts: { ...h.eventCounts, [eventId]: value } } : h))
    );

  function validatePhones() {
    const named = households.filter((h) => h.name.trim());
    for (const h of named) {
      const digits = h.phone.replace(/[^\d+]/g, "");
      if (digits.length < 10) return `${h.name || "A household"} needs a valid mobile number — this is how their invite gets sent.`;
    }
    return null;
  }

  async function submit() {
    const phoneError = validatePhones();
    if (phoneError) {
      setError(phoneError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const labeledEvents = events.filter((e) => e.label.trim());
      const res = await fetch("/api/host/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coupleName,
          themeKey,
          events: labeledEvents.map((e) => ({ ...e, ...splitDate(e.date), time: formatTime(e.time) })),
          households: households
            .filter((h) => h.name.trim())
            .map((h) => ({
              name: h.name,
              phone: h.phone,
              side: h.side || null,
              eventCounts: labeledEvents.map((e) => h.eventCounts[e.id] ?? DEFAULT_COUNT),
            })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const label = { display: "block", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#77705F", margin: "14px 0 4px" };
  const input = { width: "100%", padding: "10px 12px", border: "1px solid #D8D2C5", borderRadius: 6, fontSize: 15, boxSizing: "border-box" };
  const row = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
  const card = { border: "1px solid #E5DCCC", borderRadius: 8, padding: 16, margin: "12px 0", background: "#FBF7EE" };
  const btn = { padding: "10px 18px", borderRadius: 6, border: "1px solid #33302A", background: "#33302A", color: "#FBF7EE", fontSize: 14, cursor: "pointer" };
  const ghostBtn = { ...btn, background: "transparent", color: "#33302A" };

  if (result) {
    return (
      <div style={{ maxWidth: 560, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif", color: "#33302A" }}>
        <h1 style={{ fontSize: 22 }}>{result.wedding.couple_name} — invite links ready</h1>
        <p style={{ color: "#77705F" }}>Copy each link and send it to that household on WhatsApp. The link is the invitation.</p>
        {result.households.map((h) => {
          const link = typeof window !== "undefined" ? `${window.location.origin}/i/${h.token}` : `/i/${h.token}`;
          const waDigits = (h.phone || "").replace(/[^\d+]/g, "").replace(/^0/, "44").replace("+", "");
          const waText = encodeURIComponent(`You're invited! ${link}`);
          return (
            <div key={h.token} style={card}>
              <div style={{ fontWeight: 600 }}>{h.name} <span style={{ fontWeight: 400, color: "#77705F" }}>({h.invited} invited)</span></div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input readOnly value={link} style={{ ...input, background: "#fff" }} onFocus={(e) => e.target.select()} />
                <button style={btn} onClick={() => navigator.clipboard.writeText(link)}>Copy</button>
              </div>
              {waDigits && (
                <a href={`https://wa.me/${waDigits}?text=${waText}`} target="_blank" rel="noopener noreferrer"
                   style={{ ...ghostBtn, display: "inline-block", marginTop: 8, textDecoration: "none", fontSize: 13 }}>
                  Send on WhatsApp →
                </a>
              )}
            </div>
          );
        })}
        <button style={{ ...ghostBtn, marginTop: 20 }} onClick={() => { setResult(null); }}>Create another wedding</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif", color: "#33302A" }}>
      <h1 style={{ fontSize: 22 }}>New wedding</h1>
      <p style={{ color: "#77705F", fontSize: 14 }}>Bare-bones skeleton: fill this in, generate links, send them out. Refine later.</p>

      <label style={label}>Couple names</label>
      <input style={input} placeholder="e.g. Zainab & Ahmed" value={coupleName} onChange={(e) => setCoupleName(e.target.value)} />

      <label style={label}>Theme</label>
      <select style={input} value={themeKey} onChange={(e) => setThemeKey(e.target.value)}>
        <option value="ivory">Ivory Botanical</option>
        <option value="emerald">Emerald & Gold</option>
      </select>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Events</h2>
      {events.map((e, i) => (
        <div key={e.id} style={card}>
          <label style={label}>Event name</label>
          <input style={input} placeholder="e.g. Nikah" value={e.label} onChange={(x) => updateEvent(i, "label", x.target.value)} />
          <div style={row}>
            <div>
              <label style={label}>Date</label>
              <input type="date" style={input} value={e.date} onChange={(x) => updateEvent(i, "date", x.target.value)} />
            </div>
            <div>
              <label style={label}>Time</label>
              <input type="time" style={input} value={e.time} onChange={(x) => updateEvent(i, "time", x.target.value)} />
            </div>
          </div>
          {e.date && (
            <div style={{ fontSize: 12, color: "#77705F", marginTop: 4 }}>
              {splitDate(e.date).dayLabel}, {splitDate(e.date).dateNum} {splitDate(e.date).monthLabel} {splitDate(e.date).yearLabel}
            </div>
          )}
          <label style={label}>Venue</label>
          <input style={input} placeholder="Masjid-e-Salaam, Preston" value={e.venue} onChange={(x) => updateEvent(i, "venue", x.target.value)} />
          <label style={label}>Dress code (optional)</label>
          <input style={input} value={e.dress} onChange={(x) => updateEvent(i, "dress", x.target.value)} />
          <label style={label}>Parking notes (optional)</label>
          <input style={input} value={e.parking} onChange={(x) => updateEvent(i, "parking", x.target.value)} />
          {events.length > 1 && (
            <button style={{ ...ghostBtn, marginTop: 10, fontSize: 12, padding: "6px 12px" }} onClick={() => setEvents((ev) => ev.filter((_, idx) => idx !== i))}>Remove event</button>
          )}
        </div>
      ))}
      <button style={ghostBtn} onClick={() => setEvents((ev) => [...ev, emptyEvent()])}>+ Add event</button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Households</h2>
        {!showImport && (
          <button style={{ ...ghostBtn, fontSize: 13, padding: "8px 14px" }} onClick={() => setShowImport(true)}>
            ⬇ Import from contacts
          </button>
        )}
      </div>
      {showImport && <ContactImport onAdd={addImported} onClose={() => setShowImport(false)} />}
      {households.map((h, i) => {
        const labeledEvents = events.filter((e) => e.label.trim());
        return (
          <div key={h.id} style={card}>
            <label style={label}>Household name</label>
            <input style={input} placeholder="The Khan Family" value={h.name} onChange={(x) => updateHousehold(i, "name", x.target.value)} />
            <label style={label}>Mobile number (required — this is how their invite gets sent)</label>
            <input style={input} placeholder="+44 7XXX XXXXXX" value={h.phone} onChange={(x) => updateHousehold(i, "phone", x.target.value)} />

            <label style={label}>Side (optional — internal only, helps with seating later)</label>
            <select style={input} value={h.side} onChange={(x) => updateHousehold(i, "side", x.target.value)}>
              <option value="">Not set</option>
              <option value="groom">Groom&apos;s side</option>
              <option value="bride">Bride&apos;s side</option>
              <option value="mutual">Mutual</option>
              <option value="community">Community</option>
            </select>

            {labeledEvents.length > 0 ? (
              <>
                <label style={label}>How many are invited to each event?</label>
                {labeledEvents.map((e) => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 6 }}>
                    <span style={{ fontSize: 14 }}>{e.label}</span>
                    <input
                      type="number" min={0}
                      style={{ ...input, width: 80 }}
                      value={h.eventCounts[e.id] ?? DEFAULT_COUNT}
                      onChange={(x) => updateHouseholdCount(i, e.id, Math.max(0, parseInt(x.target.value) || 0))}
                    />
                  </div>
                ))}
                <div style={{ fontSize: 12, color: "#77705F", marginTop: 6 }}>0 = not invited to that event.</div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: "#77705F", marginTop: 10 }}>Add an event above to set headcounts.</div>
            )}

            {households.length > 1 && (
              <button style={{ ...ghostBtn, marginTop: 10, fontSize: 12, padding: "6px 12px" }} onClick={() => setHouseholds((hs) => hs.filter((_, idx) => idx !== i))}>Remove household</button>
            )}
          </div>
        );
      })}
      <button style={ghostBtn} onClick={() => setHouseholds((hs) => [...hs, emptyHousehold()])}>+ Add household</button>

      {error && <div style={{ color: "#B0402C", marginTop: 16, fontSize: 14 }}>{error}</div>}

      <div style={{ marginTop: 24 }}>
        <button style={btn} disabled={saving || !coupleName.trim()} onClick={submit}>
          {saving ? "Creating…" : "Create wedding & generate links"}
        </button>
      </div>
    </div>
  );
}
