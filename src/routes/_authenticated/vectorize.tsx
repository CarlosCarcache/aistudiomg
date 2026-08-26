import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Brush,
  Copy,
  CopyPlus,
  Download,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Maximize2,
  MousePointer2,
  Pipette,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import ImageTracer from "imagetracerjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImageDropzone } from "@/components/image-dropzone";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadDataUrl, loadImage } from "@/lib/image-utils";
import { PageHeader } from "@/views/PageHeader";

export const Route = createFileRoute("/_authenticated/vectorize")({
  head: () => ({
    meta: [
      { title: "Editor vectorial por capas | AI Studio MG" },
      { name: "description", content: "Vectoriza imágenes y edita cada forma, color y posición de manera independiente." },
      { property: "og:title", content: "Editor vectorial por capas | AI Studio MG" },
      { property: "og:description", content: "Vectoriza imágenes y edita cada forma, color y posición de manera independiente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VectorizePage,
});

type VectorTag = "path" | "polygon" | "polyline" | "rect" | "circle" | "ellipse";
type VectorShape = {
  id: string;
  tag: VectorTag;
  attrs: Record<string, string>;
  x: number;
  y: number;
  visible: boolean;
  blendMode: BlendMode;
};
type Snapshot = { shapes: VectorShape[]; selectedId: string | null };
type ExportFormat = "svg" | "png";
type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten";

const VECTOR_TAGS = new Set<VectorTag>(["path", "polygon", "polyline", "rect", "circle", "ellipse"]);
const COLOR_SWATCHES = ["#000000", "#333333", "#666666", "#999999", "#cccccc", "#ffffff", "#ec4899", "#a855f7"];

function cloneShapes(shapes: VectorShape[]) {
  return shapes.map((shape) => ({ ...shape, attrs: { ...shape.attrs } }));
}

function colorToHex(color?: string) {
  if (!color) return "#000000";
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(color)) return `#${color.slice(1).split("").map((part) => part + part).join("")}`.toLowerCase();
  const rgb = color.match(/rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i);
  if (!rgb) return "#000000";
  return `#${[rgb[1], rgb[2], rgb[3]].map((part) => Math.min(255, Number(part)).toString(16).padStart(2, "0")).join("")}`;
}

function hexToHsv(hex: string) {
  const value = colorToHex(hex);
  const r = Number.parseInt(value.slice(1, 3), 16) / 255;
  const g = Number.parseInt(value.slice(3, 5), 16) / 255;
  const b = Number.parseInt(value.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  return { h: h < 0 ? h + 360 : h, s: max ? delta / max : 0, v: max };
}

function hsvToHex(h: number, s: number, v: number) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const sector = Math.floor(h / 60) % 6;
  const [r, g, b] = sector === 0 ? [c, x, 0] : sector === 1 ? [x, c, 0] : sector === 2 ? [0, c, x] : sector === 3 ? [0, x, c] : sector === 4 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((part) => Math.round((part + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function parseVector(svgText: string) {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const root = doc.documentElement;
  const viewBox = root.getAttribute("viewBox") ?? `0 0 ${root.getAttribute("width") ?? 1024} ${root.getAttribute("height") ?? 1024}`;
  const shapes: VectorShape[] = [];

  root.querySelectorAll("path, polygon, polyline, rect, circle, ellipse").forEach((node, index) => {
    const tag = node.tagName.toLowerCase() as VectorTag;
    if (!VECTOR_TAGS.has(tag)) return;
    const attrs: Record<string, string> = {};
    Array.from(node.attributes).forEach((attribute) => {
      if (attribute.name !== "transform") attrs[attribute.name] = attribute.value;
    });
    shapes.push({ id: `forma-${index + 1}`, tag, attrs, x: 0, y: 0, visible: true, blendMode: "normal" });
  });

  return { shapes, viewBox };
}

function escapeAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function serializeSvg(shapes: VectorShape[], viewBox: string) {
  const body = shapes
    .filter((shape) => shape.visible)
    .map((shape) => {
      const attrs = Object.entries(shape.attrs)
        .map(([key, value]) => `${key}="${escapeAttribute(value)}"`)
        .join(" ");
      const blend = shape.blendMode === "normal" ? "" : ` style="mix-blend-mode:${shape.blendMode}"`;
      return `<${shape.tag} ${attrs} transform="translate(${shape.x} ${shape.y})"${blend}/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${escapeAttribute(viewBox)}">${body}</svg>`;
}

function VectorizePage() {
  const [source, setSource] = useState<string | null>(null);
  const [shapes, setShapes] = useState<VectorShape[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState("0 0 1024 1024");
  const [colors, setColors] = useState(16);
  const [detail, setDetail] = useState(1);
  const [smoothing, setSmoothing] = useState(1);
  const [omit, setOmit] = useState(4);
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("svg");
  const [pngScale, setPngScale] = useState(4);
  const [activeTab, setActiveTab] = useState("source");
  const [zoom, setZoom] = useState(1);
  const [zoomOffset, setZoomOffset] = useState({ x: 0, y: 0 });
  const [historyVersion, setHistoryVersion] = useState(0);
  const [eyedropperTargetId, setEyedropperTargetId] = useState<string | null>(null);
  const historyRef = useRef<Snapshot[]>([]);
  const redoRef = useRef<Snapshot[]>([]);
  const clipboardRef = useRef<VectorShape | null>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef({ zoom, offset: zoomOffset });

  const selected = useMemo(() => shapes.find((shape) => shape.id === selectedId) ?? null, [shapes, selectedId]);

  useEffect(() => {
    if (!selectedId && shapes.length) setSelectedId(shapes[shapes.length - 1].id);
  }, [selectedId, shapes]);

  useEffect(() => {
    zoomRef.current = { zoom, offset: zoomOffset };
  }, [zoom, zoomOffset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const current = zoomRef.current;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      const nextZoom = Math.min(8, Math.max(0.25, current.zoom * Math.exp(-delta * 0.0015)));
      const rect = canvas.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const factor = nextZoom / current.zoom;
      setZoomOffset({ x: px - (px - current.offset.x) * factor, y: py - (py - current.offset.y) * factor });
      setZoom(nextZoom);
    };
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

  function saveHistory() {
    historyRef.current.push({ shapes: cloneShapes(shapes), selectedId });
    if (historyRef.current.length > 40) historyRef.current.shift();
    redoRef.current = [];
    setHistoryVersion((value) => value + 1);
  }

  function undo() {
    const snapshot = historyRef.current.pop();
    if (!snapshot) return;
    redoRef.current.push({ shapes: cloneShapes(shapes), selectedId });
    setShapes(snapshot.shapes);
    setSelectedId(snapshot.selectedId);
    setEyedropperTargetId(null);
    setHistoryVersion((value) => value + 1);
  }

  function redo() {
    const snapshot = redoRef.current.pop();
    if (!snapshot) return;
    historyRef.current.push({ shapes: cloneShapes(shapes), selectedId });
    setShapes(snapshot.shapes);
    setSelectedId(snapshot.selectedId);
    setEyedropperTargetId(null);
    setHistoryVersion((value) => value + 1);
  }

  async function vectorize() {
    if (!source) return;
    setLoading(true);
    try {
      const image = await loadImage(source);
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No se pudo preparar la imagen");
      context.drawImage(image, 0, 0);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const traced = ImageTracer.imagedataToSVG(imageData, {
        numberofcolors: colors,
        ltres: detail,
        qtres: smoothing,
        pathomit: omit,
        strokewidth: 0,
      });
      const parsed = parseVector(traced);
      if (!parsed.shapes.length) throw new Error("No se detectaron formas en la imagen");
      historyRef.current = [];
      redoRef.current = [];
      setShapes(parsed.shapes);
      setViewBox(parsed.viewBox);
      setSelectedId(parsed.shapes[parsed.shapes.length - 1].id);
      setActiveTab("vector");
      toast.success(`${parsed.shapes.length} partes vectoriales creadas`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo vectorizar");
    } finally {
      setLoading(false);
    }
  }

  function updateShape(id: string, update: Partial<VectorShape>) {
    setShapes((current) => current.map((shape) => (shape.id === id ? { ...shape, ...update } : shape)));
  }

  function changeColor(color: string) {
    if (!selected) return;
    saveHistory();
    updateShape(selected.id, { attrs: { ...selected.attrs, fill: color } });
  }

  function changeHsv(channel: "h" | "v", value: number) {
    if (!selected) return;
    const hsv = hexToHsv(selected.attrs.fill);
    const fill = hsvToHex(channel === "h" ? value : hsv.h, hsv.s, channel === "v" ? value / 100 : hsv.v);
    updateShape(selected.id, { attrs: { ...selected.attrs, fill } });
  }

  function changeAttribute(attribute: string, value: string) {
    if (!selected) return;
    updateShape(selected.id, { attrs: { ...selected.attrs, [attribute]: value } });
  }

  function duplicateSelected() {
    if (!selected) return;
    saveHistory();
    const copy = { ...selected, id: `forma-${Date.now()}`, attrs: { ...selected.attrs }, x: selected.x + 12, y: selected.y + 12 };
    setShapes((current) => [...current, copy]);
    setSelectedId(copy.id);
  }

  async function copySelected() {
    if (!selected) return;
    clipboardRef.current = { ...selected, attrs: { ...selected.attrs } };
    const svg = serializeSvg([{ ...selected, x: 0, y: 0 }], viewBox);
    try {
      await navigator.clipboard.writeText(svg);
      toast.success("Forma copiada como SVG");
    } catch {
      toast.success("Forma copiada en el editor");
    }
  }

  function sampleColor(event: React.PointerEvent<SVGGElement>, shape: VectorShape) {
    if (!eyedropperTargetId) return false;
    event.stopPropagation();
    const target = shapes.find((item) => item.id === eyedropperTargetId);
    if (target) {
      saveHistory();
      updateShape(target.id, { attrs: { ...target.attrs, fill: colorToHex(shape.attrs.fill) } });
      setSelectedId(target.id);
      toast.success("Color aplicado");
    }
    setEyedropperTargetId(null);
    return true;
  }

  function setCanvasZoom(nextZoom: number) {
    const canvas = canvasRef.current;
    const current = zoomRef.current;
    const bounded = Math.min(8, Math.max(0.25, nextZoom));
    if (!canvas) {
      setZoom(bounded);
      return;
    }
    const px = canvas.clientWidth / 2;
    const py = canvas.clientHeight / 2;
    const factor = bounded / current.zoom;
    setZoomOffset({ x: px - (px - current.offset.x) * factor, y: py - (py - current.offset.y) * factor });
    setZoom(bounded);
  }

  function fitCanvas() {
    setZoom(1);
    setZoomOffset({ x: 0, y: 0 });
  }

  function removeSelected() {
    if (!selectedId) return;
    saveHistory();
    setShapes((current) => current.filter((shape) => shape.id !== selectedId));
    setSelectedId(null);
  }

  function toggleVisibility(id: string) {
    const shape = shapes.find((item) => item.id === id);
    if (!shape) return;
    saveHistory();
    updateShape(id, { visible: !shape.visible });
  }

  function pointerPosition(event: React.PointerEvent<SVGElement>) {
    const svg = svgRef.current;
    if (!svg) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM()?.inverse();
    if (!matrix) return null;
    return point.matrixTransform(matrix);
  }

  function startDrag(event: React.PointerEvent<SVGGElement>, shape: VectorShape) {
    event.stopPropagation();
    if (sampleColor(event, shape)) return;
    const point = pointerPosition(event);
    if (!point) return;
    saveHistory();
    setSelectedId(shape.id);
    dragRef.current = { id: shape.id, startX: point.x, startY: point.y, originX: shape.x, originY: shape.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    const point = pointerPosition(event);
    if (!drag || !point) return;
    updateShape(drag.id, { x: drag.originX + point.x - drag.startX, y: drag.originY + point.y - drag.startY });
  }

  function stopDrag(event: React.PointerEvent<SVGSVGElement>) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function resetPosition() {
    if (!selected) return;
    saveHistory();
    updateShape(selected.id, { x: 0, y: 0 });
  }

  async function download() {
    if (!shapes.length) return;
    const svgText = serializeSvg(shapes, viewBox);
    const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
    if (format === "svg") {
      downloadDataUrl(svgUrl, `vector-editable-${Date.now()}.svg`);
      return;
    }
    const values = viewBox.trim().split(/\s+/).map(Number);
    const width = values[2] || 1024;
    const height = values[3] || 1024;
    const image = await loadImage(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * pngScale);
    canvas.height = Math.round(height * pngScale);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    downloadDataUrl(canvas.toDataURL("image/png"), `vector-${pngScale}x-${Date.now()}.png`);
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageHeader title="Vectorizar por partes" description="Convierte la imagen en formas independientes y edita cada pieza sin perder calidad." />

      <div className="grid min-h-[620px] gap-4 xl:grid-cols-[300px_minmax(0,1fr)_280px]">
        <aside className="space-y-4 rounded-lg border border-border bg-card p-4">
          <ImageDropzone
            preview={source}
            onClear={() => {
              setSource(null);
              setShapes([]);
              setSelectedId(null);
              setActiveTab("source");
            }}
            onFiles={(files) => {
              const first = files[0];
              if (!first) return;
              setSource(first.dataUrl);
              setShapes([]);
              setActiveTab("source");
            }}
            className="min-h-40"
          />

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Wand2 className="h-4 w-4 text-primary" /> Vectorización</div>
            <Control label="Cantidad de colores" value={colors}><Slider value={[colors]} min={2} max={48} step={1} onValueChange={(value) => setColors(value[0] ?? 16)} /></Control>
            <Control label="Detalle de contorno" value={detail}><Slider value={[detail]} min={0.1} max={3} step={0.1} onValueChange={(value) => setDetail(value[0] ?? 1)} /></Control>
            <Control label="Suavizado" value={smoothing}><Slider value={[smoothing]} min={0.1} max={3} step={0.1} onValueChange={(value) => setSmoothing(value[0] ?? 1)} /></Control>
            <Control label="Omitir puntos pequeños" value={omit}><Slider value={[omit]} min={0} max={30} step={1} onValueChange={(value) => setOmit(value[0] ?? 4)} /></Control>
            <Button className="w-full" disabled={!source || loading} onClick={vectorize}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {shapes.length ? "Volver a vectorizar" : "Vectorizar imagen"}
            </Button>
          </section>

          <section className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-semibold">Exportación</p>
            <div className="flex gap-2">
              <Select value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="svg">SVG editable</SelectItem><SelectItem value="png">PNG</SelectItem></SelectContent>
              </Select>
              {format === "png" && (
                <Select value={String(pngScale)} onValueChange={(value) => setPngScale(Number(value))}>
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4].map((scale) => <SelectItem key={scale} value={String(scale)}>{scale}x</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <Button variant="secondary" className="w-full" disabled={!shapes.length} onClick={download}><Download className="h-4 w-4" /> Descargar</Button>
          </section>
        </aside>

        <main className="min-w-0 rounded-lg border border-border bg-card/40 p-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between gap-3">
              <TabsList><TabsTrigger value="source">Original</TabsTrigger><TabsTrigger value="vector" disabled={!shapes.length}>Vector editable</TabsTrigger></TabsList>
              <div className="flex flex-wrap justify-end gap-1">
                <Button size="icon" variant="ghost" onClick={undo} disabled={!historyRef.current.length || historyVersion < 0} title="Deshacer"><Undo2 className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={redo} disabled={!redoRef.current.length || historyVersion < 0} title="Rehacer"><Redo2 className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={copySelected} disabled={!selected} title="Copiar como SVG"><Copy className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={duplicateSelected} disabled={!selected} title="Duplicar forma"><CopyPlus className="h-4 w-4" /></Button>
                <Button size="icon" variant={eyedropperTargetId ? "secondary" : "ghost"} onClick={() => setEyedropperTargetId(selected?.id ?? null)} disabled={!selected} title="Tomar color de otra forma"><Pipette className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={removeSelected} disabled={!selected} title="Eliminar forma"><Trash2 className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => { setSelectedId(null); setEyedropperTargetId(null); }} disabled={!selected} title="Deseleccionar"><X className="h-4 w-4" /></Button>
              </div>
            </div>

            <TabsContent value="source" className="mt-3">
              <CanvasSurface>{source ? <img src={source} alt="Imagen original para vectorizar" className="max-h-[650px] max-w-full object-contain" /> : <EmptyCanvas />}</CanvasSurface>
            </TabsContent>

            <TabsContent value="vector" className="mt-3">
              <div className="relative">
                <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-md border border-border bg-card p-1 shadow-sm">
                  <Button size="icon" variant="ghost" onClick={() => setCanvasZoom(zoom / 1.25)} title="Alejar"><ZoomOut className="h-4 w-4" /></Button>
                  <span className="w-14 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
                  <Button size="icon" variant="ghost" onClick={() => setCanvasZoom(zoom * 1.25)} title="Acercar"><ZoomIn className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={fitCanvas} title="Ajustar al lienzo"><Maximize2 className="h-4 w-4" /></Button>
                </div>
                <CanvasSurface ref={canvasRef}>
                  <div className="grid h-full w-full place-items-center" style={{ transform: `translate(${zoomOffset.x}px, ${zoomOffset.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
                    <svg
                      ref={svgRef}
                      viewBox={viewBox}
                      className={`h-full max-h-[650px] w-full touch-none select-none ${eyedropperTargetId ? "cursor-crosshair" : ""}`}
                      onPointerMove={moveDrag}
                      onPointerUp={stopDrag}
                      onPointerCancel={stopDrag}
                      onPointerDown={() => { if (!eyedropperTargetId) setSelectedId(null); }}
                      aria-label="Lienzo vectorial editable"
                    >
                      {shapes.map((shape) => {
                        if (!shape.visible) return null;
                        const isSelected = selectedId === shape.id;
                        return (
                          <g key={shape.id} transform={`translate(${shape.x} ${shape.y})`} onPointerDown={(event) => startDrag(event, shape)} className={eyedropperTargetId ? "cursor-crosshair" : "cursor-move"} style={{ mixBlendMode: shape.blendMode }}>
                            {isSelected && <SelectedOutline shape={shape} />}
                            <VectorElement shape={shape} />
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </CanvasSurface>
              </div>
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><MousePointer2 className="h-3.5 w-3.5" /> Selecciona y arrastra cualquier parte. El SVG conserva calidad a cualquier tamaño.</p>
            </TabsContent>
          </Tabs>
        </main>

        <aside className="min-w-0 rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div><p className="font-semibold">Partes</p><p className="text-xs text-muted-foreground">{shapes.length} formas separadas</p></div>
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>

          {selected ? (
            <section className="mb-4 space-y-3 border-b border-border pb-4">
              <p className="truncate text-sm font-medium">{selected.id}</p>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Color de relleno</p>
                <div className="grid grid-cols-8 gap-1">
                  {COLOR_SWATCHES.map((color) => <button key={color} type="button" aria-label={`Aplicar color ${color}`} title={color} className="aspect-square rounded-sm border border-border" style={{ backgroundColor: color }} onClick={() => changeColor(color)} />)}
                </div>
              </div>
              <div className="grid grid-cols-[1fr_44px] items-center gap-2">
                <label htmlFor="shape-color" className="flex items-center gap-2 text-sm text-muted-foreground"><Brush className="h-4 w-4" /> Color de la parte</label>
                <Input id="shape-color" type="color" value={colorToHex(selected.attrs.fill)} onChange={(event) => changeColor(event.target.value)} className="h-9 cursor-pointer p-1" />
              </div>
              <Control label="Matiz HSB" value={Math.round(hexToHsv(selected.attrs.fill).h)}><Slider value={[hexToHsv(selected.attrs.fill).h]} min={0} max={360} step={1} onPointerDown={saveHistory} onValueChange={(value) => changeHsv("h", value[0] ?? 0)} /></Control>
              <Control label="Brillo" value={Math.round(hexToHsv(selected.attrs.fill).v * 100)}><Slider value={[hexToHsv(selected.attrs.fill).v * 100]} min={0} max={100} step={1} onPointerDown={saveHistory} onValueChange={(value) => changeHsv("v", value[0] ?? 0)} /></Control>
              <Control label="Opacidad" value={Math.round(Number(selected.attrs.opacity ?? 1) * 100)}><Slider value={[Number(selected.attrs.opacity ?? 1) * 100]} min={0} max={100} step={1} onPointerDown={saveHistory} onValueChange={(value) => changeAttribute("opacity", String((value[0] ?? 100) / 100))} /></Control>
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground">Contorno</p>
                <div className="grid grid-cols-[1fr_44px] items-center gap-2">
                  <label htmlFor="stroke-color" className="text-sm text-muted-foreground">Color</label>
                  <Input id="stroke-color" type="color" value={colorToHex(selected.attrs.stroke)} onFocus={saveHistory} onChange={(event) => changeAttribute("stroke", event.target.value)} className="h-9 cursor-pointer p-1" />
                </div>
                <Control label="Grosor" value={Number(selected.attrs["stroke-width"] ?? 0)}><Slider value={[Number(selected.attrs["stroke-width"] ?? 0)]} min={0} max={30} step={0.5} onPointerDown={saveHistory} onValueChange={(value) => changeAttribute("stroke-width", String(value[0] ?? 0))} /></Control>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="blend-mode">Modo de mezcla</label>
                <Select value={selected.blendMode} onValueChange={(value) => { saveHistory(); updateShape(selected.id, { blendMode: value as BlendMode }); }}>
                  <SelectTrigger id="blend-mode" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="multiply">Multiplicar</SelectItem><SelectItem value="screen">Trama</SelectItem><SelectItem value="overlay">Superponer</SelectItem><SelectItem value="darken">Oscurecer</SelectItem><SelectItem value="lighten">Aclarar</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label htmlFor="position-x" className="text-xs text-muted-foreground">Posición X</label><Input id="position-x" type="number" value={Math.round(selected.x)} onFocus={saveHistory} onChange={(event) => updateShape(selected.id, { x: Number(event.target.value) })} /></div>
                <div><label htmlFor="position-y" className="text-xs text-muted-foreground">Posición Y</label><Input id="position-y" type="number" value={Math.round(selected.y)} onFocus={saveHistory} onChange={(event) => updateShape(selected.id, { y: Number(event.target.value) })} /></div>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={resetPosition}><RotateCcw className="h-4 w-4" /> Restablecer posición</Button>
            </section>
          ) : <p className="mb-4 border-b border-border pb-4 text-sm text-muted-foreground">Selecciona una forma para editarla.</p>}

          <ScrollArea className="h-[410px] pr-3">
            <div className="space-y-1">
              {[...shapes].reverse().map((shape) => (
                <div key={shape.id} className={`flex items-center gap-2 rounded-md border px-2 py-2 ${selectedId === shape.id ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted/60"}`}>
                  <button type="button" className="min-w-0 flex-1 truncate text-left text-sm" onClick={() => setSelectedId(shape.id)}>{shape.id}</button>
                  <span className="h-4 w-4 shrink-0 rounded-sm border border-border" style={{ backgroundColor: shape.attrs.fill ?? "transparent" }} />
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => toggleVisibility(shape.id)} title={shape.visible ? "Ocultar" : "Mostrar"}>
                    {shape.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}

function VectorElement({ shape }: { shape: VectorShape }) {
  const props = { ...shape.attrs, vectorEffect: "non-scaling-stroke" };
  switch (shape.tag) {
    case "path": return <path {...props} />;
    case "polygon": return <polygon {...props} />;
    case "polyline": return <polyline {...props} />;
    case "rect": return <rect {...props} />;
    case "circle": return <circle {...props} />;
    case "ellipse": return <ellipse {...props} />;
  }
}

function SelectedOutline({ shape }: { shape: VectorShape }) {
  const props = { ...shape.attrs, fill: "none", stroke: "currentColor", strokeWidth: "2", vectorEffect: "non-scaling-stroke", className: "text-primary pointer-events-none" };
  switch (shape.tag) {
    case "path": return <path {...props} />;
    case "polygon": return <polygon {...props} />;
    case "polyline": return <polyline {...props} />;
    case "rect": return <rect {...props} />;
    case "circle": return <circle {...props} />;
    case "ellipse": return <ellipse {...props} />;
  }
}

function Control({ label, value, children }: { label: string; value: number; children: React.ReactNode }) {
  return <div className="space-y-2"><div className="flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="tabular-nums">{value}</span></div>{children}</div>;
}

const CanvasSurface = ({ children, ref }: { children: React.ReactNode; ref?: React.Ref<HTMLDivElement> }) => {
  return <div ref={ref} className="grid h-[min(650px,68vh)] min-h-[460px] place-items-center overflow-hidden rounded-md border border-border bg-[linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%),linear-gradient(-45deg,hsl(var(--muted))_25%,transparent_25%),linear-gradient(45deg,transparent_75%,hsl(var(--muted))_75%),linear-gradient(-45deg,transparent_75%,hsl(var(--muted))_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0] p-3">{children}</div>;
}

function EmptyCanvas() {
  return <div className="text-center text-sm text-muted-foreground"><Wand2 className="mx-auto mb-2 h-10 w-10" /><p>Sube una imagen para comenzar.</p></div>;
}