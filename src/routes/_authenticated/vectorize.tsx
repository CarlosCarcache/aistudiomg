import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Brush,
  Download,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  MousePointer2,
  RotateCcw,
  Trash2,
  Undo2,
  Wand2,
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
};
type Snapshot = { shapes: VectorShape[]; selectedId: string | null };
type ExportFormat = "svg" | "png";

const VECTOR_TAGS = new Set<VectorTag>(["path", "polygon", "polyline", "rect", "circle", "ellipse"]);

function cloneShapes(shapes: VectorShape[]) {
  return shapes.map((shape) => ({ ...shape, attrs: { ...shape.attrs } }));
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
    shapes.push({ id: `forma-${index + 1}`, tag, attrs, x: 0, y: 0, visible: true });
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
      return `<${shape.tag} ${attrs} transform="translate(${shape.x} ${shape.y})"/>`;
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
  const historyRef = useRef<Snapshot[]>([]);
  const dragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const selected = useMemo(() => shapes.find((shape) => shape.id === selectedId) ?? null, [shapes, selectedId]);

  useEffect(() => {
    if (!selectedId && shapes.length) setSelectedId(shapes[shapes.length - 1].id);
  }, [selectedId, shapes]);

  function saveHistory() {
    historyRef.current.push({ shapes: cloneShapes(shapes), selectedId });
    if (historyRef.current.length > 40) historyRef.current.shift();
  }

  function undo() {
    const snapshot = historyRef.current.pop();
    if (!snapshot) return;
    setShapes(snapshot.shapes);
    setSelectedId(snapshot.selectedId);
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

  function pointerPosition(event: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM()?.inverse();
    if (!matrix) return null;
    return point.matrixTransform(matrix);
  }

  function startDrag(event: React.PointerEvent<SVGSVGElement>, shape: VectorShape) {
    event.stopPropagation();
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
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={undo} disabled={!historyRef.current.length} title="Deshacer"><Undo2 className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={removeSelected} disabled={!selected} title="Eliminar forma"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>

            <TabsContent value="source" className="mt-3">
              <CanvasSurface>{source ? <img src={source} alt="Imagen original para vectorizar" className="max-h-[650px] max-w-full object-contain" /> : <EmptyCanvas />}</CanvasSurface>
            </TabsContent>

            <TabsContent value="vector" className="mt-3">
              <CanvasSurface>
                <svg
                  ref={svgRef}
                  viewBox={viewBox}
                  className="h-full max-h-[650px] w-full touch-none select-none"
                  onPointerMove={moveDrag}
                  onPointerUp={stopDrag}
                  onPointerCancel={stopDrag}
                  onPointerDown={() => setSelectedId(null)}
                  aria-label="Lienzo vectorial editable"
                >
                  {shapes.map((shape) => {
                    if (!shape.visible) return null;
                    const isSelected = selectedId === shape.id;
                    return (
                      <g key={shape.id} transform={`translate(${shape.x} ${shape.y})`} onPointerDown={(event) => startDrag(event, shape)} className="cursor-move">
                        {isSelected && <SelectedOutline shape={shape} />}
                        <VectorElement shape={shape} />
                      </g>
                    );
                  })}
                </svg>
              </CanvasSurface>
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
              <div className="grid grid-cols-[1fr_44px] items-center gap-2">
                <label htmlFor="shape-color" className="flex items-center gap-2 text-sm text-muted-foreground"><Brush className="h-4 w-4" /> Color de la parte</label>
                <Input id="shape-color" type="color" value={selected.attrs.fill?.startsWith("#") ? selected.attrs.fill : "#000000"} onChange={(event) => changeColor(event.target.value)} className="h-9 cursor-pointer p-1" />
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

function CanvasSurface({ children }: { children: React.ReactNode }) {
  return <div className="grid h-[min(650px,68vh)] min-h-[460px] place-items-center overflow-hidden rounded-md border border-border bg-[linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%),linear-gradient(-45deg,hsl(var(--muted))_25%,transparent_25%),linear-gradient(45deg,transparent_75%,hsl(var(--muted))_75%),linear-gradient(-45deg,transparent_75%,hsl(var(--muted))_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0] p-3">{children}</div>;
}

function EmptyCanvas() {
  return <div className="text-center text-sm text-muted-foreground"><Wand2 className="mx-auto mb-2 h-10 w-10" /><p>Sube una imagen para comenzar.</p></div>;
}