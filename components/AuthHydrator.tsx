"use client";
import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export function AuthHydrator() {
  useEffect(() => {
    (async () => {
      try {
        if (!supabaseBrowser) return;

        // Optional dev admin bypass (no-login). Controlled via NEXT_PUBLIC_* envs.
        const BYPASS_ENABLED =
          process.env.NEXT_PUBLIC_DEV_ADMIN_BYPASS === "true" ||
          process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_ADMIN_BYPASS !== "false";
        const STOCK_EMAIL =
          process.env.NEXT_PUBLIC_DEV_STOCK_EMAIL || "savelii@gaxos.ai";
        const STOCK_PASSWORD =
          process.env.NEXT_PUBLIC_DEV_STOCK_PASSWORD || "dev-password-1234";

        const { data } = await supabaseBrowser.auth.getUser();
        let user_uuid = data?.user?.id as string | undefined;
        let user_email = (data?.user as any)?.email as string | undefined;

        // If bypass is enabled and there is no active session, create + sign in.
        if (BYPASS_ENABLED && (!user_uuid || !user_email)) {
          try {
            // Ensure the dev user exists (server-side route requires dev env or explicit flag)
            await fetch("/api/auth/dev-create-user", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: STOCK_EMAIL, password: STOCK_PASSWORD }),
            });
          } catch {}
          try {
            const { data: signIn } = await supabaseBrowser.auth.signInWithPassword({
              email: STOCK_EMAIL,
              password: STOCK_PASSWORD,
            });
            user_uuid = signIn?.user?.id as string | undefined;
            user_email = (signIn?.user as any)?.email as string | undefined;
          } catch {}
        }

        if (user_uuid && user_email) {
          try {
            const res = await fetch("/api/auth/upsert-profile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: user_email, user_uuid }),
            });
            const json = await res.json();
            if (res.ok && typeof window !== "undefined") {
              localStorage.setItem("userProfile", JSON.stringify(json));
              window.dispatchEvent(new CustomEvent("user:login", { detail: json }));
            }
          } catch {}
        } else if (BYPASS_ENABLED && typeof window !== "undefined") {
          try {
            const existing = localStorage.getItem("devUserId");
            const generated = (window.crypto && (window.crypto as any).randomUUID)
              ? (window.crypto as any).randomUUID()
              : `dev-${Math.random().toString(36).slice(2, 10)}`;
            const devId = existing || generated;
            if (!existing) localStorage.setItem("devUserId", devId);

            const profile = { email: STOCK_EMAIL, user_uuid: devId };
            localStorage.setItem("userProfile", JSON.stringify(profile));
            window.dispatchEvent(new CustomEvent("user:login", { detail: profile }));
          } catch {}
        }
      } catch {}
    })();
  }, []);

  return null;
}
