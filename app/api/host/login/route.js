import { NextResponse } from "next/server";

export async function POST(req) {
  const { password } = await req.json();
  // Trim both sides: pasting the value into Vercel commonly leaves a trailing
  // newline/space, which would make every correct password fail to match.
  const expected = process.env.HOST_PASSWORD?.trim();

  if (!expected || (password ?? "").trim() !== expected) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("host_session", expected, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return res;
}
