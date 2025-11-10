"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

function parseSupabasePublicUrl(url: string): { bucket: string; path: string } | null {
  try {
    const u = new URL(url);
    // Match /storage/v1/object/public/<bucket>/<path>
    const parts = u.pathname.split("/");
    const idx = parts.findIndex((p) => p === "public");
    if (idx > -1 && parts[idx + 1] && parts[idx + 2]) {
      const bucket = decodeURIComponent(parts[idx + 1]);
      const path = decodeURIComponent(parts.slice(idx + 2).join("/"));
      return { bucket, path };
    }
  } catch {}
  return null;
}

const CURRENT_SB_HOST = (() => {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
    return u.hostname;
  } catch {
    return "";
  }
})();

export function ImageWithFallback({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [triedSigned, setTriedSigned] = useState(false);
  const [triedProxy, setTriedProxy] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setCurrentSrc(src);
    setTriedSigned(false);
    setTriedProxy(false);
    setHidden(false);
  }, [src]);

  const onError = async () => {
    // Decide if we should try a signed URL (only if the host matches our project)
    let trySigned = false as boolean;
    try {
      const h = new URL(src).hostname;
      trySigned = Boolean(CURRENT_SB_HOST) && h === CURRENT_SB_HOST;
    } catch {}

    if (trySigned && !triedSigned) {
      setTriedSigned(true);
      try {
        const parsed = parseSupabasePublicUrl(src);
        if (parsed && supabaseBrowser) {
          const { data, error } = await supabaseBrowser.storage
            .from(parsed.bucket)
            .createSignedUrl(parsed.path, 60 * 60);
          if (!error && data?.signedUrl) {
            setCurrentSrc(data.signedUrl);
            return;
          }
        }
      } catch {}
    }
    if (!triedProxy) {
      setTriedProxy(true);
      try {
        setCurrentSrc(`/api/proxy-image?url=${encodeURIComponent(src)}`);
        return;
      } catch {}
    }
    // Give up and hide the broken image
    setHidden(true);
  };

  if (hidden) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={currentSrc} alt={alt} className={className} onError={onError} />;
}
