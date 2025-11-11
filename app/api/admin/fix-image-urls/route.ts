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

    const sb: any = supabase as any;

    const countSql = `select count(*)::int as c from user_generated_images where position('%0D' in image_url) > 0 or position('%0A' in image_url) > 0;`;
    let before = 0;
    try {
      const { data: beforeRows, error: beforeErr } = await sb.rpc("exec_sql", { sql: countSql });
      if (!beforeErr && Array.isArray(beforeRows) && beforeRows[0]?.c != null) {
        before = Number(beforeRows[0].c) || 0;
      }
    } catch {}

    const updateSql = `update user_generated_images set image_url = regexp_replace(image_url, '%0D%0A|%0D|%0A', '', 'gi') where position('%0D' in image_url) > 0 or position('%0A' in image_url) > 0;`;
    const { error: updErr } = await sb.rpc("exec_sql", { sql: updateSql });
    if (updErr) {
      return NextResponse.json({ error: updErr.message || String(updErr) }, { status: 500 });
    }

    let after = 0;
    try {
      const { data: afterRows, error: afterErr } = await sb.rpc("exec_sql", { sql: countSql });
      if (!afterErr && Array.isArray(afterRows) && afterRows[0]?.c != null) {
        after = Number(afterRows[0].c) || 0;
      }
    } catch {}

    const updated = before - after;
    return NextResponse.json({ before, after, updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

