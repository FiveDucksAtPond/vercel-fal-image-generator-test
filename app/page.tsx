import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HomeGallery } from "@/components/HomeGallery";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="min-h-[70vh] px-4 sm:px-6 lg:px-8">
      <section className="max-w-6xl mx-auto pt-16 pb-12">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-[0.04em] text-transparent bg-clip-text bg-gradient-to-b from-zinc-200 via-zinc-400 to-zinc-600">
          Create striking images with neon precision
        </h1>
        <p className="mt-4 text-base sm:text-lg text-lime-300 max-w-2xl">
          A clean, fast editor and gallery for your AI imagery. Build, refine, and share — without the noise.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link href="/create">
            <Button size="lg" className="tracking-[0.08em]">Start Creating</Button>
          </Link>
          <Link href="/gallery">
            <Button variant="outline" size="lg">View Gallery</Button>
          </Link>
          <Link href="/editor">
            <Button variant="outline" size="lg">AI Image Editor</Button>
          </Link>
        </div>
      </section>
      {/* Scrolling gallery preview on hero */}
      <section className="max-w-7xl mx-auto pb-16">
        {/* @ts-ignore */}
        <HomeGallery />
      </section>
    </main>
  );
}
