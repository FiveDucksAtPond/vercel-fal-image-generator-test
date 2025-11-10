import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // Guard: only allow in local dev when explicitly enabled
    const allow = process.env.DEV_AUTH_SKIP_EMAIL_CONFIRM === "true" || process.env.NODE_ENV === "development";
    if (!allow) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const { email, password } = (await req.json()) as { email?: string; password?: string };
    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
    }

    // Create a confirmed user via Admin API (requires SERVICE_ROLE key)
    const sb: any = supabase as any;
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      return NextResponse.json({ error: error.message || "Create user failed" }, { status: 400 });
    }

    const user_uuid = data.user?.id;
    const created_at = new Date().toISOString();

    // Upsert profile into user_profiles for convenience
    try {
      const { error: upErr } = await sb
        .from("user_profiles")
        .insert({ email, user_uuid, created_at });
      if (upErr) {
        // ignore if unique violation, etc.
        console.warn("dev-create-user: insert user_profiles failed", upErr);
      }
    } catch (e) {
      console.warn("dev-create-user: user_profiles upsert error", e);
    }

    return NextResponse.json({ email, user_uuid }, { status: 200 });
  } catch (e) {
    console.error("dev-create-user error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

