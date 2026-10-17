import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Brush,
  Combine,
  Copy,
  CopyPlus,
  Download,
  Eraser,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  Maximize2,
  MousePointer2,
  Pipette,
  Redo2,
  RotateCcw,
  Shapes,
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
import { removeBackgroundClean } from "@/lib/remove-bg";
import { PageHeader } from "@/views/PageHeader";

export const Route = createFileRoute("/_authenticated/vectorize")({
  head: () => ({
    meta: [
      { title: "Editor vectorial por capas | AI Studio MG" },
      { name: "description", content: "Vectoriza imágenes y edita cada parte, color y posición de manera independiente." },
      { property: "og:title", content: "Editor vectorial por capas | AI Studio MG" },
      { property: "og:description", content: "Vectoriza imágenes y edita cada parte, color y posición de manera independiente." },
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
  group: string;
};
type Snapshot = { shapes: VectorShape[]; selectedId: string | null; groupNames: Record<string, string> };
type ExportFormat = "svg" | "png";
type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten";
type SelectMode = "group" | "shape";

const VECTOR_TAGS = new Set<VectorTag>(["path", "polygon", "polyline", "rect", "circle", "ellipse"]);
const COLOR_SWATCHES = ["#000000", "#333333", "#666666", "#999999", "#cccccc", "#ffffff", "#ec4899", "#a855f7", "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#78350f", "#166534"];

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

function hexToRgb(hex: string) {
  const v = colorToHex(hex);
  return [Number.parseInt(v.slice(1, 3), 16), Number.parseInt(v.slice(3, 5), 16), Number.parseInt(v.slice(5, 7), 16)];
}

function hexToHsv(hex: string) {
  const [r255, g255, b255] = hexToRgb(hex);
  const r = r255 / 255, g = g255 / 255, b = b255 / 255;
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

/** Cambia el relleno y, si el contorno "sella" la forma con el mismo color, también el contorno. */
function recolor(attrs: Record<string, string>, color: string) {
  const sealed = attrs.stroke && colorToHex(attrs.stroke) === colorToHex(attrs.fill);
  return { ...attrs, fill: color, ...(sealed ? { stroke: color } : {}) };
}

function parseVector(svgText: string) {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const root = doc.documentElement;
  const viewBox = root.getAttribute("viewBox") ?? `0 0 ${root.getAttribute("width") ?? 1024} ${root.getAttribute("height") ?? 1024}`;
  const shapes: VectorShape[] = [];
  const groupNames: Record<string, string> = {};
  const groupByColor = new Map<string, string>();

  root.querySelectorAll("path, polygon, polyline, rect, circle, ellipse").forEach((node, index) => {
    const tag = node.tagName.toLowerCase() as VectorTag;
    if (!VECTOR_TAGS.has(tag)) return;
    // Las zonas transparentes (fondo quitado) no se convierten en formas.
    const opacity = Number(node.getAttribute("opacity") ?? node.getAttribute("fill-opacity") ?? 1);
    if (opacity < 0.5) return;
    const attrs: Record<string, string> = {};
    Array.from(node.attributes).forEach((attribute) => {
      if (attribute.name !== "transform" && attribute.name !== "opacity") attrs[attribute.name] = attribute.value;
    });
    const hex = colorToHex(attrs.fill);
    attrs.fill = hex;
    // Contorno fino del mismo color para sellar las uniones entre partes (sin rendijas).
    attrs.stroke = hex;
    attrs["stroke-width"] = "1";
    attrs["stroke-linejoin"] = "round";
    let group = groupByColor.get(hex);
    if (!group) {
      group = `parte-${groupByColor.size + 1}`;
      groupByColor.set(hex, group);
      groupNames[group] = `Parte ${groupByColor.size}`;
    }
    shapes.push({ id: `forma-${index + 1}`, tag, attrs, x: 0, y: 0, visible: true, blendMode: "normal", group });
  });

  return { shapes, viewBox, groupNames };
}

function escapeAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function slug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "parte";
}

function shapeMarkup(shape: VectorShape) {
  const attrs = Object.entries(shape.attrs)
    .map(([key, value]) => `${key}="${escapeAttribute(value)}"`)
    .join(" ");
  const blend = shape.blendMode === "normal" ? "" : ` style="mix-blend-mode:${shape.blendMode}"`;
  const move = shape.x || shape.y ? ` transform="translate(${shape.x} ${shape.y})"` : "";
  return `<${shape.tag} ${attrs}${move}${blend}/>`;
}

/** SVG con fondo transparente y cada parte en su propio grupo con nombre (editable en Illustrator/Inkscape). */
function serializeSvg(shapes: VectorShape[], viewBox: string, groupNames: Record<string, string> = {}) {
  const order: string[] = [];
  const byGroup = new Map<string, VectorShape[]>();
  shapes.filter((s) => s.visible).forEach((s) => {
    if (!byGroup.has(s.group)) {
      byGroup.set(s.group, []);
      order.push(s.group);
    }
    byGroup.get(s.group)!.push(s);
  });
  const used = new Set<string>();
  const body = order
    .map((g) => {
      const name = groupNames[g] ?? g;
      let id = slug(name);
      while (used.has(id)) id += "-b";
      used.add(id);
      return `<g id="${escapeAttribute(id)}" data-name="${escapeAttribute(name)}">${byGroup.get(g)!.map(shapeMarkup).join("")}</g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${escapeAttribute(viewBox)}" shape-rendering="geometricPrecision">${body}</svg>`;
}

function VectorizePage() {
  const [source, setSource] = useState<string | null>(null);
  const [shapes, setShapes] = useState<VectorShape[]>([]);
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState<SelectMode>("group");
  const [viewBox, setViewBox] = useState("0 0 1024 1024");
  const [colors, setColors] = useState(12);
  const [detail, setDetail] = useState(0.5);
  const [smoothing, setSmoothing] = useState(0.5);
  const [omit, setOmit] = useState(8);
  const [loading, setLoading] = useState(false);
  const [bgBusy, setBgBusy] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("svg");
  const [pngScale, setPngScale] = useState(4);
  const [activeTab, setActiveTab] = useState("source");
  const [zoom, setZoom] = useState(1);
  const [zoomOffset, setZoomOffset] = useState({ x: 0, y: 0 });
  const [historyVersion, setHistoryVersion] = useState(0);
  const [eyedropperTargetId, setEyedropperTargetId] = useState<string | null>(null);
  const historyRef = useRef<Snapshot[]>([]);
  const redoRef = useRef<Snapshot[]>([]);
  const cornerColorRef = useRef<string | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origins: Record<string, { x: number; y: number }> } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef({ zoom, offset: zoomOffset });

  const selected = useMemo(() => shapes.find((shape) => shape.id === selectedId) ?? null, [shapes, selectedId]);

  const groups = useMemo(() => {
    const map = new Map<string, { id: string; color: string; count: number; visible: boolean }>();
    shapes.forEach((s) => {
      const g = map.get(s.group);
      if (g) {
        g.count += 1;
        g.visible = g.visible || s.visible;
      } else {
        map.set(s.group, { id: s.group, color: colorToHex(s.attrs.fill), count: 1, visible: s.visible });
      }
    });
    return [...map.values()];
  }, [shapes]);

  const activeGroup = groups.find((g) => g.id === selectedGroup) ?? null;

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

  // Tecla Supr / Retroceso elimina la parte o forma seleccionada.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectMode === "group" && selectedGroup) {
          event.preventDefault();
          deleteGroup(selectedGroup);
        } else if (selectMode === "shape" && selectedId) {
          event.preventDefault();
          removeSelected();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function saveHistory() {
    historyRef.current.push({ shapes: cloneShapes(shapes), selectedId, groupNames: { ...groupNames } });
    if (historyRef.current.length > 40) historyRef.current.shift();
    redoRef.current = [];
    setHistoryVersion((value) => value + 1);
  }

  function restore(snapshot: Snapshot) {
    setShapes(snapshot.shapes);
    setSelectedId(snapshot.selectedId);
    setGroupNames(snapshot.groupNames);
    setEyedropperTargetId(null);
    setHistoryVersion((value) => value + 1);
  }

  function undo() {
    const snapshot = historyRef.current.pop();
    if (!snapshot) return;
    redoRef.current.push({ shapes: cloneShapes(shapes), selectedId, groupNames: { ...groupNames } });
    restore(snapshot);
  }

  function redo() {
    const snapshot = redoRef.current.pop();
    if (!snapshot) return;
    historyRef.current.push({ shapes: cloneShapes(shapes), selectedId, groupNames: { ...groupNames } });
    restore(snapshot);
  }

  async function removeBg() {
    if (!source) return;
    setBgBusy(true);
    const t = toast.loading("Quitando fondo (la primera vez tarda un poco)...");
    try {
      const out = await removeBackgroundClean(source);
      setSource(out);
      setShapes([]);
      setActiveTab("source");
      toast.success("Fondo quitado: ahora es transparente", { id: t });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo quitar el fondo", { id: t });
    } finally {
      setBgBusy(false);
    }
  }

  async function vectorize() {
    if (!source) return;
    setLoading(true);
    try {
      const image = await loadImage(source);
      const w0 = image.naturalWidth || image.width;
      const h0 = image.naturalHeight || image.height;
      // Trabajamos a buena resolución: imágenes pequeñas se amplían para curvas más finas.
      const maxSide = Math.max(w0, h0);
      const scale = maxSide < 1200 ? Math.min(3, 1200 / maxSide) : maxSide > 2000 ? 2000 / maxSide : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w0 * scale);
      canvas.height = Math.round(h0 * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No se pudo preparar la imagen");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      // Bordes limpios: la transparencia se vuelve todo o nada.
      for (let i = 3; i < d.length; i += 4) {
        if (d[i] < 128) {
          d[i - 3] = 0; d[i - 2] = 0; d[i - 1] = 0; d[i] = 0;
        } else d[i] = 255;
      }
      // Color de esquinas (para detectar el fondo después).
      const corners = [0, canvas.width - 1, (canvas.height - 1) * canvas.width, canvas.height * canvas.width - 1]
        .map((p) => p * 4)
        .filter((p) => d[p + 3] > 0)
        .map((p) => colorToHex(`rgb(${d[p]},${d[p + 1]},${d[p + 2]})`));
      cornerColorRef.current = corners[0] ?? null;

      const traced = ImageTracer.imagedataToSVG(imageData, {
        numberofcolors: colors,
        colorsampling: 2,
        colorquantcycles: 4,
        mincolorratio: 0,
        ltres: detail,
        qtres: smoothing,
        pathomit: omit,
        rightangleenhance: true,
        linefilter: true,
        blurradius: 0,
        roundcoords: 2,
        strokewidth: 1,
        viewbox: true,
      });
      const parsed = parseVector(traced);
      if (!parsed.shapes.length) throw new Error("No se detectaron formas en la imagen");
      historyRef.current = [];
      redoRef.current = [];
      setShapes(parsed.shapes);
      setGroupNames(parsed.groupNames);
      setViewBox(parsed.viewBox);
      setSelectedId(null);
      setSelectedGroup(null);
      setActiveTab("vector");
      fitCanvas();
      toast.success(`${Object.keys(parsed.groupNames).length} partes de color (${parsed.shapes.length} formas)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo vectorizar");
    } finally {
      setLoading(false);
    }
  }

  function updateShape(id: string, update: Partial<VectorShape>) {
    setShapes((current) => current.map((shape) => (shape.id === id ? { ...shape, ...update } : shape)));
  }

  function updateGroupShapes(groupId: string, fn: (shape: VectorShape) => VectorShape) {
    setShapes((current) => current.map((shape) => (shape.group === groupId ? fn(shape) : shape)));
  }

  // ---------- Operaciones por parte (grupo de color) ----------
  function setGroupColor(groupId: string, color: string, record = true) {
    if (record) saveHistory();
    updateGroupShapes(groupId, (s) => ({ ...s, attrs: recolor(s.attrs, color) }));
  }

  function setGroupOpacity(groupId: string, value: number) {
    updateGroupShapes(groupId, (s) => ({ ...s, attrs: { ...s.attrs, opacity: String(value) } }));
  }

  function toggleGroup(groupId: string) {
    const g = groups.find((item) => item.id === groupId);
    if (!g) return;
    saveHistory();
    updateGroupShapes(groupId, (s) => ({ ...s, visible: !g.visible }));
  }

  function deleteGroup(groupId: string) {
    saveHistory();
    setShapes((current) => current.filter((s) => s.group !== groupId));
    if (selectedGroup === groupId) setSelectedGroup(null);
    setSelectedId(null);
    toast.success(`"${groupNames[groupId] ?? groupId}" eliminado`);
  }

  function mergeGroup(from: string, into: string) {
    if (from === into) return;
    saveHistory();
    updateGroupShapes(from, (s) => ({ ...s, group: into }));
    setSelectedGroup(into);
    toast.success("Partes unidas");
  }

  function renameGroup(groupId: string, name: string) {
    setGroupNames((current) => ({ ...current, [groupId]: name }));
  }

  function moveShapeToGroup(shapeId: string, groupId: string) {
    saveHistory();
    if (groupId === "__new") {
      const id = `parte-${Date.now()}`;
      setGroupNames((current) => ({ ...current, [id]: `Parte ${Object.keys(current).length + 1}` }));
      updateShape(shapeId, { group: id });
      setSelectedGroup(id);
    } else {
      updateShape(shapeId, { group: groupId });
    }
  }

  function removeDetectedBackground() {
    const corner = cornerColorRef.current;
    if (!corner) return toast.info("No hay fondo: la imagen ya es transparente");
    const [r, g, b] = hexToRgb(corner);
    let best: { id: string; dist: number } | null = null;
    for (const item of groups) {
      const [r2, g2, b2] = hexToRgb(item.color);
      const dist = Math.hypot(r - r2, g - g2, b - b2);
      if (!best || dist < best.dist) best = { id: item.id, dist };
    }
    if (!best || best.dist > 60) return toast.info("No se detectó un fondo de color uniforme");
    deleteGroup(best.id);
    cornerColorRef.current = null;
  }

  // ---------- Operaciones por forma individual ----------
  function changeColor(color: string) {
    if (!selected) return;
    saveHistory();
    updateShape(selected.id, { attrs: recolor(selected.attrs, color) });
  }

  function changeHsv(channel: "h" | "v", value: number) {
    if (selectMode === "group" && activeGroup) {
      const hsv = hexToHsv(activeGroup.color);
      setGroupColor(activeGroup.id, hsvToHex(channel === "h" ? value : hsv.h, hsv.s, channel === "v" ? value / 100 : hsv.v), false);
      return;
    }
    if (!selected) return;
    const hsv = hexToHsv(selected.attrs.fill);
    const fill = hsvToHex(channel === "h" ? value : hsv.h, hsv.s, channel === "v" ? value / 100 : hsv.v);
    updateShape(selected.id, { attrs: recolor(selected.attrs, fill) });
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
    const items = selectMode === "group" && selectedGroup ? shapes.filter((s) => s.group === selectedGroup) : selected ? [selected] : [];
    if (!items.length) return;
    const svg = serializeSvg(items, viewBox, groupNames);
    try {
      await navigator.clipboard.writeText(svg);
      toast.success("Copiado como SVG");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  function sampleColor(event: React.PointerEvent<SVGGElement>, shape: VectorShape) {
    if (!eyedropperTargetId) return false;
    event.stopPropagation();
    const color = colorToHex(shape.attrs.fill);
    if (eyedropperTargetId.startsWith("group:")) {
      setGroupColor(eyedropperTargetId.slice(6), color);
    } else {
      const target = shapes.find((item) => item.id === eyedropperTargetId);
      if (target) {
        saveHistory();
        updateShape(target.id, { attrs: recolor(target.attrs, color) });
      }
    }
    toast.success("Color aplicado");
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
    setSelectedGroup(shape.group);
    const movers = selectMode === "group" ? shapes.filter((s) => s.group === shape.group) : [shape];
    const origins: Record<string, { x: number; y: number }> = {};
    movers.forEach((s) => (origins[s.id] = { x: s.x, y: s.y }));
    dragRef.current = { startX: point.x, startY: point.y, origins };
    svgRef.current?.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    const point = pointerPosition(event);
    if (!drag || !point) return;
    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    setShapes((current) =>
      current.map((s) => {
        const o = drag.origins[s.id];
        return o ? { ...s, x: o.x + dx, y: o.y + dy } : s;
      }),
    );
  }

  function stopDrag(event: React.PointerEvent<SVGSVGElement>) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function resetPosition() {
    saveHistory();
    if (selectMode === "group" && selectedGroup) updateGroupShapes(selectedGroup, (s) => ({ ...s, x: 0, y: 0 }));
    else if (selected) updateShape(selected.id, { x: 0, y: 0 });
  }

  async function download() {
    if (!shapes.length) return;
    const svgText = serializeSvg(shapes, viewBox, groupNames);
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

  const editingColor = selectMode === "group" ? activeGroup?.color : selected ? colorToHex(selected.attrs.fill) : undefined;
  const hasSelection = selectMode === "group" ? !!activeGroup : !!selected;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageHeader title="Vectorizar por partes" description="Quita el fondo, convierte la imagen en partes y cambia el color, oculta o elimina cada una." />

      <div className="grid min-h-[620px] gap-4 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
        <aside className="space-y-4 rounded-lg border border-border bg-card p-4">
          <ImageDropzone
            preview={source}
            onClear={() => {
              setSource(null);
              setShapes([]);
              setSelectedId(null);
              setSelectedGroup(null);
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

          <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold"><Eraser className="h-4 w-4 text-primary" /> Fondo</div>
            <Button className="w-full" variant="secondary" disabled={!source || bgBusy || loading} onClick={removeBg}>
              {bgBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
              Quitar fondo (transparente)
            </Button>
            <Button className="w-full" variant="outline" size="sm" disabled={!source} onClick={() => source && downloadDataUrl(source, `sin-fondo-${Date.now()}.png`)}>
              <Download className="h-4 w-4" /> Descargar PNG actual
            </Button>
          </section>

          <section className="space-y-4 border-t border-border pt-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Wand2 className="h-4 w-4 text-primary" /> Vectorización</div>
            <Control label="Cantidad de colores (partes)" value={colors}><Slider value={[colors]} min={2} max={48} step={1} onValueChange={(value) => setColors(value[0] ?? 12)} /></Control>
            <Control label="Precisión de contorno" value={detail}><Slider value={[detail]} min={0.1} max={3} step={0.1} onValueChange={(value) => setDetail(value[0] ?? 0.5)} /></Control>
            <Control label="Suavizado de curvas" value={smoothing}><Slider value={[smoothing]} min={0.1} max={3} step={0.1} onValueChange={(value) => setSmoothing(value[0] ?? 0.5)} /></Control>
            <Control label="Limpiar puntos sueltos" value={omit}><Slider value={[omit]} min={0} max={40} step={1} onValueChange={(value) => setOmit(value[0] ?? 8)} /></Control>
            <Button className="w-full" disabled={!source || loading || bgBusy} onClick={vectorize}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {shapes.length ? "Volver a vectorizar" : "Vectorizar imagen"}
            </Button>
          </section>

          <section className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-semibold">Exportación</p>
            <div className="flex gap-2">
              <Select value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="svg">SVG editable (fondo transparente)</SelectItem><SelectItem value="png">PNG transparente</SelectItem></SelectContent>
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList><TabsTrigger value="source">Original</TabsTrigger><TabsTrigger value="vector" disabled={!shapes.length}>Vector editable</TabsTrigger></TabsList>
              <div className="flex flex-wrap items-center justify-end gap-1">
                <div className="mr-1 flex rounded-md border border-border p-0.5">
                  <Button size="sm" variant={selectMode === "group" ? "secondary" : "ghost"} className="h-7 gap-1 px-2 text-xs" onClick={() => setSelectMode("group")} title="Seleccionar parte completa"><Layers className="h-3.5 w-3.5" /> Parte</Button>
                  <Button size="sm" variant={selectMode === "shape" ? "secondary" : "ghost"} className="h-7 gap-1 px-2 text-xs" onClick={() => setSelectMode("shape")} title="Seleccionar forma individual"><Shapes className="h-3.5 w-3.5" /> Forma</Button>
                </div>
                <Button size="icon" variant="ghost" onClick={undo} disabled={!historyRef.current.length || historyVersion < 0} title="Deshacer"><Undo2 className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={redo} disabled={!redoRef.current.length || historyVersion < 0} title="Rehacer"><Redo2 className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={copySelected} disabled={!hasSelection} title="Copiar como SVG"><Copy className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={duplicateSelected} disabled={selectMode !== "shape" || !selected} title="Duplicar forma"><CopyPlus className="h-4 w-4" /></Button>
                <Button
                  size="icon"
                  variant={eyedropperTargetId ? "secondary" : "ghost"}
                  onClick={() => setEyedropperTargetId(selectMode === "group" ? (selectedGroup ? `group:${selectedGroup}` : null) : selected?.id ?? null)}
                  disabled={!hasSelection}
                  title="Tomar color de otra parte"
                ><Pipette className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => (selectMode === "group" ? selectedGroup && deleteGroup(selectedGroup) : removeSelected())} disabled={!hasSelection} title="Eliminar (Supr)"><Trash2 className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => { setSelectedId(null); setSelectedGroup(null); setEyedropperTargetId(null); }} disabled={!hasSelection} title="Deseleccionar"><X className="h-4 w-4" /></Button>
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
                      shapeRendering="geometricPrecision"
                      className={`h-full max-h-[650px] w-full touch-none select-none ${eyedropperTargetId ? "cursor-crosshair" : ""}`}
                      onPointerMove={moveDrag}
                      onPointerUp={stopDrag}
                      onPointerCancel={stopDrag}
                      onPointerDown={() => { if (!eyedropperTargetId) { setSelectedId(null); setSelectedGroup(null); } }}
                      aria-label="Lienzo vectorial editable"
                    >
                      {shapes.map((shape) => {
                        if (!shape.visible) return null;
                        return (
                          <g key={shape.id} transform={`translate(${shape.x} ${shape.y})`} onPointerDown={(event) => startDrag(event, shape)} className={eyedropperTargetId ? "cursor-crosshair" : "cursor-move"} style={{ mixBlendMode: shape.blendMode }}>
                            <VectorElement shape={shape} />
                          </g>
                        );
                      })}
                      {/* Contornos de selección por encima de todo */}
                      {shapes.map((shape) => {
                        if (!shape.visible) return null;
                        const isSelected = selectMode === "group" ? shape.group === selectedGroup : shape.id === selectedId;
                        if (!isSelected) return null;
                        return (
                          <g key={`sel-${shape.id}`} transform={`translate(${shape.x} ${shape.y})`} className="pointer-events-none">
                            <SelectedOutline shape={shape} />
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </CanvasSurface>
              </div>
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><MousePointer2 className="h-3.5 w-3.5" /> Haz clic en una parte (ej. el techo) para cambiarle el color, moverla, ocultarla o eliminarla con Supr.</p>
            </TabsContent>
          </Tabs>
        </main>

        <aside className="min-w-0 rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div><p className="font-semibold">Partes</p><p className="text-xs text-muted-foreground">{groups.length} partes · {shapes.length} formas</p></div>
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={!shapes.length} onClick={removeDetectedBackground} title="Elimina la parte del color de las esquinas">
              <Eraser className="h-3.5 w-3.5" /> Quitar fondo
            </Button>
          </div>

          {hasSelection && editingColor ? (
            <section className="mb-4 space-y-3 border-b border-border pb-4">
              {selectMode === "group" && activeGroup ? (
                <div className="space-y-1">
                  <label htmlFor="group-name" className="text-xs text-muted-foreground">Nombre de la parte</label>
                  <Input
                    id="group-name"
                    value={groupNames[activeGroup.id] ?? ""}
                    placeholder="Ej: Techo, Pared, Ventanas..."
                    onFocus={saveHistory}
                    onChange={(e) => renameGroup(activeGroup.id, e.target.value)}
                  />
                </div>
              ) : selected ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Forma de la parte</p>
                  <Select value={selected.group} onValueChange={(value) => moveShapeToGroup(selected.id, value)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => <SelectItem key={g.id} value={g.id}>{groupNames[g.id] ?? g.id}</SelectItem>)}
                      <SelectItem value="__new">+ Nueva parte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Color de relleno</p>
                <div className="grid grid-cols-8 gap-1">
                  {COLOR_SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Aplicar color ${color}`}
                      title={color}
                      className="aspect-square rounded-sm border border-border"
                      style={{ backgroundColor: color }}
                      onClick={() => (selectMode === "group" && activeGroup ? setGroupColor(activeGroup.id, color) : changeColor(color))}
                    />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-[1fr_44px] items-center gap-2">
                <label htmlFor="shape-color" className="flex items-center gap-2 text-sm text-muted-foreground"><Brush className="h-4 w-4" /> Color personalizado</label>
                <Input
                  id="shape-color"
                  type="color"
                  value={editingColor}
                  onFocus={saveHistory}
                  onChange={(event) => (selectMode === "group" && activeGroup ? setGroupColor(activeGroup.id, event.target.value, false) : selected && updateShape(selected.id, { attrs: recolor(selected.attrs, event.target.value) }))}
                  className="h-9 cursor-pointer p-1"
                />
              </div>
              <Control label="Matiz" value={Math.round(hexToHsv(editingColor).h)}><Slider value={[hexToHsv(editingColor).h]} min={0} max={360} step={1} onPointerDown={saveHistory} onValueChange={(value) => changeHsv("h", value[0] ?? 0)} /></Control>
              <Control label="Brillo" value={Math.round(hexToHsv(editingColor).v * 100)}><Slider value={[hexToHsv(editingColor).v * 100]} min={0} max={100} step={1} onPointerDown={saveHistory} onValueChange={(value) => changeHsv("v", value[0] ?? 0)} /></Control>

              {selectMode === "group" && activeGroup ? (
                <>
                  <Control label="Opacidad" value={Math.round(Number(shapes.find((s) => s.group === activeGroup.id)?.attrs.opacity ?? 1) * 100)}>
                    <Slider value={[Number(shapes.find((s) => s.group === activeGroup.id)?.attrs.opacity ?? 1) * 100]} min={0} max={100} step={1} onPointerDown={saveHistory} onValueChange={(value) => setGroupOpacity(activeGroup.id, (value[0] ?? 100) / 100)} />
                  </Control>
                  {groups.length > 1 && (
                    <div className="space-y-1">
                      <p className="flex items-center gap-1 text-xs text-muted-foreground"><Combine className="h-3.5 w-3.5" /> Unir con otra parte</p>
                      <Select value="" onValueChange={(value) => mergeGroup(activeGroup.id, value)}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Elegir parte..." /></SelectTrigger>
                        <SelectContent>
                          {groups.filter((g) => g.id !== activeGroup.id).map((g) => <SelectItem key={g.id} value={g.id}>{groupNames[g.id] ?? g.id}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => toggleGroup(activeGroup.id)}>
                      {activeGroup.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {activeGroup.visible ? "Ocultar" : "Mostrar"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteGroup(activeGroup.id)}><Trash2 className="h-4 w-4" /> Eliminar</Button>
                  </div>
                </>
              ) : selected ? (
                <>
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
                </>
              ) : null}
              <Button variant="outline" size="sm" className="w-full" onClick={resetPosition}><RotateCcw className="h-4 w-4" /> Restablecer posición</Button>
            </section>
          ) : <p className="mb-4 border-b border-border pb-4 text-sm text-muted-foreground">Haz clic en una parte del dibujo o de la lista para editarla.</p>}

          <ScrollArea className="h-[410px] pr-3">
            <div className="space-y-1">
              {selectMode === "group"
                ? groups.map((g) => (
                    <div key={g.id} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${selectedGroup === g.id ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted/60"}`}>
                      <label className="relative h-5 w-5 shrink-0 cursor-pointer overflow-hidden rounded-sm border border-border" style={{ backgroundColor: g.color }} title="Cambiar color">
                        <input type="color" value={g.color} className="absolute inset-0 cursor-pointer opacity-0" onFocus={saveHistory} onChange={(e) => setGroupColor(g.id, e.target.value, false)} />
                      </label>
                      <button type="button" className="min-w-0 flex-1 truncate text-left text-sm" onClick={() => { setSelectedGroup(g.id); setSelectedId(null); }}>
                        {groupNames[g.id] ?? g.id} <span className="text-xs text-muted-foreground">({g.count})</span>
                      </button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => toggleGroup(g.id)} title={g.visible ? "Ocultar" : "Mostrar"}>
                        {g.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => deleteGroup(g.id)} title="Eliminar parte">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                : [...shapes].reverse().map((shape) => (
                    <div key={shape.id} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${selectedId === shape.id ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted/60"}`}>
                      <span className="h-4 w-4 shrink-0 rounded-sm border border-border" style={{ backgroundColor: shape.attrs.fill ?? "transparent" }} />
                      <button type="button" className="min-w-0 flex-1 truncate text-left text-sm" onClick={() => { setSelectedId(shape.id); setSelectedGroup(shape.group); }}>
                        {shape.id} <span className="text-xs text-muted-foreground">· {groupNames[shape.group] ?? shape.group}</span>
                      </button>
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
  const props = shape.attrs;
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
  const props = { ...shape.attrs, fill: "none", stroke: "currentColor", strokeWidth: "2", strokeDasharray: "4 3", vectorEffect: "non-scaling-stroke", className: "text-primary pointer-events-none" };
  delete (props as Record<string, string>)["stroke-width"];
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
};

function EmptyCanvas() {
  return <div className="text-center text-sm text-muted-foreground"><Wand2 className="mx-auto mb-2 h-10 w-10" /><p>Sube una imagen para comenzar.</p></div>;
}
