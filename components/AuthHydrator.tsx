"use client";
import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export function AuthHydrator() {
  useEffect(() => {
    (async () => {
      try {
        if (!supabaseBrowser) return;
        const { data } = await supabaseBrowser.auth.getUser();
        const user_uuid = data?.user?.id as string | undefined;
        const user_email = (data?.user as any)?.email as string | undefined;
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
        }
      } catch {}
    })();
  }, []);

  return null;
}

