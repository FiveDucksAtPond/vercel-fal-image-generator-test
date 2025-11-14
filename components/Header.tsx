import Link from "next/link";
import { Button } from "./ui/button";
import { LoginModal } from "@/components/LoginModal";

export const Header = () => {
  return (
    <header className="mb-4">
      <div className="mx-auto flex justify-between items-center">
        <div>
          <div className="flex flex-row items-center gap-2 shrink-0">
            <div className="ml-0 text-zinc-100 text-xl font-semibold heading tracking-[0.03em]">Image Generator</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LoginModal />
          <Link href="/editor">
            <Button variant="outline" size="sm">AI Image Editor</Button>
          </Link>
          <Link href="/gallery">
            <Button variant="outline" size="sm">My Gallery</Button>
          </Link>
        </div>
      </div>
    </header>
  );
};
