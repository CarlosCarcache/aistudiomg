// Mini editor estilo Photoshop: capas, herramientas, ajustes, historia y export.
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brush,
  Circle as CircleIcon,
  Download,
  Eraser,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Move,
  Pipette,
  Plus,
  Redo2,
  Square,
  Trash2,
  Type as TypeIcon,
  Undo2,
  ZoomIn,
  ZoomOut,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageDropzone, fileToDataUrl } from "@/components/image-dropzone";
import { downloadDataUrl, loadImage, type Format } from "@/lib/image-utils";
import { PageHeader } from "@/views/PageHeader";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/editor")({
  component: EditorPage,
});

type Tool = "move" | "brush" | "eraser" | "rect" | "ellipse" | "text" | "eyedrop";

interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
}

interface Layer {
  id: string;
  name: string;
  canvas: HTMLCanvasElement;
  visible: boolean;
  opacity: number;
  adjust: Adjustments;
}

const ZERO_ADJ: Adjustments = { brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0 };

function newCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function filterStr(a: Adjustments) {
  return `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturation}%) hue-rotate(${a.hue}deg) blur(${a.blur}px)`;
}

function EditorPage() {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState("#ef4444");
  const [brushSize, setBrushSize] = useState(12);
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<string[][]>([]);
  const [future, setFuture] = useState<string[][]>([]);

  const displayRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const startPt = useRef<{ x: number; y: number } | null>(null);
  const lastPt = useRef<{ x: number; y: number } | null>(null);

  const activeLayer = useMemo(() => layers.find((l) => l.id === activeId) ?? null, [layers, activeId]);

  // Redibuja el canvas principal componiendo todas las capas.
  const composite = useCallback(() => {
    const d = displayRef.current;
    if (!d || !size) return;
    const ctx = d.getContext("2d")!;
    ctx.save();
    ctx.clearRect(0, 0, d.width, d.height);
    // Tablero de transparencia
    const cell = 12;
    for (let y = 0; y < d.height; y += cell) {
      for (let x = 0; x < d.width; x += cell) {
        ctx.fillStyle = ((x / cell + y / cell) & 1) === 0 ? "#ffffff" : "#e5e7eb";
        ctx.fillRect(x, y, cell, cell);
      }
    }
    for (const l of layers) {
      if (!l.visible) continue;
      ctx.globalAlpha = l.opacity;
      ctx.filter = filterStr(l.adjust);
      ctx.drawImage(l.canvas, 0, 0);
    }
    ctx.restore();
  }, [layers, size]);

  useEffect(() => {
    composite();
  }, [composite]);

  // Carga inicial: crea capa de fondo desde una imagen.
  async function handleInitial(dataUrl: string) {
    const img = await loadImage(dataUrl);
    const w = img.width;
    const h = img.height;
    const c = newCanvas(w, h);
    c.getContext("2d")!.drawImage(img, 0, 0);
    const layer: Layer = {
      id: crypto.randomUUID(),
      name: "Fondo",
      canvas: c,
      visible: true,
      opacity: 1,
      adjust: { ...ZERO_ADJ },
    };
    setSize({ w, h });
    setLayers([layer]);
    setActiveId(layer.id);
    setHistory([]);
    setFuture([]);
    // Ajusta zoom al área visible
    const maxW = 900;
    setZoom(Math.min(1, maxW / w));
  }

  function snapshot(): string[] {
    return layers.map((l) => l.canvas.toDataURL("image/png"));
  }
  function pushHistory() {
    setHistory((h) => [...h.slice(-29), snapshot()]);
    setFuture([]);
  }
  async function restore(snaps: string[]) {
    if (!size) return;
    const next: Layer[] = [];
    for (let i = 0; i < snaps.length && i < layers.length; i++) {
      const img = await loadImage(snaps[i]);
      const c = newCanvas(size.w, size.h);
      c.getContext("2d")!.drawImage(img, 0, 0);
      next.push({ ...layers[i], canvas: c });
    }
    setLayers(next);
  }
  async function undo() {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [...f, snapshot()]);
    await restore(prev);
  }
  async function redo() {
    if (!future.length) return;
    const next = future[future.length - 1];
    setFuture((f) => f.slice(0, -1));
    setHistory((h) => [...h, snapshot()]);
    await restore(next);
  }

  // Coordenadas en píxeles del canvas (corrigiendo el zoom de la vista).
  function getPos(e: React.PointerEvent): { x: number; y: number } {
    const r = displayRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * (size?.w ?? 0),
      y: ((e.clientY - r.top) / r.height) * (size?.h ?? 0),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!activeLayer || !size) return;
    const p = getPos(e);
    startPt.current = p;
    lastPt.current = p;
    drawing.current = true;

    if (tool === "eyedrop") {
      const ctx = displayRef.current!.getContext("2d")!;
      const d = ctx.getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data;
      setColor(`#${[d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, "0")).join("")}`);
      drawing.current = false;
      return;
    }

    if (tool === "text") {
      const text = window.prompt("Texto a insertar:");
      drawing.current = false;
      if (!text) return;
      pushHistory();
      const ctx = activeLayer.canvas.getContext("2d")!;
      ctx.fillStyle = color;
      ctx.font = `${Math.max(16, brushSize * 3)}px Inter, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(text, p.x, p.y);
      composite();
      return;
    }

    if (tool === "brush" || tool === "eraser") {
      pushHistory();
      const ctx = activeLayer.canvas.getContext("2d")!;
      ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.arc(p.x, p.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      composite();
    } else if (tool === "rect" || tool === "ellipse") {
      pushHistory();
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drawing.current || !activeLayer || !size) return;
    const p = getPos(e);

    if (tool === "brush" || tool === "eraser") {
      const ctx = activeLayer.canvas.getContext("2d")!;
      ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(lastPt.current!.x, lastPt.current!.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastPt.current = p;
      composite();
    } else if ((tool === "rect" || tool === "ellipse") && startPt.current) {
      // Vista previa en overlay
      const o = overlayRef.current!;
      const ctx = o.getContext("2d")!;
      ctx.clearRect(0, 0, o.width, o.height);
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      const x = Math.min(startPt.current.x, p.x);
      const y = Math.min(startPt.current.y, p.y);
      const w = Math.abs(p.x - startPt.current.x);
      const h = Math.abs(p.y - startPt.current.y);
      if (tool === "rect") {
        ctx.strokeRect(x, y, w, h);
      } else {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!drawing.current || !activeLayer || !size) {
      drawing.current = false;
      return;
    }
    const p = getPos(e);
    if ((tool === "rect" || tool === "ellipse") && startPt.current) {
      const ctx = activeLayer.canvas.getContext("2d")!;
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      const x = Math.min(startPt.current.x, p.x);
      const y = Math.min(startPt.current.y, p.y);
      const w = Math.abs(p.x - startPt.current.x);
      const h = Math.abs(p.y - startPt.current.y);
      if (tool === "rect") {
        ctx.strokeRect(x, y, w, h);
      } else {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      const o = overlayRef.current!;
      o.getContext("2d")!.clearRect(0, 0, o.width, o.height);
      composite();
    }
    drawing.current = false;
    startPt.current = null;
    lastPt.current = null;
  }

  function addEmptyLayer() {
    if (!size) return;
    const l: Layer = {
      id: crypto.randomUUID(),
      name: `Capa ${layers.length + 1}`,
      canvas: newCanvas(size.w, size.h),
      visible: true,
      opacity: 1,
      adjust: { ...ZERO_ADJ },
    };
    setLayers((p) => [...p, l]);
    setActiveId(l.id);
  }

  async function addImageLayer(file: File) {
    if (!size) return;
    const url = await fileToDataUrl(file);
    const img = await loadImage(url);
    const c = newCanvas(size.w, size.h);
    c.getContext("2d")!.drawImage(img, 0, 0, Math.min(img.width, size.w), Math.min(img.height, size.h));
    const l: Layer = {
      id: crypto.randomUUID(),
      name: file.name,
      canvas: c,
      visible: true,
      opacity: 1,
      adjust: { ...ZERO_ADJ },
    };
    setLayers((p) => [...p, l]);
    setActiveId(l.id);
  }

  function deleteLayer(id: string) {
    setLayers((p) => p.filter((l) => l.id !== id));
    if (activeId === id) setActiveId(layers[0]?.id ?? null);
  }

  function moveLayer(id: string, dir: -1 | 1) {
    setLayers((p) => {
      const idx = p.findIndex((l) => l.id === id);
      if (idx < 0) return p;
      const j = idx + dir;
      if (j < 0 || j >= p.length) return p;
      const cp = [...p];
      [cp[idx], cp[j]] = [cp[j], cp[idx]];
      return cp;
    });
  }

  function updateLayer(id: string, patch: Partial<Layer>) {
    setLayers((p) => p.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function updateAdjust(id: string, patch: Partial<Adjustments>) {
    setLayers((p) => p.map((l) => (l.id === id ? { ...l, adjust: { ...l.adjust, ...patch } } : l)));
  }

  function exportImage(format: Format) {
    if (!displayRef.current || !size) return;
    // Renderiza sin la cuadrícula de transparencia: usar un canvas limpio.
    const out = newCanvas(size.w, size.h);
    const ctx = out.getContext("2d")!;
    if (format === "jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size.w, size.h);
    }
    for (const l of layers) {
      if (!l.visible) continue;
      ctx.save();
      ctx.globalAlpha = l.opacity;
      ctx.filter = filterStr(l.adjust);
      ctx.drawImage(l.canvas, 0, 0);
      ctx.restore();
    }
    const url = out.toDataURL(`image/${format}`, 0.95);
    downloadDataUrl(url, `editor-${Date.now()}.${format === "jpeg" ? "jpg" : format}`);
    toast.success(`Exportado como ${format.toUpperCase()}`);
  }

  // Atajos de teclado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (!e.ctrlKey && !e.metaKey) {
        const map: Record<string, Tool> = { v: "move", b: "brush", e: "eraser", r: "rect", o: "ellipse", t: "text", i: "eyedrop" };
        if (map[e.key]) setTool(map[e.key]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [history, future]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!size) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader title="Editor de imagen" description="Mini editor con capas, herramientas, ajustes y exportación." />
        <ImageDropzone onFiles={(f) => handleInitial(f[0].dataUrl)} hint="Arrastra una imagen para empezar a editar" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <PageHeader
        title="Editor de imagen"
        description={`${size.w} × ${size.h}px · ${layers.length} capa${layers.length === 1 ? "" : "s"}`}
        actions={
          <div className="flex items-center gap-2">
            <Select onValueChange={(v) => exportImage(v as Format)}>
              <SelectTrigger className="w-36">
                <Download className="mr-1 h-4 w-4" />
                <SelectValue placeholder="Exportar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="jpeg">JPG</SelectItem>
                <SelectItem value="webp">WEBP</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setSize(null); setLayers([]); setActiveId(null); }}>
              Nueva imagen
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[64px_1fr_300px]">
        {/* Barra de herramientas */}
        <div className="flex h-fit flex-col gap-1 rounded-xl border border-border bg-card p-2">
          <ToolBtn icon={Move} active={tool === "move"} onClick={() => setTool("move")} label="Mover (V)" />
          <ToolBtn icon={Brush} active={tool === "brush"} onClick={() => setTool("brush")} label="Pincel (B)" />
          <ToolBtn icon={Eraser} active={tool === "eraser"} onClick={() => setTool("eraser")} label="Borrador (E)" />
          <ToolBtn icon={Square} active={tool === "rect"} onClick={() => setTool("rect")} label="Rectángulo (R)" />
          <ToolBtn icon={CircleIcon} active={tool === "ellipse"} onClick={() => setTool("ellipse")} label="Elipse (O)" />
          <ToolBtn icon={TypeIcon} active={tool === "text"} onClick={() => setTool("text")} label="Texto (T)" />
          <ToolBtn icon={Pipette} active={tool === "eyedrop"} onClick={() => setTool("eyedrop")} label="Cuentagotas (I)" />
          <div className="my-1 h-px bg-border" />
          <ToolBtn icon={Undo2} onClick={undo} label="Deshacer" />
          <ToolBtn icon={Redo2} onClick={redo} label="Rehacer" />
        </div>

        {/* Lienzo */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-2 text-sm">
            <Label className="flex items-center gap-2">
              Color
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
              />
            </Label>
            <div className="flex min-w-[180px] items-center gap-2">
              <span className="text-muted-foreground">Tamaño</span>
              <Slider value={[brushSize]} min={1} max={120} step={1} onValueChange={(v) => setBrushSize(v[0])} />
              <span className="w-8 text-right tabular-nums">{brushSize}</span>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
              <Button size="icon" variant="ghost" onClick={() => setZoom((z) => Math.min(4, z + 0.1))}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="relative overflow-auto rounded-xl border border-border bg-muted/30 p-4" style={{ maxHeight: "70vh" }}>
            <div
              className="relative mx-auto"
              style={{ width: size.w * zoom, height: size.h * zoom }}
            >
              <canvas
                ref={displayRef}
                width={size.w}
                height={size.h}
                className="absolute inset-0 h-full w-full shadow-lg"
              />
              <canvas
                ref={overlayRef}
                width={size.w}
                height={size.h}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                className={cn(
                  "absolute inset-0 h-full w-full touch-none",
                  tool === "eyedrop" ? "cursor-cell" : "cursor-crosshair",
                )}
              />
            </div>
          </div>
        </div>

        {/* Panel lateral */}
        <div className="space-y-3">
          <Tabs defaultValue="layers">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="layers">Capas</TabsTrigger>
              <TabsTrigger value="adjust">Ajustes</TabsTrigger>
            </TabsList>

            <TabsContent value="layers" className="space-y-2">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={addEmptyLayer} className="flex-1">
                  <Plus className="h-4 w-4" /> Nueva capa
                </Button>
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-sm hover:bg-accent">
                  <ImageIcon className="h-4 w-4" />
                  Imagen
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && addImageLayer(e.target.files[0])}
                  />
                </label>
              </div>

              <div className="space-y-1 rounded-lg border border-border bg-card p-1">
                {[...layers].reverse().map((l) => (
                  <div
                    key={l.id}
                    onClick={() => setActiveId(l.id)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                      activeId === l.id ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-accent",
                    )}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); updateLayer(l.id, { visible: !l.visible }); }}
                      className="text-muted-foreground"
                    >
                      {l.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <Input
                      value={l.name}
                      onChange={(e) => updateLayer(l.id, { name: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 flex-1 border-0 bg-transparent px-1 text-sm focus-visible:ring-0"
                    />
                    <button onClick={(e) => { e.stopPropagation(); moveLayer(l.id, 1); }} className="text-muted-foreground">
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); moveLayer(l.id, -1); }} className="text-muted-foreground">
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteLayer(l.id); }} className="text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>

              {activeLayer && (
                <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                  <Label className="text-xs text-muted-foreground">Opacidad</Label>
                  <Slider
                    value={[activeLayer.opacity * 100]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(v) => updateLayer(activeLayer.id, { opacity: v[0] / 100 })}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="adjust" className="space-y-3">
              {activeLayer ? (
                <div className="space-y-3 rounded-lg border border-border bg-card p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Ajustes para « {activeLayer.name} »</p>
                  {([
                    ["brightness", "Brillo", 0, 200],
                    ["contrast", "Contraste", 0, 200],
                    ["saturation", "Saturación", 0, 200],
                    ["hue", "Tono", -180, 180],
                    ["blur", "Desenfoque", 0, 20],
                  ] as Array<[keyof Adjustments, string, number, number]>).map(([k, lbl, min, max]) => (
                    <div key={k}>
                      <div className="mb-1 flex justify-between">
                        <span>{lbl}</span>
                        <span className="tabular-nums text-muted-foreground">{activeLayer.adjust[k]}</span>
                      </div>
                      <Slider
                        value={[activeLayer.adjust[k]]}
                        min={min}
                        max={max}
                        step={1}
                        onValueChange={(v) => updateAdjust(activeLayer.id, { [k]: v[0] } as Partial<Adjustments>)}
                      />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => updateLayer(activeLayer.id, { adjust: { ...ZERO_ADJ } })}
                  >
                    Restablecer
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Selecciona una capa.</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function ToolBtn({
  icon: Icon,
  active,
  onClick,
  label,
}: {
  icon: typeof Move;
  active?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-md transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
