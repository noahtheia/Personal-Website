import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/admin-session";

export async function POST() {
  const res = NextResponse.redirect(
    `${(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "")}/admin/login`,
  );
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
