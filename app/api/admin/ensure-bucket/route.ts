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

    const bucket = process.env.SUPABASE_BUCKET || "images";
    const sb: any = supabase as any;

    let created = false;
    try {
      const { data: list, error: listErr } = await sb.storage.listBuckets();
      if (listErr) throw listErr;
      const exists = Array.isArray(list) && list.some((b: any) => b.name === bucket);
      if (!exists) {
        const { error: createErr } = await sb.storage.createBucket(bucket, { public: true });
        if (createErr) throw createErr;
        created = true;
      }
    } catch (e: any) {
      // Try create regardless (idempotent); ignore if already exists
      try {
        const { error: createErr } = await sb.storage.createBucket(bucket, { public: true });
        if (!createErr) created = true;
      } catch {}
    }

    // Ensure public read policy (best-effort)
    try {
      await sb.rpc("exec_sql", {
        sql: `create policy if not exists "public read ${bucket}" on storage.objects for select to public using (bucket_id = '${bucket}');`,
      });
    } catch {}

    return NextResponse.json({ bucket, created });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

