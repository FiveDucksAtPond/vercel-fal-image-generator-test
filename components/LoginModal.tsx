"use client";
import { useEffect, useState } from "react";
import { LoginForm } from "@/components/LoginForm";

export function LoginModal() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("Log in");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("userProfile");
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.email) setLabel(p.email);
      }
    } catch {}
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setOpen(true);
    window.addEventListener("open-login", handler as EventListener);
    const onLogin = (e: Event) => {
      try {
        const raw = localStorage.getItem("userProfile");
        const p = raw ? JSON.parse(raw) : null;
        if (p?.email) setLabel(p.email);
      } catch {}
      setOpen(false);
    };
    const onLogout = () => setLabel("Log in");
    window.addEventListener("user:login", onLogin as EventListener);
    window.addEventListener("user:logout", onLogout as EventListener);
    return () => {
      window.removeEventListener("open-login", handler as EventListener);
      window.removeEventListener("user:login", onLogin as EventListener);
      window.removeEventListener("user:logout", onLogout as EventListener);
    };
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1 border rounded text-sm"
      >
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-lg p-6 panel">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Sign in</h2>
              <button aria-label="Close" onClick={() => setOpen(false)} className="text-sm">x</button>
            </div>
            <LoginForm />
          </div>
        </div>
      )}
    </>
  );
}

