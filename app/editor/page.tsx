"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function EditorPage() {
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [galleryItems, setGalleryItems] = useState<Array<{ id: number; image_url: string; prompt?: string | null }>>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [rotate, setRotate] = useState(0);
  const [scale, setScale] = useState(100);
  const [fit, setFit] = useState<"contain" | "cover">("contain");
  const [editPrompt, setEditPrompt] = useState("");
  const [editStrength, setEditStrength] = useState(50);
  const [maskMode, setMaskMode] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const getCtx = () => {
    const c = canvasRef.current; if (!c) return null; return c.getContext('2d');
  };
  const startDraw = (x: number, y: number) => {
    drawing.current = true;
    const ctx = getCtx(); if (!ctx) return;
    ctx.strokeStyle = 'white';
    ctx.fillStyle = 'white';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const moveDraw = (x: number, y: number) => {
    if (!drawing.current) return;
    const ctx = getCtx(); if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const stopDraw = () => { drawing.current = false; };
  const onCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!maskMode) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    startDraw(e.clientX - rect.left, e.clientY - rect.top);
  };
  const onCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!maskMode) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientClientRect?.() || (e.target as HTMLCanvasElement).getBoundingClientRect();
    const r = rect as DOMRect;
    moveDraw(e.clientX - r.left, e.clientY - r.top);
  };
  const onCanvasMouseUp = () => { if (!maskMode) return; stopDraw(); };
  const onCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!maskMode) return;
    const t = e.touches[0]; const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    startDraw(t.clientX - rect.left, t.clientY - rect.top);
  };
  const onCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!maskMode) return;
    const t = e.touches[0]; const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    moveDraw(t.clientX - rect.left, t.clientY - rect.top);
  };
  const onCanvasTouchEnd = () => { if (!maskMode) return; stopDraw(); };
  const clearMask = () => {
    const c = canvasRef.current; const ctx = getCtx(); if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
  };
  const applyEdit = async () => {
    if (!imageUrl) return;
    try {
      // Require login before allowing edit
      try {
        const rawCheck = typeof window !== 'undefined' ? localStorage.getItem('userProfile') : null;
        const pCheck = rawCheck ? JSON.parse(rawCheck) : null;
        if (!pCheck?.email || !pCheck?.user_uuid) {
          if (typeof window !== 'undefined') window.dispatchEvent(new Event('open-login'));
          return;
        }
      } catch {}
      setUploading(true);
      let mask_base64: string | null = null;
      if (maskMode && canvasRef.current) {
        mask_base64 = canvasRef.current.toDataURL('image/png');
      }
      const body: any = {
        image_url: imageUrl,
        prompt: editPrompt || null,
        strength: editStrength / 100,
      };
      if (mask_base64) body.mask_base64 = mask_base64;
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('userProfile') : null;
        if (raw) {
          const p = JSON.parse(raw);
          if (p?.email) body.user_email = p.email;
          if (p?.user_uuid) body.user_uuid = p.user_uuid;
        }
      } catch {}
      const res = await fetch('/api/edit-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Edit failed (${res.status})`);
      if (json?.image_url) setImageUrl(json.image_url);
    } catch (e) {
      console.warn('Edit error', e);
    } finally {
      setUploading(false);
    }
  };

  const filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;
  const transform = `rotate(${rotate}deg) scale(${scale / 100})`;

  const uploadFile = useCallback(async (file: File) => {
    try {
      // Require login before allowing upload
      try {
        const rawCheck = typeof window !== 'undefined' ? localStorage.getItem('userProfile') : null;
        const pCheck = rawCheck ? JSON.parse(rawCheck) : null;
        if (!pCheck?.email || !pCheck?.user_uuid) {
          if (typeof window !== 'undefined') window.dispatchEvent(new Event('open-login'));
          return;
        }
      } catch {}
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      // include best-effort user context if present
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('userProfile') : null;
        if (raw) {
          const p = JSON.parse(raw);
          if (p?.email) fd.append('user_email', p.email);
          if (p?.user_uuid) fd.append('user_uuid', p.user_uuid);
        }
      } catch {}
      const res = await fetch('/api/editor/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Upload failed (${res.status})`);
      if (json?.image_url) {
        setImageUrl(json.image_url);
      } else {
        // fallback local preview
        const local = URL.createObjectURL(file);
        setImageUrl(local);
      }
    } catch (e) {
      console.warn('Upload error', e);
      // fallback local preview
      const local = URL.createObjectURL(file);
      setImageUrl(local);
    } finally {
      setUploading(false);
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      uploadFile(file);
    }
  };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const loadGallery = useCallback(async () => {
    try {
      setLoadingGallery(true);
      let user_uuid: string | undefined;
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('userProfile') : null;
        if (raw) {
          const p = JSON.parse(raw);
          user_uuid = p?.user_uuid;
        }
      } catch {}
      const body: any = { limit: 24, page: 0 };
      if (user_uuid) body.user_uuid = user_uuid;
      const res = await fetch('/api/images/list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (res.ok) {
        setGalleryItems((json?.items || []).map((it: any) => ({ id: it.id, image_url: it.image_url, prompt: it.prompt })));
      }
    } finally {
      setLoadingGallery(false);
    }
  }, []);

  useEffect(() => {
    if (pickerOpen) loadGallery();
  }, [pickerOpen, loadGallery]);

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-8 font-work">
      <div className="max-w-6xl mx-auto flex items-center justify-between mb-4">
        <div className="heading text-lg text-white">Edit</div>
        <div className="flex items-center gap-2">
          <Link href="/create"><Button className="heading" variant="outline" size="sm">Back to Generator</Button></Link>
          <Link href="/gallery"><Button className="heading" variant="outline" size="sm">Back to Gallery</Button></Link>
        </div>
      </div>
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-4 glass p-5">
          <h1 className="text-xl font-semibold mb-4 heading">Image Editor</h1>
          <div className="space-y-3">
            <label className="block text-sm text-white/80">
              Image URL
              <input
                className="mt-1 w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Paste an image URL or drop a file on the right"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-white/70">Brightness
                <input type="range" min={50} max={150} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full" />
              </label>
              <label className="text-xs text-white/70">Contrast
                <input type="range" min={50} max={150} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-full" />
              </label>
              <label className="text-xs text-white/70">Saturation
                <input type="range" min={0} max={200} value={saturate} onChange={(e) => setSaturate(Number(e.target.value))} className="w-full" />
              </label>
              <label className="text-xs text-white/70">Rotate
                <input type="range" min={-180} max={180} value={rotate} onChange={(e) => setRotate(Number(e.target.value))} className="w-full" />
              </label>
              <label className="text-xs text-white/70">Scale
                <input type="range" min={50} max={200} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-full" />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Button variant={fit === "contain" ? "default" : "outline"} size="sm" onClick={() => setFit("contain")}>Contain</Button>
              <Button variant={fit === "cover" ? "default" : "outline"} size="sm" onClick={() => setFit("cover")}>Cover</Button>
            </div>
            <div className="pt-2">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? 'Uploading…' : 'Upload a file'}
              </Button>
              <Button variant="outline" size="sm" className="ml-2" onClick={() => setPickerOpen(true)}>
                Pick from Gallery
              </Button>
            </div>
          </div>
        </section>

        <section
          className={`lg:col-span-8 glass p-4 flex items-center justify-center min-h-[420px] relative ${dragActive ? 'ring-2 ring-primary' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <div className="relative">
              <img
                src={imageUrl}
                alt="preview"
                className="max-w-full max-h-[70vh] rounded-md"
                style={{ filter, transform, objectFit: fit as any }}
                onLoad={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  if (canvasRef.current) {
                    const c = canvasRef.current;
                    c.width = img.clientWidth;
                    c.height = img.clientHeight;
                  }
                }}
              />
              {maskMode && (
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full rounded-md cursor-crosshair"
                  onMouseDown={onCanvasMouseDown}
                  onMouseMove={onCanvasMouseMove}
                  onMouseUp={onCanvasMouseUp}
                  onMouseLeave={onCanvasMouseUp}
                  onTouchStart={onCanvasTouchStart}
                  onTouchMove={onCanvasTouchMove}
                  onTouchEnd={onCanvasTouchEnd}
                />
              )}
            </div>
          ) : (
            <div className="text-sm text-white/80 text-center max-w-md mx-auto leading-relaxed">
              Drag & drop an image here, or use the Upload button. You can also paste a direct image URL on the left.
            </div>
          )}
        </section>
        <div className="lg:col-span-8 -mt-3">
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-xs text-white/80 w-full">Edit Prompt</label>
            <input
              className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
              placeholder="Describe the edit you want (e.g., neon noir look, replace background with neon city)"
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
            />
            <div className="flex items-center gap-3 w-full">
              <label className="text-xs text-white/70">Strength</label>
              <input type="range" min={0} max={100} value={editStrength} onChange={(e) => setEditStrength(Number(e.target.value))} />
              <span className="text-xs text-white/60">{editStrength}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant={maskMode ? 'default' : 'outline'} size="sm" onClick={() => setMaskMode((v) => !v)}>
                {maskMode ? 'Mask: On' : 'Mask: Off'}
              </Button>
              <Button variant="outline" size="sm" onClick={clearMask} disabled={!maskMode}>Clear Mask</Button>
              <Button size="sm" onClick={applyEdit} disabled={!imageUrl || uploading}>{uploading ? 'Applying…' : 'Apply Edit'}</Button>
            </div>
          </div>
        </div>
        {pickerOpen && (
          <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setPickerOpen(false)}>
            <div className="glass w-full max-w-5xl max-h-[85vh] overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <div className="heading text-lg">Pick from Gallery</div>
                <Button variant="outline" size="sm" onClick={() => setPickerOpen(false)}>Close</Button>
              </div>
              {loadingGallery ? (
                <div className="text-sm text-white/70">Loading…</div>
              ) : galleryItems.length === 0 ? (
                <div className="text-sm text-white/70">No images yet.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {galleryItems.map((it) => (
                    <button key={it.id} className="relative group" onClick={() => { setImageUrl(it.image_url); setPickerOpen(false); }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={it.image_url} alt={it.prompt || 'image'} className="w-full h-36 object-cover rounded-md border border-white/10" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
