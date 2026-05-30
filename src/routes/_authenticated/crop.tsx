import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Crop, Download, RotateCcw, Scissors } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImageDropzone } from "@/components/image-dropzone";
import { downloadDataUrl, loadImage } from "@/lib/image-utils";
import { PageHeader } from "@/views/PageHeader";

export const Route = createFileRoute("/_authenticated/crop")({
  component: CropPage,
});

function CropPage() {
  const [src, setSrc] = useState<string | null>(null);
  const [points, setPoints] = useState<Array<{ x: number; y: number }>>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    if (!src) return;
    (async () => {
      const img = await loadImage(src);
      imgRef.current = img;
      const c = canvasRef.current!;
      const maxW = 800;
      const scale = Math.min(1, maxW / img.width);
      c.width = img.width * scale;
      c.height = img.height * scale;
      redraw([]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  function redraw(pts: Array<{ x: number; y: number }>) {
    const c = canvasRef.current;
    const img = imgRef.current;
    if (!c || !img) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.fillStyle = "rgba(34,211,238,0.15)";
    ctx.fill();
  }

  function getPos(e: React.PointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * canvasRef.current!.width) / r.width,
      y: ((e.clientY - r.top) * canvasRef.current!.height) / r.height,
    };
  }

  function onDown(e: React.PointerEvent) {
    drawing.current = true;
    const p = [getPos(e)];
    setPoints(p);
    redraw(p);
  }
  function onMove(e: React.PointerEvent) {
    if (!drawing.current) return;
    setPoints((prev) => {
      const next = [...prev, getPos(e)];
      redraw(next);
      return next;
    });
  }
  function onUp() {
    drawing.current = false;
  }

  function handleSave() {
    const img = imgRef.current;
    const c = canvasRef.current;
    if (!img || !c || points.length < 3) return toast.error("Dibuja el recorte primero");
    const sx = img.width / c.width;
    const sy = img.height / c.height;
    const out = document.createElement("canvas");
    out.width = img.width;
    out.height = img.height;
    const ctx = out.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(points[0].x * sx, points[0].y * sy);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x * sx, points[i].y * sy);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, 0, 0);
    downloadDataUrl(out.toDataURL("image/png"), `recorte-${Date.now()}.png`);
    toast.success("Recorte guardado");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Recortes" description="Dibuja un trazo libre sobre la imagen y descarga el recorte." />
      {!src ? (
        <ImageDropzone onFiles={(f) => setSrc(f[0].dataUrl)} />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/30 p-4">
            <canvas
              ref={canvasRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={onUp}
              className="mx-auto block max-w-full cursor-crosshair touch-none rounded-lg bg-white"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => { setPoints([]); redraw([]); }}>
              <RotateCcw className="h-4 w-4" /> Limpiar trazo
            </Button>
            <Button variant="outline" onClick={() => { setSrc(null); setPoints([]); }}>
              <Crop className="h-4 w-4" /> Otra imagen
            </Button>
            <Button onClick={handleSave} className="ml-auto">
              <Scissors className="h-4 w-4" />
              <Download className="h-4 w-4" /> Guardar recorte
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
