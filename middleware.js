import { NextResponse } from "next/server";

const EXEMPT = ["/host/login", "/api/host/login"];

export function middleware(req) {
  const { pathname } = req.nextUrl;
  if (EXEMPT.includes(pathname)) return NextResponse.next();

  const isApi = pathname.startsWith("/api/host");
  const expected = process.env.HOST_PASSWORD;

  // Fail closed: if no password is configured, block the host area entirely
  // rather than leave it open.
  if (!expected) {
    return isApi
      ? NextResponse.json({ error: "Host area not configured." }, { status: 503 })
      : NextResponse.redirect(new URL("/host/login", req.url));
  }

  const cookie = req.cookies.get("host_session")?.value;
  if (cookie === expected) return NextResponse.next();

  if (isApi) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  return NextResponse.redirect(new URL("/host/login", req.url));
}

export const config = {
  matcher: ["/host/:path*", "/api/host/:path*"],
};
