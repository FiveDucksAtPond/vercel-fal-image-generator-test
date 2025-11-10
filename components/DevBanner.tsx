"use client";
import { useEffect, useState } from "react";

export function DevBanner() {
  const enabled = process.env.NEXT_PUBLIC_DEV_SKIP_EMAIL_CONFIRM === "true";
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      const v = localStorage.getItem("hideDevBanner");
      setHidden(v === "1");
    } catch {}
  }, []);

  if (!enabled || hidden) return null;

  return (
    <div className="w-full bg-yellow-100 text-yellow-900 border-b border-yellow-300">
      <div className="mx-auto max-w-5xl px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <div>
          <strong>Dev mode:</strong> Email confirmation is disabled. Accounts are auto-confirmed and written to <code>user_profiles</code>.
        </div>
        <button
          className="px-2 py-1 border border-yellow-400 rounded text-xs"
          onClick={() => {
            try { localStorage.setItem("hideDevBanner", "1"); } catch {}
            setHidden(true);
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

