"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HostLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/host/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Wrong password.");
      return;
    }
    router.push("/host/new");
  }

  return (
    <div style={{ maxWidth: 340, margin: "80px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif", color: "#33302A" }}>
      <h1 style={{ fontSize: 20 }}>Host area</h1>
      <p style={{ color: "#77705F", fontSize: 14 }}>Stopgap password gate — phone verification replaces this later.</p>
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        style={{ width: "100%", padding: "10px 12px", border: "1px solid #D8D2C5", borderRadius: 6, fontSize: 15, boxSizing: "border-box", marginTop: 12 }}
      />
      {error && <div style={{ color: "#B0402C", fontSize: 13, marginTop: 8 }}>{error}</div>}
      <button
        disabled={loading || !password}
        onClick={submit}
        style={{ marginTop: 14, padding: "10px 18px", borderRadius: 6, border: "1px solid #33302A", background: "#33302A", color: "#FBF7EE", fontSize: 14, cursor: "pointer" }}
      >
        {loading ? "Checking…" : "Enter"}
      </button>
    </div>
  );
}
