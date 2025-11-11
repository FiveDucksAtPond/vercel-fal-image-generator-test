import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase-admin";
import { getBucketName, sanitizePublicUrl } from "@/lib/bucket";

export const runtime = "nodejs";

type HealResult = {
  id: number;
  from: string | null;
  to: string | null;
  status: "healed" | "skipped" | "failed";
  reason?: string;
};

function getCurrentHost(): string | null {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
    return u.origin;
  } catch {
    return null;
  }
}

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

    const { limit: rawLimit, offset: rawOffset, dry_run } = (await req.json().catch(() => ({}))) as {
      limit?: number;
      offset?: number;
      dry_run?: boolean;
    };

    const limit = Math.min(Math.max(Number(rawLimit) || 50, 1), 500);
    const offset = Math.max(Number(rawOffset) || 0, 0);
    const bucket = getBucketName();
    const currentHost = getCurrentHost();

    const sb: any = supabase as any;

    const { data: rows, error: selErr } = await sb
      .from("user_generated_images")
      .select("id,image_url,created_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (selErr) {
      return NextResponse.json({ error: selErr.message || String(selErr) }, { status: 500 });
    }

    const results: HealResult[] = [];

    for (const row of rows as Array<{ id: number; image_url: string | null }>) {
      const id = row.id;
      const src = row.image_url || null;
      if (!src) {
        results.push({ id, from: null, to: null, status: "skipped", reason: "no image_url" });
        continue;
      }

      let isCurrent = false;
      try {
        if (currentHost && src.startsWith(currentHost)) {
          const u = new URL(src);
          const parts = u.pathname.split("/");
          const idx = parts.findIndex((p) => p === "public");
          const b = idx > -1 ? parts[idx + 1] : null;
          if (b === bucket) isCurrent = true;
        }
      } catch {}
      if (isCurrent) {
        results.push({ id, from: src, to: src, status: "skipped", reason: "already in current bucket" });
        continue;
      }

      if (dry_run) {
        results.push({ id, from: src, to: null, status: "skipped", reason: "dry-run" });
        continue;
      }

      let arrayBuffer: ArrayBuffer | null = null;
      let contentType = "image/png";
      try {
        const resp = await fetch(src);
        if (!resp.ok) throw new Error(`upstream ${resp.status}`);
        contentType = resp.headers.get("content-type") || contentType;
        arrayBuffer = await resp.arrayBuffer();
      } catch (e: any) {
        results.push({ id, from: src, to: null, status: "failed", reason: `download: ${e?.message || e}` });
        continue;
      }

      const filename = `${new Date().toISOString().replace(/[:.]/g, "-")}-${id}.png`;
      const path = `healed/${filename}`;
      try {
        const { error: upErr } = await sb.storage.from(bucket).upload(path, Buffer.from(arrayBuffer!), {
          contentType,
          upsert: false,
        });
        if (upErr) throw upErr;
        const { data: urlData } = sb.storage.from(bucket).getPublicUrl(path);
        const publicUrl = sanitizePublicUrl(urlData?.publicUrl || null);
        if (!publicUrl) throw new Error("no publicUrl returned");
        const { error: updErr } = await sb
          .from("user_generated_images")
          .update({ image_url: publicUrl })
          .eq("id", id);
        if (updErr) throw updErr;
        results.push({ id, from: src, to: publicUrl, status: "healed" });
      } catch (e: any) {
        results.push({ id, from: src, to: null, status: "failed", reason: `upload/update: ${e?.message || e}` });
      }
    }

    return NextResponse.json({
      limit,
      offset,
      processed: rows.length,
      healed: results.filter((r) => r.status === "healed").length,
      failed: results.filter((r) => r.status === "failed").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      results,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
