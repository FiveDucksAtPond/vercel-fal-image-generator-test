import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    const expected = process.env.ADMIN_API_SECRET;
    if (!expected || token !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const { email, type, redirectTo } = (await req.json()) as {
      email?: string;
      type?: "magiclink" | "signup" | "recovery";
      redirectTo?: string;
    };

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const site = redirectTo || process.env.NEXT_PUBLIC_SITE_URL || undefined;
    const linkType = type || "magiclink";

    const sb: any = supabase as any;
    const { data, error } = await sb.auth.admin.generateLink({
      type: linkType,
      email,
      options: { redirectTo: site },
    });
    if (error) {
      return NextResponse.json({ error: error.message || String(error) }, { status: 400 });
    }

    return NextResponse.json({
      email,
      type: linkType,
      redirectTo: site || null,
      action_link: (data as any)?.properties?.action_link || null,
      email_otp: (data as any)?.properties?.email_otp || null,
      hashed_token: (data as any)?.properties?.hashed_token || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

