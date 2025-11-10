import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { email, user_uuid: userUuidFromClient } = (await req.json()) as { email?: string; user_uuid?: string };
    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured on server" },
        { status: 500 },
      );
    }

    const sb: any = supabase as any;
    const { data: existing, error: selErr } = await sb
      .from("user_profiles")
      .select("email, user_uuid")
      .eq("email", email)
      .maybeSingle();
    if (selErr) {
      console.warn("Select user_profiles failed", selErr);
    }
    const effectiveUuid =
      userUuidFromClient ||
      existing?.user_uuid ||
      (globalThis.crypto as any)?.randomUUID?.() ||
      // fallback simple uuid v4 generator
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });

    if (!existing) {
      const created_at = new Date().toISOString();

      const tryUpsert = async (row: any, opts?: any) => {
        const { error } = await sb.from("user_profiles").upsert(row, opts);
        return error;
      };

      const tryInsert = async (row: any) => {
        const { error } = await sb.from("user_profiles").insert(row);
        return error;
      };

      let errorFinal: any = null;

      // 1) Preferred: upsert with user_uuid, onConflict by email
      errorFinal = await tryUpsert(
        { email, user_uuid: effectiveUuid, created_at },
        { onConflict: "email", ignoreDuplicates: true },
      );

      // 2) Fallback: plain insert with user_uuid
      if (errorFinal) {
        console.warn("user_profiles upsert(user_uuid) failed; trying insert", errorFinal?.message || errorFinal);
        errorFinal = await tryInsert({ email, user_uuid: effectiveUuid, created_at });
      }

      // 3) Fallback: upsert using column name UUID (some schemas use uppercase UUID)
      if (errorFinal) {
        console.warn("user_profiles insert(user_uuid) failed; trying UUID column", errorFinal?.message || errorFinal);
        errorFinal = await tryUpsert(
          { email, UUID: effectiveUuid, created_at },
          { onConflict: "email", ignoreDuplicates: true },
        );
      }

      // 4) Fallback: compute an id manually and insert (for schemas without identity id)
      if (errorFinal) {
        console.warn("user_profiles upsert(UUID) failed; trying manual id insert", errorFinal?.message || errorFinal);
        let nextId: number | null = null;
        try {
          const { data: maxRows } = await sb
            .from("user_profiles")
            .select("id")
            .order("id", { ascending: false })
            .limit(1);
          const current = Array.isArray(maxRows) && maxRows.length ? Number(maxRows[0].id) : 0;
          nextId = isFinite(current) ? current + 1 : 1;
        } catch {}
        if (nextId == null) nextId = 1;

        // try with user_uuid id
        errorFinal = await tryInsert({ id: nextId, email, user_uuid: effectiveUuid, created_at });
        if (errorFinal) {
          // try with UUID id
          errorFinal = await tryInsert({ id: nextId, email, UUID: effectiveUuid, created_at });
        }
      }

      if (errorFinal) {
        const msg = typeof errorFinal?.message === "string" ? errorFinal.message : String(errorFinal);
        console.warn("All attempts to write user_profiles failed:", msg);
        return NextResponse.json({ error: `Failed to upsert profile: ${msg}` }, { status: 500 });
      }
    }

    return NextResponse.json({ email, user_uuid: effectiveUuid });
  } catch (e) {
    console.error("upsert-profile error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
