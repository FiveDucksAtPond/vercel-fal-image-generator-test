"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Item = {
  id: number;
  image_url: string;
  prompt: string | null;
  created_at: string;
};

export function UserGallery() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const pageSize = 90;

  const load = async () => {
    if (loading) return;
    setLoading(true);
    try {
      let profile: any = null;
      try {
        const raw = localStorage.getItem("userProfile");
        if (raw) profile = JSON.parse(raw);
      } catch {}
      const user_uuid = profile?.user_uuid;
      if (!user_uuid) {
        setItems([]);
        return;
      }
      const res = await fetch("/api/images/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_uuid, limit: pageSize, page: 0 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load images");
      setItems(json.items || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Re-fetch on login/logout
  useEffect(() => {
    const onLogin = () => load();
    const onLogout = () => setItems([]);
    window.addEventListener("user:login", onLogin as EventListener);
    window.addEventListener("user:logout", onLogout as EventListener);
    return () => {
      window.removeEventListener("user:login", onLogin as EventListener);
      window.removeEventListener("user:logout", onLogout as EventListener);
    };
  }, []);

  // Keyboard navigation for modal
  useEffect(() => {
    if (modalIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalIndex(null);
      if (e.key === "ArrowLeft") {
        setModalIndex((prev) => {
          if (prev === null) return prev;
          return (prev + uniqueItems.length - 1) % uniqueItems.length;
        });
      }
      if (e.key === "ArrowRight") {
        setModalIndex((prev) => {
          if (prev === null) return prev;
          return (prev + 1) % uniqueItems.length;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modalIndex]);

  if (!mounted) {
    return <div className="w-full h-40" />;
  }

  if (!items.length && !loading) {
    return (
      <div className="text-sm text-muted-foreground">No images yet. Generate something to see it here.</div>
    );
  }

  // Distribute across rows and ensure coverage
  const ITEM_WIDTH = 192; // w-48
  const GAP = 8; // gap-2
  const minPerRow = Math.max(8, Math.ceil((viewportWidth + 256) / (ITEM_WIDTH + GAP)) + 1);

  const displayItems: Item[] = items.length >= 10 ? items : (() => {
    const repeats = Math.min(5, Math.ceil(10 / Math.max(1, items.length)));
    const out: Item[] = [];
    for (let r = 0; r < repeats; r++) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        out.push({ ...it, id: Number(`${it.id}${r}${i}`) });
      }
    }
    return out.length ? out : items;
  })();

  const base: Item[][] = [[], [], []];
  displayItems.forEach((it, idx) => base[idx % 3].push(it));
  const rows = base.map((row) => {
    if (row.length >= minPerRow) return row;
    const out = [...row];
    const pool = displayItems.length ? displayItems : row;
    while (out.length < minPerRow && pool.length) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      out.push(pick);
    }
    return out;
  });

  const uniqueItems: Item[] = (() => {
    const seen = new Set<number>();
    const out: Item[] = [];
    for (const it of displayItems) {
      const key = it.id;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(it);
      }
    }
    return out;
  })();

  const Row = ({ data, direction, speed }: { data: Item[]; direction: "left" | "right"; speed: number }) => {
    const dup = [...data, ...data];
    return (
      <div className="marquee-row marquee-fade-edges py-2">
        <div
          className={`marquee-track ${direction === "left" ? "animate-marquee-left" : "animate-marquee-right"}`}
          style={{
            // @ts-ignore
            "--marquee-speed": `${speed}s`,
          }}
        >
          {dup.map((it, i) => (
            <figure
              key={`${it.id}-${i}`}
              className="relative group cursor-zoom-in pointer-events-auto"
              onClick={() => {
                const idx = uniqueItems.findIndex((x) => x.id === it.id);
                if (idx >= 0) setModalIndex(idx);
              }}
              onMouseUp={() => {
                const idx = uniqueItems.findIndex((x) => x.id === it.id);
                if (idx >= 0) setModalIndex(idx);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.image_url}
                alt={it.prompt || "generated image"}
                className="w-48 h-36 object-cover rounded-lg border select-none"
                loading="lazy"
              />
              {it.prompt && (
                <figcaption className="absolute inset-x-0 bottom-0 text-[10px] leading-tight bg-black/40 text-white px-1 py-0.5 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  {it.prompt}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      <Row data={rows[0]} direction="left" speed={70} />
      <Row data={rows[1]} direction="right" speed={60} />
      <Row data={rows[2]} direction="left" speed={65} />

      {modalIndex !== null && uniqueItems[modalIndex] && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setModalIndex(null)}
        >
          <div
            className="panel-dark relative w-full max-w-5xl max-h-[90vh] p-4 md:p-6 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Back button */}
            <div className="absolute top-3 left-3 flex gap-2">
              <Button
                size="sm"
                className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                onClick={() => setModalIndex(null)}
              >
                Back
              </Button>
            </div>

            {/* Prev/Next */}
            <button
              aria-label="Previous"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 border border-white/20"
              onClick={() =>
                setModalIndex((prev) => {
                  if (prev === null) return prev;
                  return (prev + uniqueItems.length - 1) % uniqueItems.length;
                })
              }
            >
              ‹
            </button>
            <button
              aria-label="Next"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 border border-white/20"
              onClick={() =>
                setModalIndex((prev) => {
                  if (prev === null) return prev;
                  return (prev + 1) % uniqueItems.length;
                })
              }
            >
              ›
            </button>

            {/* Image */}
            <div className="flex flex-col items-center gap-3 mt-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={uniqueItems[modalIndex].image_url}
                alt={uniqueItems[modalIndex].prompt || "generated image"}
                className="max-h-[64vh] w-auto max-w-full object-contain rounded-md"
              />
              {uniqueItems[modalIndex].prompt && (
                <div className="w-full">
                  <div className="text-xs uppercase tracking-wide text-white/70 mb-1">
                    Prompt
                  </div>
                  <div className="text-sm text-white/90">
                    {uniqueItems[modalIndex].prompt}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

