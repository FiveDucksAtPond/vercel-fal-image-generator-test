import { NextRequest } from "next/server";

export const runtime = "nodejs";

const ALLOWED_HOSTS = [
  ".supabase.co",
  ".supabase.in",
  "replicate.delivery",
  ".replicate.com",
  "cdn.openai.com",
];

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get("url");
    if (!url) return new Response("Missing url", { status: 400 });
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return new Response("Invalid url", { status: 400 });
    }
    const host = target.hostname;
    const allowed = ALLOWED_HOSTS.some((suffix) => host === suffix || host.endsWith(suffix));
    if (!allowed) return new Response("Host not allowed", { status: 400 });

    const res = await fetch(target.toString());
    if (!res.ok) return new Response(`Upstream ${res.status}`, { status: 502 });
    const contentType = res.headers.get("content-type") || "image/png";
    const headers = new Headers();
    headers.set("content-type", contentType);
    // Cache for 1 hour in browsers/CDN
    headers.set("cache-control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400");
    return new Response(res.body, { status: 200, headers });
  } catch (e) {
    return new Response("Server error", { status: 500 });
  }
}

