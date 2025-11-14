import { GalleryGrid } from "@/components/GalleryGrid";
import Link from "next/link";

export default function GalleryPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Gallery</h1>
        <div className="flex items-center gap-2">
          <Link href="/editor" className="px-3 py-1 border rounded text-sm">AI Image Editor</Link>
          <a href="/" className="px-3 py-1 border rounded text-sm">Back</a>
        </div>
      </div>
      <GalleryGrid />
    </main>
  );
}
