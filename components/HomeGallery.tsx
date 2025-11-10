"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/ImageWithFallback";

type Item = {
  id: number;
  image_url: string;
  prompt: string | null;
  created_at: string;
};

export function HomeGallery() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 90; // fetch a larger batch for marquee rows
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );
  const [mounted, setMounted] = useState(false);
  const [modalIndex, setModalIndex] = useState<number | null>(null);

  const load = async (nextPage: number) => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      let profile: any = null;
      try {
        const raw = localStorage.getItem("userProfile");
        if (raw) profile = JSON.parse(raw);
      } catch {}
      const user_uuid = profile?.user_uuid;
      const payload: any = { limit: pageSize, page: nextPage };
      if (user_uuid) payload.user_uuid = user_uuid;
      const res = await fetch("/api/images/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load images");
      const next: Item[] = json.items || [];
      setItems((prev) => (nextPage === 0 ? next : [...prev, ...next]));
      setHasMore(Boolean(json.hasMore));
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Ensure SSR/CSR markup match to avoid hydration warnings
  useEffect(() => {
    setMounted(true);
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
    return <div className="w-full h-40" />; // SSR-safe placeholder
  }

  if (!items.length && !loading) {
    return (
      <div className="text-sm text-muted-foreground text-center">
        No images found.
      </div>
    );
  }

  // If we ended with fewer than 10 items, loop them to create a fuller set
  const displayItems: Item[] = (() => {
    if (items.length === 0) return items;
    if (hasMore || items.length >= 10) return items;
    const repeats = Math.min(5, Math.ceil(10 / items.length));
    const cloned: Item[] = [];
    for (let r = 0; r < repeats; r++) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        cloned.push({ ...it, id: Number(`${it.id}${r}${i}`) });
      }
    }
    return cloned;
  })();

  // Build three marquee rows by distributing items across rows and backfilling
  const rows: Item[][] = (() => {
    const base: Item[][] = [[], [], []];
    displayItems.forEach((it, idx) => {
      base[idx % 3].push(it);
    });

    const ITEM_WIDTH = 192; // w-48 => 12rem => 192px
    const GAP = 8; // gap-2 => 0.5rem => 8px
    const minPerRow = Math.max(
      8,
      Math.ceil((viewportWidth + 256) / (ITEM_WIDTH + GAP)) + 1,
    );

    const backfilled = base.map((row) => {
      if (row.length >= minPerRow) return row;
      const out = [...row];
      // Randomly pick additional items from the full set until reaching minPerRow
      const pool = displayItems.length ? displayItems : row;
      while (out.length < minPerRow && pool.length) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        out.push(pick);
      }
      return out;
    });
    return backfilled;
  })();

  // Create a unique ordered list of items for modal navigation
  const uniqueItems: Item[] = (() => {
    const seen = new Set<number>();
    const out: Item[] = [];
    for (const it of displayItems) {
      if (!seen.has(it.id)) {
        seen.add(it.id);
        out.push(it);
      }
    }
    return out;
  })();

  const Row = ({ data, direction, speed }: { data: Item[]; direction: "left" | "right"; speed: number }) => {
    // Duplicate the content for seamless looping
    const dup = [...data, ...data];
    return (
      <div className="marquee-row marquee-fade-edges py-2">
        <div
          className={`marquee-track ${direction === "left" ? "animate-marquee-left" : "animate-marquee-right"}`}
          style={{
            // @ts-ignore - CSS var for animation speed
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
              onTouchEnd={() => {
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
      {loading && (
        <div className="h-10 flex items-center justify-center text-xs text-muted-foreground">Loading...</div>
      )}

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



