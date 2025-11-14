import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { ArrowUpRight, ArrowUp, RefreshCw } from "lucide-react";
import { getRandomSuggestions, Suggestion } from "@/lib/suggestions";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type QualityMode = "performance" | "quality";

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isLoading?: boolean;
  showProviders: boolean;
  onToggleProviders: () => void;
  mode: QualityMode;
  onModeChange: (mode: QualityMode) => void;
  suggestions: Suggestion[];
}

export function PromptInput({
  suggestions: initSuggestions,
  isLoading,
  onSubmit,
}: PromptInputProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>(initSuggestions.slice(0, 4));
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("userProfile");
      if (!raw) return setIsLoggedIn(false);
      const p = JSON.parse(raw);
      setIsLoggedIn(Boolean(p?.email && p?.user_uuid));
    } catch {
      setIsLoggedIn(false);
    }
    // Also trust Supabase session directly (magic-link hydration)
    (async () => {
      try {
        if (supabaseBrowser) {
          const { data } = await supabaseBrowser.auth.getSession();
          if (data?.session?.user) setIsLoggedIn(true);
        }
      } catch {}
    })();
    const onLogin = (e: Event) => {
      try {
        const raw = localStorage.getItem("userProfile");
        const p = raw ? JSON.parse(raw) : null;
        setIsLoggedIn(Boolean(p?.email && p?.user_uuid));
      } catch {
        setIsLoggedIn(true);
      }
    };
    const onLogout = () => setIsLoggedIn(false);
    window.addEventListener("user:login", onLogin as EventListener);
    window.addEventListener("user:logout", onLogout as EventListener);
    // Subscribe to Supabase auth changes as a fallback
    const sub = supabaseBrowser?.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session?.user));
    });
    return () => {
      window.removeEventListener("user:login", onLogin as EventListener);
      window.removeEventListener("user:logout", onLogout as EventListener);
      try { sub && (sub as any).data?.subscription?.unsubscribe?.(); } catch {}
    };
  }, []);

  const updateSuggestions = () => {
    setSuggestions(getRandomSuggestions(4));
  };
  const handleSuggestionSelect = (prompt: string) => {
    setInput(prompt);
    onSubmit(prompt);
  };

  const handleSubmit = () => {
    if (!isLoggedIn) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("open-login"));
      }
      return;
    }
    if (!isLoading && input.trim()) {
      onSubmit(input);
    }
  };

  // const handleRefreshSuggestions = () => {
  //   setCurrentSuggestions(getRandomSuggestions());
  // };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoggedIn) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("open-login"));
        }
        return;
      }
      if (!isLoading && input.trim()) {
        onSubmit(input);
      }
    }
  };

  return (
    <div className="w-full mb-8 max-w-4xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl p-8 text-white border border-white/10 glass">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent" />
        {!isLoggedIn && (
          <div className="mb-3 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2 flex items-center justify-between">
            <span>You must log in to generate images.</span>
            <button
              className="px-2 py-1 border rounded text-xs"
              onClick={() => typeof window !== "undefined" && window.dispatchEvent(new Event("open-login"))}
            >
              Log in
            </button>
          </div>
        )}
        <div className="flex flex-col gap-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your prompt here"
            rows={6}
            className="text-lg md:text-xl leading-relaxed tracking-normal bg-transparent border-none p-0 resize-none placeholder:text-zinc-300 text-white focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[10rem] font-work"
          />
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center justify-between space-x-2">
              <button
                onClick={updateSuggestions}
                className="flex items-center justify-between px-2 rounded-lg py-1 bg-background text-sm hover:opacity-70 group transition-opacity duration-200"
              >
                <RefreshCw className="w-4 h-4 text-zinc-500 group-hover:opacity-70" />
              </button>
              {suggestions.slice(0, 4).map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionSelect(suggestion.prompt)}
                  className={cn(
                    "flex items-center justify-between px-2 rounded-lg py-1 bg-background text-sm hover:opacity-70 group transition-opacity duration-200 whitespace-nowrap max-w-[240px] overflow-hidden",
                    index > 2
                      ? "hidden md:flex"
                      : index > 1
                        ? "hidden sm:flex"
                        : "",
                  )}
                  >
                  <span>
                    <span className="text-white text-xs sm:text-sm font-work truncate">
                      {suggestion.text.toLowerCase()}
                    </span>
                  </span>
                  <ArrowUpRight className="ml-1 h-2 w-2 sm:h-3 sm:w-3 text-white/70 group-hover:opacity-80 shrink-0" />
                </button>
              ))}
            </div>
            <Button onClick={handleSubmit} disabled={isLoading || !input.trim()} size="lg">
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Spinner className="w-4 h-4 text-white" />
                  Generating
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  Generate
                  <ArrowUp className="w-4 h-4 text-white" />
                </div>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
