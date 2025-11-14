import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase-admin";
import { getBucketName, sanitizePublicUrl } from "@/lib/bucket";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const contentType = req.headers.get("content-type") || "";
    let imageUrl: string | null = null;
    let imageBase64: string | null = null;
    let prompt: string | null = null;
    let maskBase64: string | null = null;
    let user_email: string | null = null;
    let user_uuid: string | null = null;
    let strength: number | null = null;

    if (contentType.includes("application/json")) {
      const body = await req.json();
      imageUrl = body.image_url || null;
      imageBase64 = body.image_base64 || null;
      prompt = body.prompt || null;
      maskBase64 = body.mask_base64 || null;
      user_email = body.user_email || null;
      user_uuid = body.user_uuid || null;
      strength = typeof body.strength === 'number' ? body.strength : null;
    } else {
      const form = await req.formData();
      imageUrl = (form.get("image_url") as string) || null;
      imageBase64 = (form.get("image_base64") as string) || null;
      prompt = (form.get("prompt") as string) || null;
      maskBase64 = (form.get("mask_base64") as string) || null;
      user_email = (form.get("user_email") as string) || null;
      user_uuid = (form.get("user_uuid") as string) || null;
      const s = form.get("strength") as string | null;
      strength = s ? Number(s) : null;
    }

    // Require auth (best-effort via provided user context)
    if (!user_email || !user_uuid) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // TODO: Integrate true image-to-image/inpaint model here using `prompt`, `maskBase64`, and `strength`.
    // For now, we persist the provided image (url or base64) as an edited output.

    const sb: any = supabase as any;
    const bucket = getBucketName() || "images";
    try { await sb.storage.createBucket(bucket, { public: true }); } catch {}

    let buffer: Buffer | null = null;
    let ext = "png";
    if (imageBase64) {
      const base = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, (m: string, g1: string) => { ext = g1 === 'jpeg' ? 'jpg' : g1; return ''; });
      buffer = Buffer.from(base, "base64");
    } else if (imageUrl) {
      try {
        const resp = await fetch(imageUrl);
        if (resp.ok) {
          const ct = resp.headers.get('content-type') || '';
          if (ct.includes('jpeg') || ct.includes('jpg')) ext = 'jpg';
          else if (ct.includes('png')) ext = 'png';
          const arr = await resp.arrayBuffer();
          buffer = Buffer.from(arr);
        }
      } catch {}
    }
    if (!buffer) {
      return NextResponse.json({ error: "No image data" }, { status: 400 });
    }

    const filename = `edits/${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: uploadError } = await sb.storage.from(bucket).upload(filename, buffer, {
      contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
      upsert: false,
    });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message || String(uploadError) }, { status: 400 });
    }
    const { data: urlData } = sb.storage.from(bucket).getPublicUrl(filename);
    const publicUrl = sanitizePublicUrl(urlData?.publicUrl || null);

    // Insert DB row
    const created_at = new Date().toISOString();
    const baseRow: any = { image_url: publicUrl, prompt, created_at, uuid: user_uuid, user_email };
    try {
      const insert = async (row: any) => (await sb.from("user_generated_images").insert(row)).error;
      let err: any = await insert(baseRow);
      if (err) console.warn('edit-image: DB insert failed', err);
    } catch (e) { console.warn('edit-image: insert error', e); }

    return NextResponse.json({ image_url: publicUrl, prompt, mask_used: Boolean(maskBase64), strength });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
