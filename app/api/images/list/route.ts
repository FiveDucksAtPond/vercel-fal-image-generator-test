import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase-admin";

export const runtime = "nodejs";

type ListBody = {
  user_uuid?: string;
  limit?: number; // default 10
  page?: number;  // 0-based page index
  offset?: number; // legacy support
};

export async function POST(req: NextRequest) {
  try {
    const { user_uuid, limit: rawLimit, offset: rawOffset, page: rawPage } = (await req.json()) as ListBody;
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const limit = Math.min(Math.max(Number(rawLimit) || 10, 1), 100);
    const page = Math.max(Number(rawPage) || 0, 0);
    const hasOffset = typeof rawOffset !== "undefined" && rawOffset !== null && !Number.isNaN(Number(rawOffset));
    const offset = hasOffset ? Math.max(Number(rawOffset) || 0, 0) : page * limit;

    const sb: any = supabase as any;

    let query = sb
      .from("user_generated_images")
      .select("id, image_url, prompt, created_at, uuid")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // If a user_uuid is provided, filter to that user's images; otherwise, return recent images (community feed).
    if (user_uuid) {
      query = query.eq("uuid", user_uuid);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
    }

    const items = (data || []).map((row: any) => ({
      id: row.id,
      image_url: row.image_url,
      prompt: row.prompt ?? null,
      created_at: row.created_at,
      uuid: row.uuid ?? null,
    }));

    const nextOffset = offset + items.length;
    const hasMore = items.length === limit;
    const nextPage = hasMore ? page + 1 : null;
    return NextResponse.json({ items, nextOffset, nextPage, hasMore });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
