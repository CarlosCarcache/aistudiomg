import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Download,
  RotateCcw,
  Sparkles,
  Loader2,
  Lock,
  Unlock,
  Shirt,
  Printer,
  Columns2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ImageDropzone } from "@/components/image-dropzone";
import { aiImage, downloadDataUrl, loadImage } from "@/lib/image-utils";
import { removeBackgroundClean } from "@/lib/remove-bg";
import { PageHeader } from "@/views/PageHeader";

export const Route = createFileRoute("/_authenticated/halftone")({
  component: HalftonePage,
});

type Shape = "dot" | "line" | "engraving";
type Tab = "original" | "preview" | "export" | "mask";
type ColorMode = "color" | "bw";
type BackgroundMode = "transparent" | "white" | "black" | "color";
type WorkspaceMode = "compare" | "shirt" | "print";
type ShirtSize = "XS" | "S" | "M" | "L" | "XL" | "2XL" | "3XL" | "4XL";
type PrintDesign = { id: number; x: number; y: number; width: number };
type GarmentMask = { dots: Uint8ClampedArray; background: Uint8Array };

const DPI_OPTS = [300, 400, 500, 600, 700, 800];
const SHIRT_COLORS = ["#f4f4f5", "#171717", "#ef4444", "#2563eb", "#16a34a", "#facc15"];
const SHIRT_SIZES: ShirtSize[] = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"];
const SHIRT_CHEST_WIDTH: Record<ShirtSize, number> = {
  XS: 44,
  S: 48,
  M: 52,
  L: 56,
  XL: 60,
  "2XL": 64,
  "3XL": 68,
  "4XL": 72,
};

function HalftonePage() {
  const [src, setSrc] = useState<string | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("compare");
  const [comparePosition, setComparePosition] = useState(50);
  const [previewBackground, setPreviewBackground] = useState("transparent");
  const [customPreviewBackground, setCustomPreviewBackground] = useState("#7c3aed");
  const [shirtSide, setShirtSide] = useState<"front" | "back">("front");
  const [shirtColor, setShirtColor] = useState("#f4f4f5");
  const [shirtSize, setShirtSize] = useState<ShirtSize>("M");
  const [shirtWidth, setShirtWidth] = useState(61);
  const [printFormat, setPrintFormat] = useState<"a3" | "roll">("a3");
  const [printBackground, setPrintBackground] = useState<"white" | "black" | "transparent">(
    "transparent",
  );
  const [printDesigns, setPrintDesigns] = useState<PrintDesign[]>([
    { id: 1, x: 50, y: 8, width: 38 },
  ]);
  const [activeDesignId, setActiveDesignId] = useState(1);
  const [printZoom, setPrintZoom] = useState(100);
  const dragRef = useRef<{ id: number; offsetX: number; offsetY: number } | null>(null);
  const [tab, setTab] = useState<Tab>("preview");
  const [knockoutColor, setKnockoutColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [garmentHalftone, setGarmentHalftone] = useState(true);
  const [garmentTolerance, setGarmentTolerance] = useState(90);
  const [removeBg, setRemoveBg] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("white");
  const [targetColor, setTargetColor] = useState("#ffffff");
  const [tolerance, setTolerance] = useState(149);
  const [protectSubject, setProtectSubject] = useState(true);
  const [darkGarment, setDarkGarment] = useState(false);
  const [shape, setShape] = useState<Shape>("dot");
  const [dotSize, setDotSize] = useState(10);
  const [minDotSize, setMinDotSize] = useState(0.18);
  const [maxDotSize, setMaxDotSize] = useState(0.92);
  const [intensity, setIntensity] = useState(0.82);
  const [angle, setAngle] = useState(45);
  const [dpi, setDpi] = useState(300);
  const [contrast, setContrast] = useState(1);
  const [brightness, setBrightness] = useState(0);
  const [saturation, setSaturation] = useState(1);
  const [gamma, setGamma] = useState(1);
  const [colorMode, setColorMode] = useState<ColorMode>("bw");
  const [solid, setSolid] = useState(false);
  const [printWidth, setPrintWidth] = useState(10);
  const [printHeight, setPrintHeight] = useState(10);
  const [keepRatio, setKeepRatio] = useState(true);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [prompt, setPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [bgBusy, setBgBusy] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!src) return;
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    src,
    tab,
    knockoutColor,
    bgColor,
    garmentHalftone,
    garmentTolerance,
    shirtColor,
    previewBackground,
    customPreviewBackground,
    removeBg,
    backgroundMode,
    targetColor,
    tolerance,
    protectSubject,
    darkGarment,
    shape,
    dotSize,
    minDotSize,
    maxDotSize,
    intensity,
    angle,
    contrast,
    brightness,
    saturation,
    gamma,
    colorMode,
    solid,
  ]);

  useEffect(() => {
    if (!src) return;
    loadImage(src).then((img) => setAspectRatio(img.height / img.width));
  }, [src]);

  useEffect(() => {
    if (keepRatio) setPrintHeight(printWidth * aspectRatio);
  }, [aspectRatio, keepRatio, printWidth]);

  async function render() {
    if (!src || !canvasRef.current) return;
    const img = await loadImage(src);
    const c = canvasRef.current;
    const maxW = 1500;
    const scale = Math.min(1, maxW / Math.max(img.width, img.height));
    c.width = img.width * scale;
    c.height = img.height * scale;
    const ctx = c.getContext("2d")!;

    if (tab === "original") {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      setPreviewDataUrl(c.toDataURL("image/png"));
      return;
    }

    // Fill BG
    const outputBackground = previewBackground === "transparent" ? null : previewBackground;
    if (outputBackground) {
      ctx.fillStyle = outputBackground;
      ctx.fillRect(0, 0, c.width, c.height);
    } else {
      ctx.clearRect(0, 0, c.width, c.height);
    }

    // Luminance (siempre en gris) para calcular el peso del punto
    const tmp = document.createElement("canvas");
    tmp.width = c.width;
    tmp.height = c.height;
    const tctx = tmp.getContext("2d")!;
    tctx.filter = `brightness(${1 + brightness / 100}) contrast(${contrast}) grayscale(1)`;
    tctx.drawImage(img, 0, 0, c.width, c.height);
    const imageData = tctx.getImageData(0, 0, c.width, c.height);
    const data = imageData.data;
    const keyCanvas = document.createElement("canvas");
    keyCanvas.width = c.width;
    keyCanvas.height = c.height;
    const keyContext = keyCanvas.getContext("2d")!;
    keyContext.drawImage(img, 0, 0, c.width, c.height);
    const keyData = keyContext.getImageData(0, 0, c.width, c.height).data;
    if (removeBg) {
      applyColorKey(data, keyData, backgroundMode, targetColor, tolerance, protectSubject);
      tctx.putImageData(imageData, 0, 0);
    }

    const garmentMask = garmentHalftone
      ? createGarmentMask(keyData, c.width, c.height, shirtColor, garmentTolerance)
      : null;

    if (garmentMask) {
      const artCanvas = document.createElement("canvas");
      artCanvas.width = c.width;
      artCanvas.height = c.height;
      const artContext = artCanvas.getContext("2d")!;
      artContext.filter = `brightness(${1 + brightness / 100}) contrast(${contrast}) saturate(${saturation})`;
      artContext.drawImage(img, 0, 0, c.width, c.height);
      const artImageData = artContext.getImageData(0, 0, c.width, c.height);
      if (removeBg) {
        applyColorKey(
          artImageData.data,
          keyData,
          backgroundMode,
          targetColor,
          tolerance,
          protectSubject,
        );
      }
      for (let i = 0; i < garmentMask.dots.length; i++) {
        artImageData.data[i * 4 + 3] = Math.round(
          artImageData.data[i * 4 + 3] *
            (1 - Math.max(garmentMask.dots[i] / 255, garmentMask.background[i] / 255)),
        );
      }
      artContext.putImageData(artImageData, 0, 0);
      ctx.drawImage(artCanvas, 0, 0);
    }

    // Color original (opcional) para modo color
    let colorData: Uint8ClampedArray | null = null;
    if (colorMode === "color") {
      const ctmp = document.createElement("canvas");
      ctmp.width = c.width;
      ctmp.height = c.height;
      const cctx = ctmp.getContext("2d")!;
      cctx.filter = `brightness(${1 + brightness / 100}) contrast(${contrast}) saturate(${saturation})`;
      cctx.drawImage(img, 0, 0, c.width, c.height);
      const colorImageData = cctx.getImageData(0, 0, c.width, c.height);
      colorData = colorImageData.data;
      applyGamma(colorData, gamma);
      if (removeBg)
        applyColorKey(colorData, keyData, backgroundMode, targetColor, tolerance, protectSubject);
    }

    const step = Math.max(3, dotSize);
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad),
      sin = Math.sin(rad);
    const diag = Math.ceil(Math.hypot(c.width, c.height));

    const inkColor = darkGarment ? "#ffffff" : knockoutColor;
    ctx.fillStyle = inkColor;
    ctx.strokeStyle = inkColor;
    ctx.lineCap = "round";

    for (let yy = -diag; yy < diag; yy += step) {
      for (let xx = -diag; xx < diag; xx += step) {
        const sx = Math.round(xx * cos - yy * sin + c.width / 2);
        const sy = Math.round(xx * sin + yy * cos + c.height / 2);
        if (sx < 0 || sx >= c.width || sy < 0 || sy >= c.height) continue;
        const i = (sy * c.width + sx) * 4;
        if (data[i + 3] === 0) continue;
        const garmentMatch = garmentMask ? garmentMask.dots[sy * c.width + sx] / 255 : 1;
        if (garmentMask && garmentMatch <= 0.01) continue;
        ctx.globalAlpha = (data[i + 3] / 255) * garmentMatch;
        const correctedLum = 255 * Math.pow(data[i] / 255, 1 / gamma);
        const rawDark = garmentMask
          ? (darkGarment ? 1 - correctedLum / 255 : correctedLum / 255) * intensity
          : (darkGarment ? correctedLum / 255 : 1 - correctedLum / 255) * intensity;
        // Solid: umbral duro (sin degradados), tamaño completo
        const darkness = solid ? (rawDark > 0.5 ? 1 : 0) : rawDark;
        if (darkness <= 0.02) {
          ctx.globalAlpha = 1;
          continue;
        }

        const cx = xx * cos - yy * sin + c.width / 2;
        const cy = xx * sin + yy * cos + c.height / 2;

        // Color del punto
        if (colorData && !garmentMask) {
          ctx.fillStyle = `rgb(${colorData[i]}, ${colorData[i + 1]}, ${colorData[i + 2]})`;
          ctx.strokeStyle = ctx.fillStyle;
        } else {
          ctx.fillStyle = inkColor;
          ctx.strokeStyle = inkColor;
        }

        if (shape === "dot") {
          const minRadius = (step * minDotSize) / 2;
          const maxRadius = (step * maxDotSize) / 2;
          const r = solid ? maxRadius : minRadius + (maxRadius - minRadius) * Math.sqrt(darkness);
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const minLength = step * minDotSize;
          const maxLength = step * maxDotSize;
          const len = solid ? maxLength : minLength + (maxLength - minLength) * Math.sqrt(darkness);
          ctx.lineWidth = Math.max(1, step * 0.4 * (solid ? 1 : darkness));
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rad);
          ctx.beginPath();
          ctx.moveTo(-len / 2, 0);
          ctx.lineTo(len / 2, 0);
          ctx.stroke();
          if (shape === "engraving") {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(-len / 2, 0);
            ctx.lineTo(len / 2, 0);
            ctx.stroke();
          }
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
    }
    setPreviewDataUrl(c.toDataURL("image/png"));
  }

  function reset() {
    setKnockoutColor("#000000");
    setBgColor("#ffffff");
    setGarmentHalftone(true);
    setGarmentTolerance(90);
    setRemoveBg(false);
    setBackgroundMode("white");
    setTargetColor("#ffffff");
    setTolerance(149);
    setProtectSubject(true);
    setDarkGarment(false);
    setShape("dot");
    setDotSize(10);
    setMinDotSize(0.18);
    setMaxDotSize(0.92);
    setIntensity(0.82);
    setAngle(45);
    setDpi(300);
    setContrast(1);
    setBrightness(0);
    setSaturation(1);
    setGamma(1);
    setColorMode("bw");
    setSolid(false);
    setPrintWidth(10);
    setPrintHeight(10);
    setKeepRatio(true);
    setZoom(100);
    setTab("preview");
    setComparePosition(50);
    setPreviewBackground("transparent");
    setWorkspaceMode("compare");
    setCustomPreviewBackground("#7c3aed");
    setShirtSide("front");
    setShirtColor("#f4f4f5");
    setShirtSize("M");
    setShirtWidth(61);
    setPrintFormat("a3");
    setPrintBackground("transparent");
    setPrintDesigns([{ id: 1, x: 50, y: 8, width: 38 }]);
    setActiveDesignId(1);
    setPrintZoom(100);
  }

  function selectGarmentColor(color: string) {
    setShirtColor(color);
    const { r, g, b } = hexToRgb(color);
    setDarkGarment((r * 299 + g * 587 + b * 114) / 1000 < 128);
  }

  async function downloadSvg() {
    if (!src) return;
    if (garmentHalftone && canvasRef.current) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${printWidth}cm" height="${printHeight}cm" viewBox="0 0 ${canvasRef.current.width} ${canvasRef.current.height}"><image href="${canvasRef.current.toDataURL("image/png")}" width="100%" height="100%"/></svg>`;
      downloadDataUrl(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        `halftone-${dpi}dpi-${Date.now()}.svg`,
      );
      return;
    }
    const img = await loadImage(src);
    const maxW = 900;
    const scale = Math.min(1, maxW / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    const tctx = tmp.getContext("2d")!;
    tctx.filter = `brightness(${1 + brightness / 100}) contrast(${contrast}) saturate(${saturation}) grayscale(1)`;
    tctx.drawImage(img, 0, 0, w, h);
    const imageData = tctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    let keyData: Uint8ClampedArray | null = null;
    if (removeBg) {
      const keyCanvas = document.createElement("canvas");
      keyCanvas.width = w;
      keyCanvas.height = h;
      const keyContext = keyCanvas.getContext("2d")!;
      keyContext.drawImage(img, 0, 0, w, h);
      keyData = keyContext.getImageData(0, 0, w, h).data;
      applyColorKey(data, keyData, backgroundMode, targetColor, tolerance, protectSubject);
    }

    let colorData: Uint8ClampedArray | null = null;
    if (colorMode === "color") {
      const ctmp = document.createElement("canvas");
      ctmp.width = w;
      ctmp.height = h;
      const cctx = ctmp.getContext("2d")!;
      cctx.filter = `brightness(${1 + brightness / 100}) contrast(${contrast}) saturate(${saturation})`;
      cctx.drawImage(img, 0, 0, w, h);
      colorData = cctx.getImageData(0, 0, w, h).data;
      applyGamma(colorData, gamma);
      if (keyData)
        applyColorKey(colorData, keyData, backgroundMode, targetColor, tolerance, protectSubject);
    }

    const step = Math.max(3, dotSize);
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad),
      sin = Math.sin(rad);
    const diag = Math.ceil(Math.hypot(w, h));
    const parts: string[] = [];
    if (previewBackground !== "transparent") {
      parts.push(`<rect width="${w}" height="${h}" fill="${previewBackground}"/>`);
    }

    for (let yy = -diag; yy < diag; yy += step) {
      for (let xx = -diag; xx < diag; xx += step) {
        const sx = Math.round(xx * cos - yy * sin + w / 2);
        const sy = Math.round(xx * sin + yy * cos + h / 2);
        if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
        const i = (sy * w + sx) * 4;
        if (data[i + 3] === 0) continue;
        const correctedLum = 255 * Math.pow(data[i] / 255, 1 / gamma);
        const rawDark = (darkGarment ? correctedLum / 255 : 1 - correctedLum / 255) * intensity;
        const darkness = solid ? (rawDark > 0.5 ? 1 : 0) : rawDark;
        if (darkness <= 0.02) continue;
        const cx = (xx * cos - yy * sin + w / 2).toFixed(2);
        const cy = (xx * sin + yy * cos + h / 2).toFixed(2);
        const fill = colorData
          ? `rgb(${colorData[i]},${colorData[i + 1]},${colorData[i + 2]})`
          : darkGarment
            ? "#ffffff"
            : knockoutColor;
        const opacity = (data[i + 3] / 255).toFixed(3);
        if (shape === "dot") {
          const r = (
            solid
              ? (step * maxDotSize) / 2
              : (step * minDotSize) / 2 +
                ((step * (maxDotSize - minDotSize)) / 2) * Math.sqrt(darkness)
          ).toFixed(2);
          parts.push(
            `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${opacity}"/>`,
          );
        } else {
          const len = solid
            ? step * maxDotSize
            : step * minDotSize + step * (maxDotSize - minDotSize) * Math.sqrt(darkness);
          const lw = Math.max(1, solid ? step * 0.4 : step * 0.4 * darkness).toFixed(2);
          parts.push(
            `<line x1="${(-len / 2).toFixed(2)}" y1="0" x2="${(len / 2).toFixed(2)}" y2="0" stroke="${fill}" opacity="${opacity}" stroke-width="${lw}" stroke-linecap="round" transform="translate(${cx} ${cy}) rotate(${angle})"/>`,
          );
          if (shape === "engraving") {
            parts.push(
              `<line x1="${(-len / 2).toFixed(2)}" y1="0" x2="${(len / 2).toFixed(2)}" y2="0" stroke="${fill}" opacity="${opacity}" stroke-width="${lw}" stroke-linecap="round" transform="translate(${cx} ${cy}) rotate(${angle + 90})"/>`,
            );
          }
        }
      }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${printWidth}cm" height="${printHeight}cm" viewBox="0 0 ${w} ${h}">${parts.join("")}</svg>`;
    downloadDataUrl(
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
      `halftone-${dpi}dpi-${Date.now()}.svg`,
    );
  }

  function download(format: "png" | "svg" | "jpg") {
    if (!canvasRef.current) return;
    if (format === "svg") {
      downloadSvg().catch((e) =>
        toast.error(e instanceof Error ? e.message : "Error exportando SVG"),
      );
    } else {
      const mime = format === "jpg" ? "image/jpeg" : "image/png";
      const outputWidth = Math.max(1, Math.round((printWidth / 2.54) * dpi));
      const outputHeight = Math.max(1, Math.round((printHeight / 2.54) * dpi));
      if (
        outputWidth > 16_384 ||
        outputHeight > 16_384 ||
        outputWidth * outputHeight > 100_000_000
      ) {
        return toast.error(
          "El tamaño de exportación excede el límite; reduce las dimensiones o los DPI",
        );
      }
      const output = document.createElement("canvas");
      output.width = outputWidth;
      output.height = outputHeight;
      const context = output.getContext("2d");
      if (!context) return toast.error("No se pudo preparar la imagen para exportar");
      if (format === "jpg") {
        context.fillStyle = bgColor;
        context.fillRect(0, 0, outputWidth, outputHeight);
      }
      context.drawImage(canvasRef.current, 0, 0, outputWidth, outputHeight);
      downloadDataUrl(output.toDataURL(mime, 0.95), `halftone-${dpi}dpi-${Date.now()}.${format}`);
    }
  }

  async function handleRemoveBg() {
    if (!src) return;
    setBgBusy(true);
    const t = toast.loading("Quitando fondo (puede tardar la primera vez)...");
    try {
      const out = await removeBackgroundClean(src);
      setSrc(out);
      toast.success("Fondo quitado, bordes limpios", { id: t });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error quitando fondo", { id: t });
    } finally {
      setBgBusy(false);
    }
  }

  async function handleAi(extraPrompt?: string) {
    if (!src) return;
    setAiBusy(true);
    try {
      const out = await aiImage(extraPrompt ?? prompt, [src]);
      setSrc(out);
      toast.success("Imagen actualizada por IA");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setAiBusy(false);
    }
  }

  const addPrintDesign = () => {
    const id = Date.now();
    const design = { id, x: 50, y: 50, width: 30 };
    setPrintDesigns((current) => [...current, design]);
    setActiveDesignId(id);
  };

  const updatePrintDesign = (id: number, patch: Partial<PrintDesign>) => {
    setPrintDesigns((current) =>
      current.map((design) => (design.id === id ? { ...design, ...patch } : design)),
    );
  };

  const handlePrintPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const design = printDesigns.find((item) => item.id === drag.id);
    if (!design) return;
    const x = ((event.clientX - bounds.left) / bounds.width) * 100 - drag.offsetX;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100 - drag.offsetY;
    updatePrintDesign(drag.id, {
      x: Math.min(100 - design.width / 2, Math.max(design.width / 2, x)),
      y: Math.min(98, Math.max(2, y)),
    });
  };

  const downloadPrintSheet = async () => {
    if (!previewDataUrl) return;
    const sheet =
      printFormat === "a3"
        ? { width: 29.7, height: 42, label: "A3" }
        : { width: 60, height: 100, label: "Pliego" };
    const width = Math.round((sheet.width / 2.54) * dpi);
    const height = Math.round((sheet.height / 2.54) * dpi);
    if (width > 16_384 || height > 16_384 || width * height > 100_000_000) {
      toast.error("El tamaño de impresión supera el límite; reduce los DPI");
      return;
    }
    try {
      const image = await loadImage(previewDataUrl);
      const output = document.createElement("canvas");
      output.width = width;
      output.height = height;
      const context = output.getContext("2d");
      if (!context) throw new Error("No se pudo preparar el pliego");
      if (printBackground !== "transparent") {
        context.fillStyle = printBackground === "white" ? "#ffffff" : "#000000";
        context.fillRect(0, 0, width, height);
      }
      for (const design of printDesigns) {
        const drawWidth = (design.width / 100) * width;
        const drawHeight = drawWidth * (image.height / image.width);
        context.drawImage(
          image,
          (design.x / 100) * width - drawWidth / 2,
          (design.y / 100) * height - drawHeight / 2,
          drawWidth,
          drawHeight,
        );
      }
      downloadDataUrl(output.toDataURL("image/png"), `pliego-${sheet.label}-${dpi}dpi.png`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo exportar el pliego");
    }
  };

  const downloadShirtMockup = () => {
    if (!previewDataUrl) return;
    const shirtPath =
      "M85 35 120 18 Q150 42 180 18 L215 35 272 80 245 130 220 112 220 340 80 340 80 112 55 130 28 80Z";
    const designWidth = shirtWidth * 1.7;
    const designHeight = designWidth * (printHeight / printWidth);
    const designY = 226 - designHeight / 2;
    const shirtDesign = `<image href="${previewDataUrl}" x="${(300 - designWidth) / 2}" y="${designY}" width="${designWidth}" height="${designHeight}" preserveAspectRatio="xMidYMid meet"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="700" viewBox="0 0 300 360"><path d="${shirtPath}" fill="${shirtColor}" stroke="#777" stroke-width="2"/>${shirtSide === "front" ? '<path d="M120 19 Q150 68 180 19" fill="none" stroke="#777" stroke-width="3"/>' : '<path d="M125 22 Q150 42 175 22" fill="none" stroke="#777" stroke-width="2"/>'}${shirtDesign}</svg>`;
    downloadDataUrl(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      `mockup-camiseta-${shirtSide}-${shirtSize}.svg`,
    );
  };

  if (!src) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Semitono (Halftone)"
          description="DTF / serigrafía: punto, ángulo, DPI, color y descarga."
        />
        <ImageDropzone
          onFiles={(f) => setSrc(f[0].dataUrl)}
          hint="Arrastra una imagen para empezar"
        />
      </div>
    );
  }

  return (
    <div className="grid min-h-[calc(100vh-6rem)] gap-3 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="max-h-[calc(100vh-7rem)] space-y-3 overflow-y-auto rounded-2xl border border-border bg-card/40 p-3">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg border border-border bg-background/95 p-2 backdrop-blur">
          <span className="text-sm font-bold">Sublimax PrintLab</span>
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="mr-1 h-4 w-4" />
            Reset
          </Button>
        </div>

        <Section title="1. Personalizado">
          <p className="text-xs font-medium text-muted-foreground">Tamaño imprimible</p>
          <div className="flex items-center gap-2">
            <p className="flex-1 rounded-md bg-primary/10 p-2 text-center text-sm font-semibold">
              {printWidth.toFixed(2)} × {printHeight.toFixed(2)} cm
            </p>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Bloquear proporción"
              onClick={() => setKeepRatio((value) => !value)}
            >
              {keepRatio ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </Button>
          </div>
          <label className="flex items-center gap-2 rounded-md border border-border p-2 text-xs">
            <input
              type="checkbox"
              checked={!keepRatio}
              onChange={(e) => setKeepRatio(!e.target.checked)}
            />
            Cambiar el alto manualmente
          </label>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Ancho (cm)"
              value={printWidth}
              min={1}
              max={100}
              step={0.01}
              onChange={(value) => {
                setPrintWidth(value);
              }}
            />
            <NumberField
              label="Alto (cm)"
              value={printHeight}
              min={1}
              max={100}
              step={0.01}
              disabled={keepRatio}
              onChange={setPrintHeight}
            />
          </div>
          <SliderRow label="Ancho" value={`${printWidth.toFixed(2)} cm`}>
            <Slider
              value={[printWidth]}
              min={1}
              max={50}
              step={0.1}
              onValueChange={(v) => {
                const width = v[0];
                setPrintWidth(width);
              }}
            />
          </SliderRow>
          <ImageDropzone
            onFiles={(files) => setSrc(files[0].dataUrl)}
            hint="Cargar o reemplazar imagen"
            className="p-3"
          />
        </Section>

        <Section title="2. Extracción de fondo">
          <ToggleRow
            label="Quitar color de fondo"
            checked={removeBg}
            onCheckedChange={setRemoveBg}
          />
          <p className="text-xs text-muted-foreground">Color objetivo</p>
          <div className="grid grid-cols-4 gap-1">
            {(["transparent", "white", "black", "color"] as BackgroundMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setBackgroundMode(mode);
                  setRemoveBg(true);
                  if (mode === "white") setTargetColor("#ffffff");
                  if (mode === "black") setTargetColor("#000000");
                }}
                className={`rounded-md px-1 py-2 text-[10px] font-semibold ${backgroundMode === mode ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {mode === "transparent"
                  ? "Transp."
                  : mode === "white"
                    ? "Blanco"
                    : mode === "black"
                      ? "Negro"
                      : "Color"}
              </button>
            ))}
          </div>
          {backgroundMode === "color" && (
            <ColorRow label="Color objetivo" value={targetColor} onChange={setTargetColor} />
          )}
          <SliderRow label="Tolerancia" value={tolerance}>
            <Slider
              value={[tolerance]}
              min={0}
              max={255}
              step={1}
              onValueChange={(v) => setTolerance(v[0])}
            />
          </SliderRow>
          <ToggleRow
            label="Proteger bordes del sujeto"
            checked={protectSubject}
            onCheckedChange={setProtectSubject}
          />
          <div className="grid grid-cols-2 gap-1 rounded-md bg-background p-1">
            <button
              onClick={() => setDarkGarment(true)}
              className={`rounded py-2 text-xs font-semibold ${darkGarment ? "bg-primary text-primary-foreground" : ""}`}
            >
              Prendas oscuras
            </button>
            <button
              onClick={() => setDarkGarment(false)}
              className={`rounded py-2 text-xs font-semibold ${!darkGarment ? "bg-primary text-primary-foreground" : ""}`}
            >
              Prendas claras
            </button>
          </div>
        </Section>

        <Section title="3. Trama y frecuencia">
          <ToggleRow
            label="Activar semitono"
            checked={tab !== "original"}
            onCheckedChange={(enabled) => setTab(enabled ? "preview" : "original")}
          />
          <p className="text-xs text-muted-foreground">Estilo de trama</p>
          <div className="grid grid-cols-3 gap-1 rounded-md bg-background p-1">
            {(["dot", "line", "engraving"] as Shape[]).map((item) => (
              <button
                key={item}
                onClick={() => setShape(item)}
                className={`rounded py-2 text-xs font-semibold ${shape === item ? "bg-primary text-primary-foreground" : ""}`}
              >
                {item === "dot" ? "Punto" : item === "line" ? "Línea" : "Grabado"}
              </button>
            ))}
          </div>
          <SliderRow label="Frecuencia" value={dotSize.toFixed(2)}>
            <Slider
              value={[dotSize]}
              min={3}
              max={30}
              step={0.1}
              onValueChange={(v) => setDotSize(v[0])}
            />
          </SliderRow>
          <SliderRow label="Tamaño mínimo" value={minDotSize.toFixed(2)}>
            <Slider
              value={[minDotSize]}
              min={0.02}
              max={0.6}
              step={0.01}
              onValueChange={(v) => setMinDotSize(Math.min(v[0], maxDotSize))}
            />
          </SliderRow>
          <SliderRow label="Tamaño máximo" value={maxDotSize.toFixed(2)}>
            <Slider
              value={[maxDotSize]}
              min={0.2}
              max={1}
              step={0.01}
              onValueChange={(v) => setMaxDotSize(Math.max(v[0], minDotSize))}
            />
          </SliderRow>
          <SliderRow label="Ángulo de línea" value={`${angle}°`}>
            <Slider
              value={[angle]}
              min={0}
              max={180}
              step={1}
              onValueChange={(v) => setAngle(v[0])}
            />
          </SliderRow>
          <SliderRow label="Intensidad de trama" value={intensity.toFixed(2)}>
            <Slider
              value={[intensity]}
              min={0.1}
              max={1}
              step={0.01}
              onValueChange={(v) => setIntensity(v[0])}
            />
          </SliderRow>
        </Section>

        <Section title="4. Ajustes de color">
          <SliderRow label="Brillo" value={brightness}>
            <Slider
              value={[brightness]}
              min={-50}
              max={50}
              step={1}
              onValueChange={(v) => setBrightness(v[0])}
            />
          </SliderRow>
          <SliderRow label="Contraste" value={contrast.toFixed(2)}>
            <Slider
              value={[contrast]}
              min={0.3}
              max={2.5}
              step={0.05}
              onValueChange={(v) => setContrast(v[0])}
            />
          </SliderRow>
          <SliderRow label="Saturación" value={saturation.toFixed(2)}>
            <Slider
              value={[saturation]}
              min={0}
              max={2}
              step={0.01}
              onValueChange={(v) => setSaturation(v[0])}
            />
          </SliderRow>
          <SliderRow label="Gamma" value={gamma.toFixed(2)}>
            <Slider
              value={[gamma]}
              min={0.2}
              max={2.5}
              step={0.01}
              onValueChange={(v) => setGamma(v[0])}
            />
          </SliderRow>
          <div className="grid grid-cols-2 gap-2">
            <ColorRow label="Tinta" value={knockoutColor} onChange={setKnockoutColor} />
            <ToggleRow
              label="Color original"
              checked={colorMode === "color"}
              onCheckedChange={(v) => setColorMode(v ? "color" : "bw")}
            />
          </div>
          <ToggleRow label="Sólido (sin degradados)" checked={solid} onCheckedChange={setSolid} />
        </Section>

        <Section title="5. Exportar">
          <p className="text-xs text-muted-foreground">Resolución de impresión</p>
          <div className="flex flex-wrap gap-1">
            {DPI_OPTS.map((d) => (
              <button
                key={d}
                onClick={() => setDpi(d)}
                className={`rounded px-2 py-1 text-xs ${dpi === d ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {d} dpi
              </button>
            ))}
          </div>
          <FormatDownload onDownload={download} />
        </Section>

        <Section title="Herramientas de IA">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> AI GENERATOR
          </div>
          <Textarea
            rows={6}
            placeholder="Describe cambios a la imagen..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <Button onClick={() => handleAi()} disabled={aiBusy || !prompt.trim()} className="w-full">
            {aiBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Aplicar IA
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={handleRemoveBg}
            disabled={aiBusy || bgBusy}
          >
            {bgBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Quitar fondo (transparente)
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() =>
              handleAi("Convierte en arte plano vectorial, colores sólidos, líneas limpias.")
            }
            disabled={aiBusy}
          >
            Vectorizar AI
          </Button>
          <Button variant="outline" size="sm" className="w-full" onClick={() => setSrc(null)}>
            Otra imagen
          </Button>
        </Section>
      </aside>

      <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border border-border bg-card/40">
        <div className="flex flex-wrap items-center justify-center gap-2 border-b border-border p-2">
          {(
            [
              ["compare", Columns2, "Antes / después"],
              ["shirt", Shirt, "Vista en camiseta"],
              ["print", Printer, "Preparar impresión"],
            ] as const
          ).map(([mode, Icon, label]) => (
            <Button
              key={mode}
              type="button"
              variant={workspaceMode === mode ? "default" : "outline"}
              size="sm"
              onClick={() => setWorkspaceMode(mode)}
            >
              <Icon className="mr-1 h-4 w-4" />
              {label}
            </Button>
          ))}
          {workspaceMode === "compare" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Zoom</span>
              <Slider
                className="w-32"
                value={[zoom]}
                min={50}
                max={1500}
                step={10}
                onValueChange={(v) => setZoom(v[0])}
              />
              <span className="w-14 text-xs tabular-nums">{zoom}%</span>
            </div>
          )}
          {workspaceMode === "print" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Zoom</span>
              <Slider
                className="w-24"
                value={[printZoom]}
                min={60}
                max={150}
                step={10}
                onValueChange={(v) => setPrintZoom(v[0])}
              />
              <span className="w-10 text-xs tabular-nums">{printZoom}%</span>
            </div>
          )}
        </div>

        {workspaceMode === "compare" && (
          <div className="grid min-h-[68vh] flex-1 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="flex h-[68vh] min-h-[60vh] items-start justify-start overflow-auto bg-neutral-950 p-5">
              <div
                className="relative shrink-0 overflow-hidden"
                style={{
                  width: `${zoom}%`,
                  aspectRatio: String(1 / aspectRatio),
                  margin: zoom <= 100 ? "auto" : undefined,
                  background:
                    previewBackground === "transparent"
                      ? "repeating-conic-gradient(#ddd 0% 25%, white 0% 50%) 50% / 16px 16px"
                      : previewBackground,
                }}
              >
                {previewDataUrl && (
                  <>
                    <img
                      src={src}
                      alt="Imagen original"
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}
                    >
                      <img
                        src={previewDataUrl}
                        alt="Imagen con semitono"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="absolute bottom-3 left-3 z-10 rounded-full bg-background/90 px-3 py-1 text-xs font-bold">
                      DESPUÉS
                    </div>
                    <div className="absolute bottom-3 right-3 z-10 rounded-full bg-background/90 px-3 py-1 text-xs font-bold">
                      ANTES
                    </div>
                    <div
                      className="absolute bottom-0 top-0 w-0.5 bg-white shadow"
                      style={{ left: `${comparePosition}%` }}
                    />
                    <input
                      aria-label="Comparar antes y después"
                      type="range"
                      min={5}
                      max={95}
                      value={comparePosition}
                      onChange={(event) => setComparePosition(Number(event.target.value))}
                      className="absolute inset-x-0 bottom-0 z-20 h-8 w-full cursor-ew-resize opacity-0"
                    />
                  </>
                )}
              </div>
            </div>
            <aside className="space-y-4 border-l border-border bg-background/80 p-4">
              <Section title="Fondo preview">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    [
                      "transparent",
                      "Transparente",
                      "repeating-conic-gradient(#ddd 0% 25%, white 0% 50%) 50% / 16px 16px",
                    ],
                    ["#ffffff", "Blanco", "#ffffff"],
                    ["#000000", "Negro", "#000000"],
                    [customPreviewBackground, "Color", customPreviewBackground],
                  ].map(([value, label, color]) => (
                    <button
                      key={label}
                      onClick={() => {
                        setPreviewBackground(value);
                        setBgColor(value === "transparent" ? "#ffffff" : value);
                      }}
                      className={`rounded-lg border p-2 text-xs font-semibold ${previewBackground === value ? "border-primary ring-1 ring-primary" : "border-border"}`}
                    >
                      <span className="mb-1 block h-8 rounded" style={{ background: color }} />
                      {label}
                    </button>
                  ))}
                </div>
                <ColorRow
                  label="Color personalizado"
                  value={customPreviewBackground}
                  onChange={(color) => {
                    setCustomPreviewBackground(color);
                    setPreviewBackground(color);
                    setBgColor(color);
                  }}
                />
                <p className="text-xs text-muted-foreground">Separador antes / después</p>
                <Slider
                  value={[comparePosition]}
                  min={5}
                  max={95}
                  step={1}
                  onValueChange={(v) => setComparePosition(v[0])}
                />
              </Section>
              <Section title="Semitono según la prenda">
                <p className="text-xs text-muted-foreground">Tono que se sustituye por la tela</p>
                <div className="flex flex-wrap gap-2">
                  {SHIRT_COLORS.map((color) => (
                    <button
                      key={color}
                      aria-label={`Usar tono de prenda ${color}`}
                      onClick={() => selectGarmentColor(color)}
                      className={`h-8 w-8 rounded-full border-2 ${shirtColor === color ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    aria-label="Elegir color de prenda"
                    type="color"
                    value={shirtColor}
                    onChange={(event) => selectGarmentColor(event.target.value)}
                    className="h-8 w-8 cursor-pointer rounded-full"
                  />
                </div>
                <ToggleRow
                  label="Aplicar semitono solo a tonos de la prenda"
                  checked={garmentHalftone}
                  onCheckedChange={setGarmentHalftone}
                />
                <SliderRow label="Rango de tonos similares" value={garmentTolerance}>
                  <Slider
                    value={[garmentTolerance]}
                    min={0}
                    max={255}
                    step={1}
                    onValueChange={(values) => setGarmentTolerance(values[0])}
                  />
                </SliderRow>
                <p className="text-[11px] text-muted-foreground">
                  Las áreas parecidas al color de la prenda se vuelven transparentes y reciben la
                  trama; el resto de la ilustración conserva su color.
                </p>
              </Section>
            </aside>
          </div>
        )}

        {workspaceMode === "shirt" && (
          <div className="grid min-h-[68vh] flex-1 lg:grid-cols-[230px_minmax(0,1fr)]">
            <aside className="space-y-4 border-r border-border bg-background/80 p-4">
              <Section title="Vista en camiseta">
                <p className="text-xs text-muted-foreground">Lado de la camiseta</p>
                <div className="grid grid-cols-2 gap-1">
                  {(["front", "back"] as const).map((side) => (
                    <Button
                      key={side}
                      size="sm"
                      variant={shirtSide === side ? "default" : "outline"}
                      onClick={() => setShirtSide(side)}
                    >
                      {side === "front" ? "Frente" : "Atrás"}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Color de la camiseta</p>
                <div className="flex flex-wrap gap-2">
                  {SHIRT_COLORS.map((color) => (
                    <button
                      key={color}
                      aria-label={`Camiseta ${color}`}
                      onClick={() => selectGarmentColor(color)}
                      className={`h-8 w-8 rounded-full border-2 ${shirtColor === color ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    aria-label="Color personalizado de camiseta"
                    type="color"
                    value={shirtColor}
                    onChange={(e) => selectGarmentColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded-full"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Talla</p>
                <div className="grid grid-cols-4 gap-1">
                  {SHIRT_SIZES.map((size) => (
                    <Button
                      key={size}
                      size="sm"
                      variant={shirtSize === size ? "default" : "outline"}
                      onClick={() => setShirtSize(size)}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
                <div className="rounded-md border border-border p-2 text-xs text-muted-foreground">
                  <p className="flex justify-between">
                    <span>Talla seleccionada</span>
                    <strong className="text-foreground">{shirtSize}</strong>
                  </p>
                  <p className="mt-1">
                    Mockup visual proporcional; confirma medidas reales antes de imprimir.
                  </p>
                </div>
                <SliderRow label="Ancho sobre pecho" value={`${shirtWidth}%`}>
                  <Slider
                    value={[shirtWidth]}
                    min={20}
                    max={80}
                    step={1}
                    onValueChange={(v) => setShirtWidth(v[0])}
                  />
                </SliderRow>
                <p className="text-xs text-muted-foreground">
                  Diseño aprox.: {((SHIRT_CHEST_WIDTH[shirtSize] * shirtWidth) / 100).toFixed(1)} cm
                  de ancho
                </p>
                <Button className="w-full" onClick={downloadShirtMockup}>
                  Descargar mockup
                </Button>
                <Button variant="outline" className="w-full" onClick={() => download("png")}>
                  Descargar sólo diseño
                </Button>
              </Section>
            </aside>
            <div className="relative flex min-h-[60vh] items-center justify-center overflow-hidden bg-neutral-950 p-8">
              <ShirtPreview
                color={shirtColor}
                side={shirtSide}
                design={previewDataUrl}
                width={shirtWidth}
              />
              <span className="absolute bottom-4 rounded-full bg-black/80 px-3 py-1 text-xs font-bold text-white">
                TALLA {shirtSize} · {shirtSide === "front" ? "FRENTE" : "ATRÁS"}
              </span>
            </div>
          </div>
        )}

        {workspaceMode === "print" && (
          <div className="grid min-h-[68vh] flex-1 lg:grid-cols-[230px_minmax(0,1fr)]">
            <aside className="space-y-4 border-r border-border bg-background/80 p-4">
              <Section title="Preparar impresión">
                <p className="text-xs text-muted-foreground">Formato de pliego</p>
                <div className="grid grid-cols-2 gap-1">
                  <Button
                    size="sm"
                    variant={printFormat === "a3" ? "default" : "outline"}
                    onClick={() => setPrintFormat("a3")}
                  >
                    A3 · 29.7 × 42 cm
                  </Button>
                  <Button
                    size="sm"
                    variant={printFormat === "roll" ? "default" : "outline"}
                    onClick={() => setPrintFormat("roll")}
                  >
                    Rollo · 60 × 100 cm
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Color del lienzo</p>
                <div className="grid grid-cols-3 gap-1">
                  {(["white", "black", "transparent"] as const).map((color) => (
                    <Button
                      key={color}
                      size="sm"
                      variant={printBackground === color ? "default" : "outline"}
                      onClick={() => setPrintBackground(color)}
                    >
                      {color === "white" ? "Blanco" : color === "black" ? "Negro" : "Transparente"}
                    </Button>
                  ))}
                </div>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {printDesigns.map((design, index) => (
                    <button
                      key={design.id}
                      onClick={() => setActiveDesignId(design.id)}
                      className={`flex w-full items-center gap-2 rounded-md border p-2 text-left text-xs ${activeDesignId === design.id ? "border-primary bg-primary/10" : "border-border"}`}
                    >
                      {previewDataUrl && (
                        <img src={previewDataUrl} alt="" className="h-8 w-8 rounded object-cover" />
                      )}
                      {index + 1}. Diseño de semitono
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={addPrintDesign}>
                    <Plus className="mr-1 h-4 w-4" />
                    Agregar copia
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={printDesigns.length <= 1}
                    onClick={() => {
                      const remaining = printDesigns.filter(
                        (design) => design.id !== activeDesignId,
                      );
                      setPrintDesigns(remaining);
                      setActiveDesignId(remaining[0]?.id ?? 0);
                    }}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Eliminar
                  </Button>
                </div>
                {printDesigns.find((design) => design.id === activeDesignId) && (
                  <SliderRow
                    label="Ancho del diseño"
                    value={`${printDesigns.find((design) => design.id === activeDesignId)!.width}%`}
                  >
                    <Slider
                      value={[printDesigns.find((design) => design.id === activeDesignId)!.width]}
                      min={8}
                      max={90}
                      step={1}
                      onValueChange={(v) => updatePrintDesign(activeDesignId, { width: v[0] })}
                    />
                  </SliderRow>
                )}
                <p className="text-xs text-muted-foreground">
                  Arrastra cada diseño sobre el pliego para acomodarlo.
                </p>
                <Button className="w-full" onClick={downloadPrintSheet}>
                  Descargar pliego PNG · {dpi} DPI
                </Button>
                <Button variant="outline" className="w-full" onClick={() => download("png")}>
                  Descargar sólo diseño
                </Button>
              </Section>
            </aside>
            <div className="flex min-h-[60vh] items-center justify-center overflow-auto bg-neutral-950 p-4">
              {(() => {
                const sheet =
                  printFormat === "a3" ? { width: 29.7, height: 42 } : { width: 60, height: 100 };
                const checker = "repeating-linear-gradient(45deg,#fff 0 8px,#e5e7eb 8px 16px)";
                return (
                  <div
                    className="relative h-[68vh] max-w-full overflow-hidden border-2 border-border shadow-2xl"
                    style={{
                      aspectRatio: `${sheet.width} / ${sheet.height}`,
                      width: `min(100%, ${(68 * sheet.width) / sheet.height}vh)`,
                      background: printBackground === "transparent" ? checker : printBackground,
                      transform: `scale(${printZoom / 100})`,
                      touchAction: "none",
                    }}
                    onPointerMove={handlePrintPointerMove}
                    onPointerUp={() => {
                      dragRef.current = null;
                    }}
                    onPointerCancel={() => {
                      dragRef.current = null;
                    }}
                  >
                    {printDesigns.map(
                      (design, index) =>
                        previewDataUrl && (
                          <img
                            key={design.id}
                            src={previewDataUrl}
                            alt={`Diseño ${index + 1}`}
                            draggable={false}
                            onPointerDown={(event) => {
                              event.preventDefault();
                              event.currentTarget.setPointerCapture(event.pointerId);
                              setActiveDesignId(design.id);
                              const bounds =
                                event.currentTarget.parentElement!.getBoundingClientRect();
                              dragRef.current = {
                                id: design.id,
                                offsetX:
                                  ((event.clientX - bounds.left) / bounds.width) * 100 - design.x,
                                offsetY:
                                  ((event.clientY - bounds.top) / bounds.height) * 100 - design.y,
                              };
                            }}
                            className={`absolute cursor-move select-none border-2 object-contain ${activeDesignId === design.id ? "border-primary" : "border-transparent"}`}
                            style={{
                              left: `${design.x}%`,
                              top: `${design.y}%`,
                              width: `${design.width}%`,
                              transform: "translate(-50%, -50%)",
                              touchAction: "none",
                            }}
                          />
                        ),
                    )}
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/70 px-2 py-1 text-[10px] font-bold text-white">
                      {sheet.width} × {sheet.height} cm
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      </section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-background/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

function ShirtPreview({
  color,
  side,
  design,
  width,
}: {
  color: string;
  side: "front" | "back";
  design: string | null;
  width: number;
}) {
  return (
    <div className="relative aspect-[5/6] w-full max-w-[440px]">
      <svg
        viewBox="0 0 300 360"
        role="img"
        aria-label={`Vista de camiseta ${side === "front" ? "frontal" : "trasera"}`}
        className="absolute inset-0 h-full w-full drop-shadow-2xl"
      >
        <defs>
          <linearGradient id="shirt-shade" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity=".48" />
            <stop offset="48%" stopColor={color} />
            <stop offset="100%" stopColor="#000000" stopOpacity=".2" />
          </linearGradient>
        </defs>
        <path
          d="M85 35 120 18 Q150 42 180 18 L215 35 272 80 245 130 220 112 220 340 80 340 80 112 55 130 28 80Z"
          fill="url(#shirt-shade)"
          stroke="#777"
          strokeWidth="2"
        />
        <path
          d={side === "front" ? "M120 20 Q150 69 180 20" : "M127 24 Q150 45 173 24"}
          fill="none"
          stroke="#777"
          strokeWidth="4"
        />
        <path
          d="M83 125 83 333 M217 125 217 333 M90 334 210 334"
          fill="none"
          stroke="#777"
          strokeOpacity=".35"
          strokeWidth="2"
        />
      </svg>
      {design && (
        <img
          src={design}
          alt="Diseño aplicado en la camiseta"
          className="absolute left-1/2 top-[49%] max-h-[60%] -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-md"
          style={{ width: `${width * 0.46}%` }}
        />
      )}
    </div>
  );
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function applyGamma(data: Uint8ClampedArray, gamma: number) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 * Math.pow(data[i] / 255, 1 / gamma);
    data[i + 1] = 255 * Math.pow(data[i + 1] / 255, 1 / gamma);
    data[i + 2] = 255 * Math.pow(data[i + 2] / 255, 1 / gamma);
  }
}

function applyColorKey(
  data: Uint8ClampedArray,
  source: Uint8ClampedArray,
  mode: BackgroundMode,
  target: string,
  tolerance: number,
  protectEdges: boolean,
) {
  const key = hexToRgb(mode === "white" ? "#ffffff" : mode === "black" ? "#000000" : target);
  const featherWidth = tolerance * 0.25;
  for (let i = 0; i < data.length; i += 4) {
    const distance = Math.hypot(source[i] - key.r, source[i + 1] - key.g, source[i + 2] - key.b);
    if (protectEdges) {
      const alpha =
        tolerance === 0
          ? Number(distance > 0)
          : Math.max(0, Math.min(1, (distance - tolerance * 0.75) / featherWidth));
      data[i + 3] = Math.round(data[i + 3] * alpha);
    } else if (distance <= tolerance) {
      data[i + 3] = 0;
    }
  }
}

function createGarmentMask(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  color: string,
  tolerance: number,
): GarmentMask {
  const { r, g, b } = hexToRgb(color);
  const pixelCount = width * height;
  const edgeBackground = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;
  const isMatch = (pixel: number) => {
    const offset = pixel * 4;
    if (source[offset + 3] === 0) return false;
    return (
      Math.hypot(source[offset] - r, source[offset + 1] - g, source[offset + 2] - b) <= tolerance
    );
  };
  const addEdgePixel = (pixel: number) => {
    if (edgeBackground[pixel] || !isMatch(pixel)) return;
    edgeBackground[pixel] = 1;
    queue[tail++] = pixel;
  };

  for (let x = 0; x < width; x++) {
    addEdgePixel(x);
    addEdgePixel((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    addEdgePixel(y * width);
    addEdgePixel(y * width + width - 1);
  }

  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    if (x > 0) addEdgePixel(pixel - 1);
    if (x + 1 < width) addEdgePixel(pixel + 1);
    if (pixel >= width) addEdgePixel(pixel - width);
    if (pixel + width < pixelCount) addEdgePixel(pixel + width);
  }

  const dots = new Uint8ClampedArray(pixelCount);
  const featherStart = tolerance * 0.7;
  for (let pixel = 0; pixel < pixelCount; pixel++) {
    if (edgeBackground[pixel]) continue;
    const offset = pixel * 4;
    if (source[offset + 3] === 0) continue;
    const distance = Math.hypot(source[offset] - r, source[offset + 1] - g, source[offset + 2] - b);
    if (tolerance === 0) {
      dots[pixel] = distance === 0 ? 255 : 0;
    } else if (distance <= featherStart) {
      dots[pixel] = 255;
    } else if (distance < tolerance) {
      dots[pixel] = Math.round(255 * (1 - (distance - featherStart) / (tolerance - featherStart)));
    }
  }
  return { dots, background: edgeBackground };
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1 text-xs text-muted-foreground">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number(value.toFixed(2))}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next) && next >= min && next <= max) onChange(next);
        }}
        className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground disabled:opacity-50"
      />
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-background/60 px-2 py-2 text-xs">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="h-4 w-4 accent-primary"
      />
    </label>
  );
}

function ColorRow({
  label,
  value,
  onChange,
  enabled,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  enabled?: boolean;
  onToggle?: (v: boolean) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        {onToggle && (
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />{" "}
            Enable
          </label>
        )}
      </div>
      <div className="flex items-center gap-2 rounded border border-border bg-background p-1">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 cursor-pointer bg-transparent"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-xs outline-none"
        />
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  children,
}: {
  label: string;
  value: string | number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  );
}

function FormatDownload({ onDownload }: { onDownload: (f: "png" | "svg" | "jpg") => void }) {
  const [fmt, setFmt] = useState<"png" | "svg" | "jpg">("png");
  return (
    <div className="flex gap-1 pt-1">
      <Select value={fmt} onValueChange={(v) => setFmt(v as typeof fmt)}>
        <SelectTrigger className="h-8 flex-1 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="png">PNG</SelectItem>
          <SelectItem value="svg">SVG</SelectItem>
          <SelectItem value="jpg">JPG</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" onClick={() => onDownload(fmt)}>
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}
