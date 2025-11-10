"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

type Item = {
  id: number;
  image_url: string;
  prompt: string | null;
  created_at: string;
};

export function GalleryGrid() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 10;
  const [modalIndex, setModalIndex] = useState<number | null>(null);

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
        setLoading(false);
        return;
      }
      const res = await fetch("/api/images/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_uuid, limit: pageSize, page }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load images");
      const next = json.items as Item[];
      setItems(next);
      setHasMore(Boolean(json.hasMore));
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    load();
    const onLogin = () => {
      setPage(0);
    };
    const onLogout = () => {
      setItems([]);
      setPage(0);
      setHasMore(true);
    };
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
          return (prev + items.length - 1) % items.length;
        });
      }
      if (e.key === "ArrowRight") {
        setModalIndex((prev) => {
          if (prev === null) return prev;
          return (prev + 1) % items.length;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modalIndex, items.length]);

  return (
    <div className="w-full">
      {!items.length && !loading && (
        <div className="text-sm text-muted-foreground">No images yet. Generate something to see it here.</div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {items.map((it, idx) => (
          <figure
            key={it.id}
            className="relative group cursor-zoom-in"
            onClick={() => setModalIndex(idx)}
            onMouseUp={() => setModalIndex(idx)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.image_url}
              alt={it.prompt || "generated image"}
              className="w-full h-36 object-cover rounded-lg border"
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
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => { if (page > 0) { setPage(page - 1); } }}
          disabled={loading || page === 0}
          className="px-3 py-1 border rounded text-sm"
        >
          Prev
        </button>
        <span className="text-xs text-muted-foreground">Page {page + 1}</span>
        <button
          onClick={() => { if (hasMore) { setPage(page + 1); } }}
          disabled={loading || !hasMore}
          className="px-3 py-1 border rounded text-sm"
        >
          Next
        </button>
      </div>

      {modalIndex !== null && items[modalIndex] &&
        createPortal(
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
                    return (prev + items.length - 1) % items.length;
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
                    return (prev + 1) % items.length;
                  })
                }
              >
                ›
              </button>

              {/* Image */}
              <div className="flex flex-col items-center gap-3 mt-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={items[modalIndex].image_url}
                  alt={items[modalIndex].prompt || "generated image"}
                  className="max-h-[64vh] w-auto max-w-full object-contain rounded-md"
                />
                {items[modalIndex].prompt && (
                  <div className="w-full">
                    <div className="text-xs uppercase tracking-wide text-white/70 mb-1">
                      Prompt
                    </div>
                    <div className="text-sm text-white/90">
                      {items[modalIndex].prompt}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
