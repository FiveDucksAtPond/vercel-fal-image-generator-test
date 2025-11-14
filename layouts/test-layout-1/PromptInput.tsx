import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowUp, RefreshCw } from "lucide-react";
import { getRandomSuggestions, Suggestion } from "@/lib/suggestions";
import { Spinner } from "@/components/ui/spinner";
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
    return () => {
      window.removeEventListener("user:login", onLogin as EventListener);
      window.removeEventListener("user:logout", onLogout as EventListener);
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
      <div className="bg-zinc-50 rounded-2xl p-8 shadow-lg">
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
            className="text-lg md:text-xl leading-relaxed bg-transparent border-none p-0 resize-none placeholder:text-zinc-500 text-[#111111] focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[10rem]"
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
                    "flex items-center justify-between px-2 rounded-lg py-1 bg-background text-sm hover:opacity-70 group transition-opacity duration-200",
                    index > 2
                      ? "hidden md:flex"
                      : index > 1
                        ? "hidden sm:flex"
                        : "",
                  )}
                  >
                  <span>
                    <span className="text-black text-xs sm:text-sm">
                      {suggestion.text.toLowerCase()}
                    </span>
                  </span>
                  <ArrowUpRight className="ml-1 h-2 w-2 sm:h-3 sm:w-3 text-zinc-500 group-hover:opacity-70" />
                </button>
              ))}
            </div>
            <button
              onClick={handleSubmit}
              disabled={isLoading || !input.trim()}
              className="h-8 w-8 rounded-full bg-black flex items-center justify-center disabled:opacity-50"
            >
              {isLoading ? (
                <Spinner className="w-3 h-3 text-white" />
              ) : (
                <ArrowUp className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
