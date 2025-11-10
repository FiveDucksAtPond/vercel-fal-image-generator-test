"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"idle" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Load existing profile on mount
  if (typeof window !== "undefined" && step === "idle") {
    try {
      const raw = localStorage.getItem("userProfile");
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.email && p?.user_uuid) {
          setEmail(p.email);
          setStep("done");
        }
      }
    } catch {}
  }

  

  const signInWithPassword = async () => {
    setError(null);
    setMessage(null);
    if (!supabaseBrowser) {
      setError("Client not configured");
      return;
    }
    const { error } = await supabaseBrowser.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return setError(error.message);
    try {
      const { data: userData } = await supabaseBrowser.auth.getUser();
      const user_uuid = userData?.user?.id;
      const res = await fetch("/api/auth/upsert-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, user_uuid }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to upsert profile");
      if (typeof window !== "undefined") {
        localStorage.setItem("userProfile", JSON.stringify(json));
        window.dispatchEvent(new CustomEvent("user:login", { detail: json }));
      }
      setStep("done");
    } catch (e: any) {
      setError(e?.message || "Failed to save profile");
    }
  };

  const signUpWithPassword = async () => {
    setError(null);
    setMessage(null);
    if (!supabaseBrowser) {
      setError("Client not configured");
      return;
    }
    const devSkip = process.env.NEXT_PUBLIC_DEV_SKIP_EMAIL_CONFIRM === "true";
    if (devSkip) {
      try {
        const res = await fetch("/api/auth/dev-create-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Dev create failed");
        // Immediately sign in so the session is established
        await signInWithPassword();
        return;
      } catch (e: any) {
        return setError(e?.message || "Dev signup failed");
      }
    } else {
      const siteUrlFromEnv = process.env.NEXT_PUBLIC_SITE_URL;
      const redirectTo = siteUrlFromEnv || (typeof window !== "undefined" ? window.location.origin : undefined);
      const { data, error } = await supabaseBrowser.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) return setError(error.message);
      // Best effort: capture the newly created user UUID and persist profile
      try {
        const user_uuid = data?.user?.id;
        await fetch("/api/auth/upsert-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, user_uuid }),
        });
      } catch {}
      setMessage("Account created. Check your email to confirm, then sign in.");
    }
  };

  const resendSignupEmail = async () => {
    setError(null);
    if (!supabaseBrowser) {
      setError("Client not configured");
      return;
    }
    const siteUrlFromEnv = process.env.NEXT_PUBLIC_SITE_URL;
    const redirectTo = siteUrlFromEnv || (typeof window !== "undefined" ? window.location.origin : undefined);
    const { error } = await supabaseBrowser.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: redirectTo },
    } as any);
    if (error) setError(error.message);
    else setMessage("Confirmation email resent.");
  };

  const logout = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("userProfile");
      window.dispatchEvent(new Event("user:logout"));
    }
    await supabaseBrowser?.auth.signOut();
    setEmail("");
    setPassword("");
    setStep("idle");
  };

  return (
    <div className="flex flex-col gap-3 w-full max-w-lg">
      {step === "done" ? (
        <div className="flex items-center justify-between w-full">
          <span className="text-sm text-muted-foreground break-words">{email}</span>
          <button onClick={logout} className="text-sm underline">Logout</button>
        </div>
      ) : (
        <>
          <input
            type="email"
            placeholder="email@domain.com"
            className="px-3 py-2 border rounded text-sm w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="password"
            className="px-3 py-2 border rounded text-sm w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex gap-2 flex-col sm:flex-row">
            <button onClick={signInWithPassword} className="px-3 py-2 border rounded text-sm w-full sm:w-auto">Sign in</button>
            <button onClick={signUpWithPassword} className="px-3 py-2 border rounded text-sm w-full sm:w-auto">Create account</button>
          </div>
          <div className="flex gap-2 flex-col sm:flex-row">
            <button onClick={resendSignupEmail} className="px-3 py-2 border rounded text-sm w-full sm:w-auto" disabled={!email}>
              Resend confirmation email
            </button>
          </div>
          {message && (
            <div className="text-sm text-muted-foreground break-words whitespace-normal">{message}</div>
          )}
          {error && (
            <div className="text-sm text-red-500 break-words whitespace-normal">{error}</div>
          )}
        </>
      )}
    </div>
  );
}




