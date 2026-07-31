import { NextResponse } from "next/server";

export async function POST(req) {
  const { password } = await req.json();
  const expected = process.env.HOST_PASSWORD;

  if (!expected || password !== expected) {
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
