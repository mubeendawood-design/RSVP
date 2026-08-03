"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

// ---------------- Demo data ----------------
const HOUSEHOLD = { name: "The Khan Family", invited: 6 };
const EVENTS = [
  {
    id: "mehndi", label: "Mehndi",
    day: "FRIDAY", dateNum: "11", month: "SEP", year: "2026", time: "6:00 PM",
    venue: "Gulshan Banqueting, Preston",
    maps: "https://maps.google.com/?q=Gulshan+Banqueting+Preston",
    dress: "Vibrant colours — yellows, oranges, greens",
    flow: [["6:00 PM", "Guests arrive, welcome drinks"], ["6:45 PM", "Bride's entrance & mehndi ceremony"], ["8:00 PM", "Dinner served"], ["9:30 PM", "Music & dancing"]],
    parking: "Free parking on site. Overflow at Fishergate Centre car park, 3 min walk.",
  },
  {
    id: "nikah", label: "Nikah",
    day: "SATURDAY", dateNum: "12", month: "SEP", year: "2026", time: "1:00 PM",
    venue: "Masjid-e-Salaam, Preston",
    maps: "https://maps.google.com/?q=Masjid-e-Salaam+Preston",
    dress: "Modest formal. Headscarves available at entrance.",
    flow: [["1:00 PM", "Guests seated — please arrive by 12:45"], ["1:15 PM", "Nikah ceremony"], ["2:00 PM", "Dua & congratulations"], ["2:30 PM", "Lunch served"]],
    parking: "Masjid car park is limited — please use Avenham multi-storey (5 min walk).",
  },
  {
    id: "walima", label: "Walima",
    day: "SUNDAY", dateNum: "13", month: "SEP", year: "2026", time: "5:30 PM",
    venue: "The Regency Suite, Manchester",
    maps: "https://maps.google.com/?q=The+Regency+Suite+Manchester",
    dress: "Formal — lounge suits & evening wear",
    flow: [["5:30 PM", "Arrival & seating (seating plan applies)"], ["6:15 PM", "Couple's entrance"], ["7:00 PM", "Dinner service"], ["9:00 PM", "Speeches & cake"]],
    parking: "Valet available. Additional parking announced closer to the date.",
  },
];

// ---------------- Themes (from inspiration refs) ----------------
const THEMES = {
  ivory: {
    name: "Ivory Botanical", light: true,
    page: "#E5DCCC", paper: "#FBF7EE", panel: "#F3ECDB",
    ink: "#33302A", sub: "#77705F", arch: "#A2705F", gold: "#B08D4F",
    leaf: "#7E8B6D", blossom: "#C79A8C", lavender: "#9A94B4",
    seal1: "#D9BB7A", seal2: "#A5813C",
    press: "0 1px 0 rgba(255,255,255,.75)",
  },
  emerald: {
    name: "Emerald & Gold", light: false,
    page: "#D8D2C5", paper: "#0F3527", panel: "#134130",
    ink: "#F3E9D2", sub: "#C9BB9B", arch: "#C9A24B", gold: "#C9A24B",
    leaf: "#C9A24B", blossom: "#E3C77F", lavender: "#E3C77F",
    seal1: "#E3C77F", seal2: "#9E7B33",
    press: "0 -1px 0 rgba(0,0,0,.45)",
  },
};

// ---------------- Ornaments ----------------
function PaperTexture({ opacity }) {
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity, pointerEvents: "none", mixBlendMode: "multiply" }} aria-hidden>
      <filter id="paperN"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" /></filter>
      <rect width="100%" height="100%" filter="url(#paperN)" />
    </svg>
  );
}

// Cusped Mughal arch, double-lined
function Arch({ t, children, minHeight = 300 }) {
  return (
    <div style={{ position: "relative", padding: "70px 26px 26px", minHeight }}>
      <svg viewBox="0 0 320 440" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
        {[0, 8].map((o) => (
          <path
            key={o}
            d={`M ${20 + o} 440 L ${20 + o} ${190 - o * 0.4}
               A 20 20 0 0 1 ${52 + o} ${168 - o}
               A 20 20 0 0 1 ${84 + o * 0.8} ${142 - o}
               A 20 20 0 0 1 ${114 + o * 0.6} ${112 - o}
               A 20 20 0 0 1 ${140 + o * 0.4} ${80 - o}
               L ${154} ${52 - o} L 160 ${34 - o} L ${166} ${52 - o} L ${180 - o * 0.4} ${80 - o}
               A 20 20 0 0 1 ${206 - o * 0.6} ${112 - o}
               A 20 20 0 0 1 ${236 - o * 0.8} ${142 - o}
               A 20 20 0 0 1 ${268 - o} ${168 - o}
               A 20 20 0 0 1 ${300 - o} ${190 - o * 0.4}
               L ${300 - o} 440`}
            fill="none"
            stroke={t.arch}
            strokeWidth={o === 0 ? 1.6 : 0.8}
            opacity={o === 0 ? 0.9 : 0.5}
          />
        ))}
      </svg>
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

// Fine-line botanical sprig (ref: image 4 wildflower border)
function Sprig({ t, flip }) {
  return (
    <svg width="110" height="150" viewBox="0 0 110 150" fill="none" aria-hidden
      style={{ position: "absolute", top: -6, [flip ? "left" : "right"]: -8, transform: flip ? "scaleX(-1) rotate(6deg)" : "rotate(6deg)", opacity: 0.9 }}>
      <g strokeWidth="1.1">
        <path d="M96 8 C 78 40, 66 78, 60 132" stroke={t.leaf} />
        <path d="M84 34 C 70 44, 60 60, 58 78" stroke={t.leaf} />
        {[[92, 20], [82, 44], [72, 66], [64, 92], [60, 116]].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx="7" ry="2.6" transform={`rotate(${-40 - i * 6} ${x} ${y})`} stroke={t.leaf} />
        ))}
        {[[70, 30, t.blossom], [56, 62, t.lavender], [50, 100, t.blossom]].map(([x, y, c], i) => (
          <g key={i} stroke={c}>
            {[0, 72, 144, 216, 288].map((r) => (
              <ellipse key={r} cx={x} cy={y - 5} rx="2.4" ry="4.6" transform={`rotate(${r} ${x} ${y})`} />
            ))}
          </g>
        ))}
      </g>
    </svg>
  );
}

// Ornamental divider (ref: image 1)
function Divider({ t }) {
  return (
    <svg width="180" height="16" viewBox="0 0 180 16" style={{ display: "block", margin: "14px auto" }} aria-hidden>
      <g stroke={t.gold} fill="none" strokeWidth="1">
        <line x1="0" y1="8" x2="66" y2="8" />
        <line x1="114" y1="8" x2="180" y2="8" />
        <path d="M74 8 C 78 2, 86 2, 90 8 C 86 14, 78 14, 74 8 Z" />
        <path d="M90 8 C 94 2, 102 2, 106 8 C 102 14, 94 14, 90 8 Z" />
        <circle cx="90" cy="8" r="1.6" fill={t.gold} />
      </g>
    </svg>
  );
}

function DateBlock({ t, e, size = 1 }) {
  const bar = { width: 1, alignSelf: "stretch", background: t.ink, opacity: 0.35 };
  const side = { fontSize: 12 * size, letterSpacing: 3, color: t.ink };
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14 * size, margin: "10px 0" }}>
      <span style={side}>{e.day}</span>
      <div style={bar} />
      <div style={{ textAlign: "center", lineHeight: 1.1 }}>
        <div style={{ fontSize: 11 * size, letterSpacing: 3, color: t.ink }}>{e.month}</div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30 * size, color: t.ink }}>{e.dateNum}</div>
        <div style={{ fontSize: 10 * size, letterSpacing: 2, color: t.sub }}>{e.year}</div>
      </div>
      <div style={bar} />
      <span style={side}>{e.time}</span>
    </div>
  );
}

function Seal({ t, label, onClick, size = 92, initials = "A·H" }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: size, height: size,
        borderRadius: "47% 53% 51% 49% / 52% 48% 52% 48%",
        border: "none",
        background: `radial-gradient(circle at 35% 30%, ${t.seal1}, ${t.seal2} 70%)`,
        boxShadow: "0 6px 14px rgba(0,0,0,.35), inset 0 2px 4px rgba(255,255,255,.45), inset 0 -3px 6px rgba(0,0,0,.3)",
        color: "#4A371A",
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: size * 0.3,
        display: "grid", placeItems: "center",
      }}
    >
      <span style={{ border: "1px solid rgba(74,55,26,.5)", borderRadius: "50%", width: "74%", height: "74%", display: "grid", placeItems: "center" }}>
        {initials}
      </span>
    </button>
  );
}

// ---------------- Main ----------------
export default function GuestInvite({ token, live }) {
  // Real household/events from Supabase when available (live prop from the
  // server-rendered token route); otherwise fall back to the built-in demo.
  const HOUSEHOLD_ = live ? live.household : HOUSEHOLD;
  const EVENTS_ = live ? live.events : EVENTS;

  // Split "Zainab and Hassan" into ["ZAINAB", "HASSAN"]; falls back to the
  // demo names if live data has no couple_name or an unexpected format.
  const coupleParts = live?.couple_name
    ? live.couple_name.split(/\s+(?:and|&)\s+/i).map((s) => s.trim().toUpperCase())
    : ["AYESHA", "HAMZA"];
  const [NAME1, NAME2] = [coupleParts[0] || "AYESHA", coupleParts[1] || "HAMZA"];
  const INITIALS = `${NAME1[0] || "A"}·${NAME2[0] || "H"}`;

  const [themeKey, setThemeKey] = useState(live ? live.theme_key : "ivory");
  const t = THEMES[themeKey];
  const [opened, setOpened] = useState(false);
  const [detail, setDetail] = useState(null);
  const initialRsvp = Object.fromEntries(
    EVENTS_.map((e) => [e.id, live ? e.rsvp ?? null : null])
  );
  const [rsvp, setRsvp] = useState(initialRsvp);
  const [dietary, setDietary] = useState(
    live ? EVENTS_.find((e) => e.dietary)?.dietary ?? "" : ""
  );
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const answered = EVENTS_.filter((e) => rsvp[e.id] !== null).length;
  const set = (id, n) => {
    const ev = EVENTS_.find((x) => x.id === id);
    const cap = ev?.invited ?? HOUSEHOLD_.invited;
    setRsvp((r) => ({ ...r, [id]: Math.max(0, Math.min(cap, n)) }));
  };

  // Writes each answered event's RSVP back to Supabase (no-op in demo mode,
  // since there's no real token to save against).
  async function saveRsvp() {
    if (!live || !token || !supabase) {
      setSubmitted(true);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const results = await Promise.all(
        EVENTS_.map((e) =>
          supabase.rpc("submit_rsvp", {
            p_token: token,
            p_event_slug: e.id,
            p_attending: rsvp[e.id],
            p_dietary: dietary,
          })
        )
      );
      if (results.some((r) => r.error || r.data === false)) {
        throw new Error("One or more RSVPs failed to save");
      }
      setSubmitted(true);
    } catch (err) {
      setSaveError("Couldn't save your RSVP — please try again.");
    } finally {
      setSaving(false);
    }
  }

  const serif = "'Cormorant Garamond', serif";
  const script = "'Great Vibes', cursive";
  const arabic = "'Amiri', serif";

  const caps = (fs = 11, c = t.sub) => ({
    fontSize: fs, letterSpacing: 3, textTransform: "uppercase", color: c, fontFamily: "'Jost', sans-serif", fontWeight: 400,
  });
  const press = { textShadow: t.press };

  const card = {
    position: "relative",
    background: t.paper,
    borderRadius: 3,
    boxShadow: "0 18px 40px rgba(0,0,0,.28), 0 2px 6px rgba(0,0,0,.18)",
    overflow: "hidden",
    color: t.ink,
  };
  const insert = {
    position: "relative",
    background: t.panel,
    border: `1px solid ${t.gold}55`,
    borderRadius: 3,
    boxShadow: "0 8px 18px rgba(0,0,0,.16), inset 0 1px 0 rgba(255,255,255,.25)",
    padding: "18px 18px 16px",
    margin: "16px 0",
    overflow: "hidden",
    color: t.ink,
  };
  const stepBtn = {
    width: 36, height: 36, borderRadius: "50%",
    border: `1px solid ${t.gold}`,
    background: t.paper,
    boxShadow: "inset 0 1px 2px rgba(255,255,255,.6), inset 0 -1px 2px rgba(0,0,0,.15), 0 1px 2px rgba(0,0,0,.12)",
    color: t.ink, fontSize: 18, lineHeight: 1, fontFamily: serif,
  };
  const inkBtn = (enabled = true) => ({
    width: "100%", padding: "14px 0", borderRadius: 2,
    border: `1px solid ${t.gold}`,
    background: enabled ? (t.light ? t.ink : t.gold) : "transparent",
    color: enabled ? (t.light ? t.paper : "#2E2410") : `${t.ink}66`,
    fontFamily: "'Jost', sans-serif", fontSize: 13, letterSpacing: 3, textTransform: "uppercase",
  });
  const mapsLink = (e) => (
    <a href={e.maps} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: t.light ? t.arch : t.gold, letterSpacing: 1 }}>
      Open in Google Maps →
    </a>
  );

  const ev = detail ? EVENTS_.find((x) => x.id === detail) : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(160deg, ${t.page}, ${t.page} 60%, #CFC6B4)`,
      display: "flex", justifyContent: "center",
      padding: "26px 14px 60px",
      fontFamily: "'Jost', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Great+Vibes&family=Amiri:ital@0;1&family=Jost:wght@300;400;500&display=swap');
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
        button { cursor: pointer; }
        button:focus-visible, a:focus-visible, textarea:focus-visible { outline: 2px solid ${t.gold}; outline-offset: 3px; }
        .rise { animation: rise .6s ease both; }
        @keyframes rise { from { opacity: 0; transform: translateY(16px);} to { opacity: 1; transform: none;} }
      `}</style>

      <div style={{ width: "100%", maxWidth: 430 }}>
        {/* demo-only theme control */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 4 }}>
          {Object.entries(THEMES).map(([k, th]) => (
            <button key={k} onClick={() => setThemeKey(k)}
              style={{
                ...caps(10, k === themeKey ? "#4A4436" : "#4A443688"),
                padding: "6px 14px", borderRadius: 20,
                border: `1px solid ${k === themeKey ? "#4A4436" : "#4A443644"}`,
                background: k === themeKey ? "rgba(255,255,255,.5)" : "transparent",
              }}>
              {th.name}
            </button>
          ))}
        </div>
        <div style={{ textAlign: "center", fontSize: 10, letterSpacing: 1, color: "#4A443666", marginBottom: 14 }}>
          demo control — theme chosen by host
        </div>

        {/* ---------- SEALED ---------- */}
        {!opened && (
          <div className="rise" style={{ ...card, textAlign: "center", padding: "56px 28px 48px" }}>
            <PaperTexture opacity={t.light ? 0.05 : 0.1} />
            <Arch t={t} minHeight={340}>
              <div style={{ fontFamily: arabic, fontSize: 24, color: t.ink, ...press }}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
              <div style={{ ...caps(10), marginTop: 6 }}>In the name of Allah, the Most Gracious, the Most Merciful</div>
              <Divider t={t} />
              <div style={{ fontFamily: serif, fontSize: 27, ...press, margin: "6px 0 2px" }}>{HOUSEHOLD_.name}</div>
              <div style={caps(11, t.light ? t.arch : t.gold)}>You are invited</div>
              <div style={{ marginTop: 30, display: "grid", placeItems: "center", gap: 12 }}>
                <Seal t={t} label="Break the seal to open your invitation" onClick={() => setOpened(true)} initials={INITIALS} />
                <div style={caps(10)}>Tap the seal to open</div>
              </div>
            </Arch>
            <Sprig t={t} />
            <Sprig t={t} flip />
          </div>
        )}

        {/* ---------- EVENT DETAIL (full traditional invite per occasion) ---------- */}
        {opened && ev && (
          <div className="rise" key={ev.id}>
            <button onClick={() => setDetail(null)} style={{ background: "transparent", border: "none", ...caps(11, "#4A4436"), padding: "4px 0 10px" }}>
              ← All events
            </button>
            <div style={{ ...card, padding: "40px 26px 30px", textAlign: "center" }}>
              <PaperTexture opacity={t.light ? 0.05 : 0.1} />
              <Sprig t={t} />
              <Sprig t={t} flip />
              <Arch t={t} minHeight={280}>
                <div style={{ fontFamily: arabic, fontSize: 20, ...press }}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
                <div style={{ ...caps(10), marginTop: 8 }}>Together with their families</div>
                <div style={{ fontFamily: serif, fontSize: 26, letterSpacing: 2, marginTop: 6, ...press }}>{NAME1}</div>
                <div style={{ fontFamily: script, fontSize: 26, color: t.light ? t.arch : t.gold, lineHeight: 1 }}>and</div>
                <div style={{ fontFamily: serif, fontSize: 26, letterSpacing: 2, ...press }}>{NAME2}</div>
                <div style={{ ...caps(10), marginTop: 10 }}>request the pleasure of your company at the</div>
                <div style={{ fontFamily: serif, fontSize: 40, ...press, margin: "4px 0 0" }}>{ev.label}</div>
                <Divider t={t} />
                <DateBlock t={t} e={ev} />
                <div style={{ fontFamily: serif, fontSize: 18 }}>{ev.venue}</div>
                <div style={{ marginTop: 4 }}>{mapsLink(ev)}</div>
              </Arch>

              <div style={{ textAlign: "left", marginTop: 8 }}>
                <div style={insert}>
                  <PaperTexture opacity={0.04} />
                  <div style={caps(10, t.light ? t.arch : t.gold)}>Dress code</div>
                  <div style={{ fontFamily: serif, fontSize: 17, marginTop: 6 }}>{ev.dress}</div>
                </div>
                <div style={insert}>
                  <PaperTexture opacity={0.04} />
                  <div style={caps(10, t.light ? t.arch : t.gold)}>Flow of the day</div>
                  {ev.flow.map(([time, what]) => (
                    <div key={time} style={{ display: "flex", gap: 14, padding: "8px 0", borderBottom: `1px solid ${t.gold}33`, alignItems: "baseline" }}>
                      <span style={{ fontFamily: serif, fontSize: 17, minWidth: 74 }}>{time}</span>
                      <span style={{ fontSize: 13.5 }}>{what}</span>
                    </div>
                  ))}
                </div>
                <div style={insert}>
                  <PaperTexture opacity={0.04} />
                  <div style={caps(10, t.light ? t.arch : t.gold)}>Parking & travel</div>
                  <div style={{ fontSize: 13.5, marginTop: 6, lineHeight: 1.5 }}>{ev.parking}</div>
                  <div style={{ fontSize: 12, fontStyle: "italic", color: t.sub, marginTop: 8 }}>
                    Hosts can update this closer to the date — you'll be notified.
                  </div>
                </div>
              </div>

              <button onClick={() => setDetail(null)} style={{ ...inkBtn(true), marginTop: 6 }}>Back to RSVP</button>
            </div>
          </div>
        )}

        {/* ---------- MAIN CARD ---------- */}
        {opened && !ev && (
          <div className="rise">
            <div style={{ ...card, padding: "42px 26px 30px", textAlign: "center" }}>
              <PaperTexture opacity={t.light ? 0.05 : 0.1} />
              <Sprig t={t} />
              <Sprig t={t} flip />
              <Arch t={t} minHeight={300}>
                <div style={{ fontFamily: arabic, fontSize: 24, ...press }}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
                <div style={{ ...caps(10), marginTop: 6 }}>In the name of Allah, the Most Gracious, the Most Merciful</div>
                <Divider t={t} />
                <div style={caps(10)}>Together with their families</div>
                <div style={{ fontFamily: serif, fontSize: 34, letterSpacing: 3, marginTop: 8, ...press }}>{NAME1}</div>
                <div style={{ fontFamily: script, fontSize: 30, color: t.light ? t.arch : t.gold, lineHeight: 1.1 }}>and</div>
                <div style={{ fontFamily: serif, fontSize: 34, letterSpacing: 3, ...press }}>{NAME2}</div>
                <div style={{ ...caps(10), marginTop: 10 }}>request the pleasure of your company</div>
                <Divider t={t} />
                <div style={{ fontFamily: serif, fontSize: 17 }}>{HOUSEHOLD_.name}</div>
                <div style={caps(10)}>{HOUSEHOLD_.invited} invited</div>
              </Arch>
            </div>

            {/* Event inserts */}
            {!submitted && EVENTS_.map((e) => (
              <div key={e.id} style={insert}>
                <PaperTexture opacity={t.light ? 0.04 : 0.08} />
                <button
                  onClick={() => setDetail(e.id)}
                  aria-label={`View full ${e.label} invitation`}
                  style={{ background: "transparent", border: "none", color: t.ink, width: "100%", textAlign: "center", padding: 0 }}
                >
                  <div style={{ fontFamily: serif, fontSize: 27, ...press }}>{e.label}</div>
                  <DateBlock t={t} e={e} size={0.82} />
                  <div style={{ fontSize: 13 }}>{e.venue}</div>
                  <div style={{ fontSize: 12, color: t.light ? t.arch : t.gold, marginTop: 6, letterSpacing: 1 }}>
                    View full invitation — dress code · timings · parking →
                  </div>
                </button>
                <div style={{ textAlign: "center", marginTop: 4 }}>{mapsLink(e)}</div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, borderTop: `1px solid ${t.gold}33`, paddingTop: 14 }}>
                  <span style={{ fontSize: 13, flex: 1 }}>
                    How many of you will attend?
                    {(e.invited ?? HOUSEHOLD_.invited) ? (
                      <span style={{ color: t.sub }}> (up to {e.invited ?? HOUSEHOLD_.invited})</span>
                    ) : null}
                  </span>
                  <button onClick={() => set(e.id, (rsvp[e.id] ?? 1) - 1)} aria-label={`Fewer attending ${e.label}`} style={stepBtn}>−</button>
                  <span style={{ fontFamily: serif, fontSize: 24, minWidth: 26, textAlign: "center", color: rsvp[e.id] === null ? `${t.ink}55` : t.ink }}>
                    {rsvp[e.id] === null ? "–" : rsvp[e.id]}
                  </span>
                  <button onClick={() => set(e.id, (rsvp[e.id] ?? 0) + 1)} aria-label={`More attending ${e.label}`} style={stepBtn}>+</button>
                </div>
                {rsvp[e.id] === 0 && <div style={{ fontSize: 12, color: t.sub, marginTop: 6, textAlign: "center" }}>We'll miss you at the {e.label}.</div>}
              </div>
            ))}

            {!submitted && (
              <div style={{ ...insert }}>
                <PaperTexture opacity={t.light ? 0.04 : 0.08} />
                <label style={{ ...caps(10, t.light ? t.arch : t.gold), display: "block", marginBottom: 8 }}>
                  Dietary requirements (optional)
                </label>
                <textarea
                  value={dietary} onChange={(x) => setDietary(x.target.value)} rows={2}
                  placeholder="e.g. 2 vegetarian, 1 nut allergy"
                  style={{
                    width: "100%", boxSizing: "border-box", background: t.paper,
                    border: `1px solid ${t.gold}55`, borderRadius: 2, color: t.ink,
                    padding: 10, fontFamily: "'Jost', sans-serif", fontSize: 14,
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,.12)",
                  }}
                />
                <button disabled={answered < EVENTS_.length || saving} onClick={saveRsvp} style={{ ...inkBtn(answered === EVENTS_.length), marginTop: 14 }}>
                  {answered < EVENTS_.length
                    ? `Answer all ${EVENTS_.length} events (${answered}/${EVENTS_.length})`
                    : saving ? "Sending…" : "Send RSVP"}
                </button>
                {saveError && (
                  <div style={{ color: "#B0402C", fontSize: 12, marginTop: 8, textAlign: "center" }}>{saveError}</div>
                )}
              </div>
            )}

            {/* Confirmation */}
            {submitted && (
              <div className="rise" style={{ ...card, marginTop: 16, padding: "34px 26px 30px", textAlign: "center" }}>
                <PaperTexture opacity={t.light ? 0.05 : 0.1} />
                <div style={{ display: "grid", placeItems: "center", marginBottom: 10 }}>
                  <Seal t={t} size={70} label="RSVP sealed" onClick={() => {}} initials={INITIALS} />
                </div>
                <div style={{ fontFamily: serif, fontSize: 26, ...press }}>JazakAllah Khair</div>
                <div style={{ fontSize: 13, color: t.sub, margin: "6px 0 16px" }}>Your reply has been sent to the hosts.</div>
                {EVENTS_.map((e) => (
                  <div key={e.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${t.gold}33`, padding: "9px 4px", fontSize: 14 }}>
                    <span style={{ fontFamily: serif, fontSize: 17 }}>{e.label}</span>
                    <span style={{ color: rsvp[e.id] ? t.ink : t.sub }}>{rsvp[e.id] ? `${rsvp[e.id]} attending` : "Not attending"}</span>
                  </div>
                ))}
                {dietary && <div style={{ fontSize: 13, color: t.sub, marginTop: 12 }}>Dietary: {dietary}</div>}
                <button onClick={() => alert("Would download .ics / open Google Calendar")} style={{ ...inkBtn(true), marginTop: 20 }}>
                  Add all events to calendar
                </button>
                <button onClick={() => setSubmitted(false)} style={{ marginTop: 10, background: "transparent", border: "none", color: t.sub, fontSize: 13, textDecoration: "underline" }}>
                  Change my answer
                </button>
              </div>
            )}

            <div style={{ textAlign: "center", marginTop: 30, ...caps(10, "#4A443688") }}>Powered by [Brand]</div>
          </div>
        )}
      </div>
    </div>
  );
}
