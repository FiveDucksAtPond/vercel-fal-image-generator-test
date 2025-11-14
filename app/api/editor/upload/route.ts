import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase-admin";
import { getBucketName, sanitizePublicUrl } from "@/lib/bucket";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const prompt = (form.get("prompt") as string | null) || null;
    const user_email = (form.get("user_email") as string | null) || null;
    const user_uuid = (form.get("user_uuid") as string | null) || null;
    if (!user_email || !user_uuid) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const sb: any = supabase as any;
    const bucket = getBucketName() || "images";
    try { await sb.storage.createBucket(bucket, { public: true }); } catch {}

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const extGuess = file.type.includes("png") ? "png" : file.type.includes("jpeg") || file.type.includes("jpg") ? "jpg" : "png";
    const filename = `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}.${extGuess}`;

    const { error: uploadError } = await sb.storage.from(bucket).upload(filename, buffer, {
      contentType: file.type || (extGuess === 'png' ? 'image/png' : 'image/jpeg'),
      upsert: false,
    });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message || String(uploadError) }, { status: 400 });
    }
    const { data: urlData } = sb.storage.from(bucket).getPublicUrl(filename);
    const publicUrl = sanitizePublicUrl(urlData?.publicUrl || null);

    if (publicUrl) {
      const created_at = new Date().toISOString();
      const baseRow: any = { image_url: publicUrl, prompt, created_at, uuid: user_uuid, user_email };
      try {
        const insert = async (row: any) => (await sb.from("user_generated_images").insert(row)).error;
        let err: any = null;
        err = await insert(baseRow);
        if (err) {
          // Best effort; return URL regardless
          console.warn("editor upload: DB insert failed", err);
        }
      } catch (e) {
        console.warn("editor upload: insert error", e);
      }
    }

    return NextResponse.json({ image_url: publicUrl, prompt: prompt || null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
