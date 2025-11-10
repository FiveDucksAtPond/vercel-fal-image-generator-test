import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { limit: reqLimit, email: onlyEmail, dryRun } = (await req.json().catch(() => ({}))) as {
      limit?: number;
      email?: string;
      dryRun?: boolean;
    };

    const allow = process.env.DEV_AUTH_SKIP_EMAIL_CONFIRM === "true" ||
      process.env.NEXT_PUBLIC_DEV_SKIP_EMAIL_CONFIRM === "true" ||
      process.env.NODE_ENV === "development";
    if (!allow) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const sb: any = supabase as any;
    const limit = Math.min(Math.max(Number(reqLimit) || 500, 1), 2000);

    // Fetch images missing uuid (lowercase). We target lowercase first as requested.
    let q = sb
      .from("user_generated_images")
      .select("id, image_url, user_email, email, uuid")
      .is("uuid", null)
      .order("id", { ascending: true })
      .limit(limit);

    if (onlyEmail) {
      q = q.or(`user_email.eq.${onlyEmail},email.eq.${onlyEmail}`);
    }

    const { data: rows, error: listErr } = await q;
    if (listErr) {
      return NextResponse.json({ error: `List failed: ${listErr.message || listErr}` }, { status: 500 });
    }

    let scanned = 0;
    let updated = 0;
    let skippedNoEmail = 0;
    let missingProfile = 0;
    const details: any[] = [];

    for (const row of rows || []) {
      scanned++;
      const email = row.user_email || row.email;
      if (!email) {
        skippedNoEmail++;
        continue;
      }
      const { data: prof, error: profErr } = await sb
        .from("user_profiles")
        .select("user_uuid, UUID")
        .eq("email", email)
        .maybeSingle();
      if (profErr) {
        details.push({ id: row.id, email, error: `profile lookup failed: ${profErr.message || profErr}` });
        continue;
      }
      const effectiveUuid = prof?.user_uuid || prof?.UUID;
      if (!effectiveUuid) {
        missingProfile++;
        details.push({ id: row.id, email, error: "no uuid in user_profiles" });
        continue;
      }

      if (!dryRun) {
        // Try lowercase 'uuid' first
        const { error: upd1 } = await sb
          .from("user_generated_images")
          .update({ uuid: effectiveUuid })
          .eq("id", row.id)
          .is("uuid", null);
        if (upd1) {
          // Try uppercase "UUID"
          const { error: upd2 } = await sb
            .from("user_generated_images")
            .update({ UUID: effectiveUuid })
            .eq("id", row.id)
            .is("UUID", null as any);
          if (upd2) {
            details.push({ id: row.id, email, error: `update failed: ${upd1.message || upd1} / ${upd2.message || upd2}` });
            continue;
          }
        }
      }
      updated++;
    }

    return NextResponse.json({ scanned, updated, skippedNoEmail, missingProfile, sample: details.slice(0, 10) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

