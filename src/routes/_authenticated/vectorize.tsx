import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Wand2, Download, Loader2, Sparkles, Eraser, Brush, Undo2, MousePointerClick, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ImageTracer from "imagetracerjs";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageDropzone } from "@/components/image-dropzone";
import { aiImage, downloadDataUrl, loadImage } from "@/lib/image-utils";
import { PageHeader } from "@/views/PageHeader";

export const Route = createFileRoute("/_authenticated/vectorize")({
  component: VectorizePage,
});

type VFormat = "svg" | "png";
type Tool = "erase" | "restore";

function VectorizePage() {
  const [src, setSrc] = useState<string | null>(null);
  const [editedSrc, setEditedSrc] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [colors, setColors] = useState(8);
  const [ltres, setLtres] = useState(1);
  const [qtres, setQtres] = useState(1);
  const [pathomit, setPathomit] = useState(8);
  const [strokeWidth, setStrokeWidth] = useState(1);
  const [tintColor, setTintColor] = useState("#000000");
  const [tintEnabled, setTintEnabled] = useState(false);
  const [format, setFormat] = useState<VFormat>("svg");
  const [loading, setLoading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  // Editor de imagen (borrar/restaurar partes antes de vectorizar)
  const [tool, setTool] = useState<Tool>("erase");
  const [brushSize, setBrushSize] = useState(30);
  const editCanvasRef = useRef<HTMLCanvasElement>(null);
  const originalRef = useRef<HTMLImageElement | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const drawingRef = useRef(false);

  // Editor SVG (click para borrar trazos individuales)
  const [eraseSvgMode, setEraseSvgMode] = useState(false);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!src) return;
    (async () => {
      const img = await loadImage(src);
      originalRef.current = img;
      const c = editCanvasRef.current;
      if (!c) return;
      const maxW = 800;
      const scale = Math.min(1, maxW / img.width);
      c.width = img.width * scale;
      c.height = img.height * scale;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      historyRef.current = [ctx.getImageData(0, 0, c.width, c.height)];
      setEditedSrc(c.toDataURL("image/png"));
    })();
  }, [src]);

  function pushHistory() {
    const c = editCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    historyRef.current.push(ctx.getImageData(0, 0, c.width, c.height));
    if (historyRef.current.length > 30) historyRef.current.shift();
  }

  function getPos(e: React.PointerEvent) {
    const c = editCanvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * c.width) / r.width,
      y: ((e.clientY - r.top) * c.height) / r.height,
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!editCanvasRef.current) return;
    drawingRef.current = true;
    pushHistory();
    paint(e);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drawingRef.current) return;
    paint(e);
  }
  function onPointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const c = editCanvasRef.current;
    if (c) setEditedSrc(c.toDataURL("image/png"));
  }

  function paint(e: React.PointerEvent) {
    const c = editCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.save();
    if (tool === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // restaurar desde la imagen original
      const img = originalRef.current;
      if (img) {
        ctx.globalCompositeOperation = "source-over";
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, 0, 0, c.width, c.height);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function undo() {
    const c = editCanvasRef.current;
    if (!c || historyRef.current.length < 2) return;
    historyRef.current.pop();
    const last = historyRef.current[historyRef.current.length - 1];
    c.getContext("2d")!.putImageData(last, 0, 0);
    setEditedSrc(c.toDataURL("image/png"));
  }

  function resetEdit() {
    const c = editCanvasRef.current;
    const img = originalRef.current;
    if (!c || !img) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    historyRef.current = [ctx.getImageData(0, 0, c.width, c.height)];
    setEditedSrc(c.toDataURL("image/png"));
  }

  async function handleVectorize() {
    const source = editedSrc ?? src;
    if (!source) return;
    setLoading(true);
    try {
      const img = await loadImage(source);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const svgStr = ImageTracer.imagedataToSVG(imgData, {
        numberofcolors: colors,
        ltres,
        qtres,
        pathomit,
        strokewidth: strokeWidth,
      });
      const finalSvg = tintEnabled ? recolor(svgStr, tintColor) : svgStr;
      setSvg(finalSvg);
      toast.success("Vectorizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  function recolor(svgStr: string, color: string) {
    return svgStr.replace(/fill="[^"]*"/g, `fill="${color}"`);
  }

  async function handleAiCleanup() {
    const source = editedSrc ?? src;
    if (!source) return;
    setAiBusy(true);
    try {
      const out = await aiImage(
        "Limpia esta imagen y prepárala para vectorizar: fondo transparente, colores planos sólidos, bordes nítidos, sin ruido ni sombras.",
        [source],
      );
      setSrc(out);
      toast.success("Imagen preparada por IA");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setAiBusy(false);
    }
  }

  // Click sobre el SVG: elimina el <path> sobre el que se hizo click
  function onSvgClick(e: React.MouseEvent) {
    if (!eraseSvgMode) return;
    const t = e.target as SVGElement;
    if (!t || !(t.tagName === "path" || t.tagName === "polygon" || t.tagName === "rect")) return;
    t.remove();
    const container = svgContainerRef.current;
    if (container) setSvg(container.innerHTML);
  }

  function handleDownload() {
    if (!svg) return;
    if (format === "svg") {
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      downloadDataUrl(url, `vector-${Date.now()}.svg`);
    } else {
      const img = new Image();
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.width || 1024;
        c.height = img.height || 1024;
        c.getContext("2d")!.drawImage(img, 0, 0);
        downloadDataUrl(c.toDataURL("image/png"), `vector-${Date.now()}.png`);
      };
      img.src = url;
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Vectorizar"
        description="Borra partes de la imagen, ajusta los trazos y conviértela en SVG editable."
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <ImageDropzone
            preview={src}
            onClear={() => {
              setSrc(null);
              setEditedSrc(null);
              setSvg(null);
            }}
            onFiles={(f) => {
              setSrc(f[0].dataUrl);
              setSvg(null);
            }}
          />

          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Trazos</p>
            <Label label="Colores" value={colors} />
            <Slider value={[colors]} min={2} max={32} step={1} onValueChange={(v) => setColors(v[0])} />
            <Label label="Detalle líneas" value={ltres} />
            <Slider value={[ltres]} min={0.1} max={3} step={0.1} onValueChange={(v) => setLtres(v[0])} />
            <Label label="Suavizado" value={qtres} />
            <Slider value={[qtres]} min={0.1} max={3} step={0.1} onValueChange={(v) => setQtres(v[0])} />
            <Label label="Eliminar trazos pequeños" value={pathomit} />
            <Slider value={[pathomit]} min={0} max={50} step={1} onValueChange={(v) => setPathomit(v[0])} />
            <Label label="Grosor trazo" value={strokeWidth} />
            <Slider value={[strokeWidth]} min={0} max={6} step={0.5} onValueChange={(v) => setStrokeWidth(v[0])} />

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={tintEnabled} onChange={(e) => setTintEnabled(e.target.checked)} />
                Color único
              </label>
              <input
                type="color"
                value={tintColor}
                onChange={(e) => setTintColor(e.target.value)}
                className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleVectorize} disabled={!src || loading} className="flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Vectorizar
            </Button>
            <Button onClick={handleAiCleanup} disabled={!src || aiBusy} variant="secondary">
              {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              IA
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/30 p-4">
          {!src ? (
            <div className="grid h-full min-h-[420px] place-items-center text-center text-sm text-muted-foreground">
              <div>
                <Wand2 className="mx-auto h-10 w-10" />
                <p className="mt-2">Sube una imagen para empezar.</p>
              </div>
            </div>
          ) : (
            <Tabs defaultValue="edit" className="w-full">
              <TabsList>
                <TabsTrigger value="edit">Editar imagen</TabsTrigger>
                <TabsTrigger value="svg" disabled={!svg}>Vector</TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={tool === "erase" ? "default" : "secondary"}
                    onClick={() => setTool("erase")}
                  >
                    <Eraser className="h-4 w-4" /> Borrar
                  </Button>
                  <Button
                    size="sm"
                    variant={tool === "restore" ? "default" : "secondary"}
                    onClick={() => setTool("restore")}
                  >
                    <Brush className="h-4 w-4" /> Restaurar
                  </Button>
                  <div className="flex w-48 items-center gap-2">
                    <span className="text-xs text-muted-foreground">Pincel</span>
                    <Slider value={[brushSize]} min={4} max={150} step={1} onValueChange={(v) => setBrushSize(v[0])} />
                    <span className="w-8 text-right text-xs tabular-nums">{brushSize}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={undo}>
                    <Undo2 className="h-4 w-4" /> Deshacer
                  </Button>
                  <Button size="sm" variant="outline" onClick={resetEdit}>
                    <Trash2 className="h-4 w-4" /> Restablecer
                  </Button>
                </div>
                <div
                  className="rounded-xl bg-[conic-gradient(at_top_left,#f1f5f9_25%,#e2e8f0_0_50%,#f1f5f9_0_75%,#e2e8f0_0)] [background-size:16px_16px] p-2"
                >
                  <canvas
                    ref={editCanvasRef}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerUp}
                    className="mx-auto block max-w-full cursor-crosshair touch-none rounded"
                  />
                </div>
              </TabsContent>

              <TabsContent value="svg" className="space-y-3">
                {svg && (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant={eraseSvgMode ? "default" : "secondary"}
                        onClick={() => setEraseSvgMode((v) => !v)}
                      >
                        <MousePointerClick className="h-4 w-4" />
                        {eraseSvgMode ? "Click para borrar trazo (activo)" : "Borrar trazos del SVG"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleVectorize}>
                        <Wand2 className="h-4 w-4" /> Re-vectorizar
                      </Button>
                      <div className="ml-auto flex items-center gap-2">
                        <Select value={format} onValueChange={(v) => setFormat(v as VFormat)}>
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="svg">SVG</SelectItem>
                            <SelectItem value="png">PNG</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button onClick={handleDownload}>
                          <Download className="h-4 w-4" />
                          Descargar
                        </Button>
                      </div>
                    </div>
                    <div
                      ref={svgContainerRef}
                      onClick={onSvgClick}
                      className={`mx-auto max-h-[520px] overflow-auto rounded-xl bg-white p-2 [&_svg]:mx-auto [&_svg]:max-h-[500px] ${
                        eraseSvgMode ? "[&_path]:cursor-pointer [&_path:hover]:opacity-40" : ""
                      }`}
                      dangerouslySetInnerHTML={{ __html: svg }}
                    />
                    {eraseSvgMode && (
                      <p className="text-xs text-muted-foreground">
                        Haz click sobre cualquier trazo del vector para eliminarlo.
                      </p>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}

function Label({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
