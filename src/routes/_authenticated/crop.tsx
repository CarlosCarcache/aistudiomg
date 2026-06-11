import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Circle, Crop, Download, RotateCcw, Scissors, Square, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImageDropzone } from "@/components/image-dropzone";
import { downloadDataUrl, loadImage } from "@/lib/image-utils";
import { PageHeader } from "@/views/PageHeader";

export const Route = createFileRoute("/_authenticated/crop")({
  component: CropPage,
});

type Mode = "free" | "rect" | "circle";
type Point = { x: number; y: number };

function CropPage() {
  const [src, setSrc] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("free");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const pointsRef = useRef<Point[]>([]);
  const startRef = useRef<Point | null>(null);
  const endRef = useRef<Point | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    if (!src) return;
    (async () => {
      const img = await loadImage(src);
      imgRef.current = img;
      const c = canvasRef.current!;
      const maxW = 900;
      const scale = Math.min(1, maxW / img.width);
      c.width = img.width * scale;
      c.height = img.height * scale;
      pointsRef.current = [];
      startRef.current = null;
      endRef.current = null;
      redraw();
    })();
  }, [src]);

  function redraw() {
    const c = canvasRef.current;
    const img = imgRef.current;
    if (!c || !img) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.fillStyle = "rgba(34,211,238,0.15)";

    if (mode === "free") {
      const pts = pointsRef.current;
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      if (!drawing.current) ctx.closePath();
      ctx.stroke();
      if (!drawing.current) ctx.fill();
    } else if (startRef.current && endRef.current) {
      const s = startRef.current;
      const e = endRef.current;
      if (mode === "rect") {
        const x = Math.min(s.x, e.x);
        const y = Math.min(s.y, e.y);
        const w = Math.abs(e.x - s.x);
        const h = Math.abs(e.y - s.y);
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.stroke();
        ctx.fill();
      } else {
        const cx = (s.x + e.x) / 2;
        const cy = (s.y + e.y) / 2;
        const rx = Math.abs(e.x - s.x) / 2;
        const ry = Math.abs(e.y - s.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
      }
    }
  }

  function getPos(e: React.PointerEvent): Point {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * c.width) / r.width,
      y: ((e.clientY - r.top) * c.height) / r.height,
    };
  }

  function onDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = getPos(e);
    if (mode === "free") {
      pointsRef.current = [p];
    } else {
      startRef.current = p;
      endRef.current = p;
    }
    redraw();
  }
  function onMove(e: React.PointerEvent) {
    if (!drawing.current) return;
    const p = getPos(e);
    if (mode === "free") {
      pointsRef.current.push(p);
    } else {
      endRef.current = p;
    }
    redraw();
  }
  function onUp(e: React.PointerEvent) {
    if (!drawing.current) return;
    drawing.current = false;
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch {}
    redraw();
  }

  function clearShape() {
    pointsRef.current = [];
    startRef.current = null;
    endRef.current = null;
    redraw();
  }

  function handleSave() {
    const img = imgRef.current;
    const c = canvasRef.current;
    if (!img || !c) return;
    const sx = img.width / c.width;
    const sy = img.height / c.height;

    if (mode === "free") {
      const pts = pointsRef.current;
      if (pts.length < 3) return toast.error("Dibuja el recorte primero");
      const xs = pts.map((p) => p.x * sx);
      const ys = pts.map((p) => p.y * sy);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const w = maxX - minX, h = maxY - minY;
      const out = document.createElement("canvas");
      out.width = w; out.height = h;
      const ctx = out.getContext("2d")!;
      ctx.beginPath();
      ctx.moveTo(pts[0].x * sx - minX, pts[0].y * sy - minY);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * sx - minX, pts[i].y * sy - minY);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, -minX, -minY);
      downloadDataUrl(out.toDataURL("image/png"), `recorte-${Date.now()}.png`);
    } else {
      const s = startRef.current, e = endRef.current;
      if (!s || !e) return toast.error("Dibuja el recorte primero");
      const x = Math.min(s.x, e.x) * sx;
      const y = Math.min(s.y, e.y) * sy;
      const w = Math.abs(e.x - s.x) * sx;
      const h = Math.abs(e.y - s.y) * sy;
      if (w < 2 || h < 2) return toast.error("Área muy pequeña");
      const out = document.createElement("canvas");
      out.width = w; out.height = h;
      const ctx = out.getContext("2d")!;
      if (mode === "circle") {
        ctx.beginPath();
        ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
      }
      ctx.drawImage(img, -x, -y);
      downloadDataUrl(out.toDataURL("image/png"), `recorte-${Date.now()}.png`);
    }
    toast.success("Recorte guardado");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Recortes" description="Elige una forma o dibuja a mano libre siguiendo el cursor." />
      {!src ? (
        <ImageDropzone onFiles={(f) => setSrc(f[0].dataUrl)} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant={mode === "free" ? "default" : "secondary"} onClick={() => { setMode("free"); clearShape(); }}>
              <Pencil className="h-4 w-4" /> Libre
            </Button>
            <Button variant={mode === "rect" ? "default" : "secondary"} onClick={() => { setMode("rect"); clearShape(); }}>
              <Square className="h-4 w-4" /> Cuadrado
            </Button>
            <Button variant={mode === "circle" ? "default" : "secondary"} onClick={() => { setMode("circle"); clearShape(); }}>
              <Circle className="h-4 w-4" /> Círculo
            </Button>
            <Button variant="ghost" onClick={clearShape}>
              <RotateCcw className="h-4 w-4" /> Limpiar
            </Button>
            <Button variant="outline" onClick={() => { setSrc(null); clearShape(); }}>
              <Crop className="h-4 w-4" /> Otra imagen
            </Button>
            <Button onClick={handleSave} className="ml-auto">
              <Scissors className="h-4 w-4" />
              <Download className="h-4 w-4" /> Guardar recorte
            </Button>
          </div>
          <div className="rounded-2xl border border-border bg-card/30 p-4">
            <canvas
              ref={canvasRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className="mx-auto block max-w-full cursor-crosshair touch-none rounded-lg bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
