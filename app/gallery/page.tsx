import { GalleryGrid } from "@/components/GalleryGrid";

export default function GalleryPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Gallery</h1>
        <a href="/" className="px-3 py-1 border rounded text-sm">Back</a>
      </div>
      <GalleryGrid />
    </main>
  );
}
