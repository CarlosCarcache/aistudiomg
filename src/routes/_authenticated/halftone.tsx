import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CircleDot, Download, RotateCcw, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ImageDropzone } from "@/components/image-dropzone";
import { aiImage, downloadDataUrl, loadImage } from "@/lib/image-utils";
import { PageHeader } from "@/views/PageHeader";

export const Route = createFileRoute("/_authenticated/halftone")({
  component: HalftonePage,
});

type Shape = "dot" | "line";
type Tab = "original" | "preview" | "export" | "mask";
type ColorMode = "color" | "bw";

const DPI_OPTS = [300, 400, 500, 600, 700, 800];

function HalftonePage() {
  const [src, setSrc] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("preview");
  const [knockoutColor, setKnockoutColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [bgEnabled, setBgEnabled] = useState(true);
  const [shape, setShape] = useState<Shape>("dot");
  const [dotSize, setDotSize] = useState(10);
  const [angle, setAngle] = useState(45);
  const [dpi, setDpi] = useState(300);
  const [contrast, setContrast] = useState(1);
  const [brightness, setBrightness] = useState(0);
  const [colorMode, setColorMode] = useState<ColorMode>("bw");
  const [solid, setSolid] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!src) return;
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, tab, knockoutColor, bgColor, bgEnabled, shape, dotSize, angle, contrast, brightness, colorMode, solid]);

  async function render() {
    if (!src || !canvasRef.current) return;
    const img = await loadImage(src);
    const c = canvasRef.current;
    const maxW = 900;
    const scale = Math.min(1, maxW / img.width);
    c.width = img.width * scale;
    c.height = img.height * scale;
    const ctx = c.getContext("2d")!;

    if (tab === "original") {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return;
    }

    // Fill BG
    if (bgEnabled) {
      ctx.fillStyle = bgColor;
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
    const data = tctx.getImageData(0, 0, c.width, c.height).data;

    // Color original (opcional) para modo color
    let colorData: Uint8ClampedArray | null = null;
    if (colorMode === "color") {
      const ctmp = document.createElement("canvas");
      ctmp.width = c.width;
      ctmp.height = c.height;
      const cctx = ctmp.getContext("2d")!;
      cctx.filter = `brightness(${1 + brightness / 100}) contrast(${contrast})`;
      cctx.drawImage(img, 0, 0, c.width, c.height);
      colorData = cctx.getImageData(0, 0, c.width, c.height).data;
    }

    const step = Math.max(3, dotSize);
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const diag = Math.ceil(Math.hypot(c.width, c.height));

    ctx.fillStyle = knockoutColor;
    ctx.strokeStyle = knockoutColor;
    ctx.lineCap = "round";

    for (let yy = -diag; yy < diag; yy += step) {
      for (let xx = -diag; xx < diag; xx += step) {
        const sx = Math.round(xx * cos - yy * sin + c.width / 2);
        const sy = Math.round(xx * sin + yy * cos + c.height / 2);
        if (sx < 0 || sx >= c.width || sy < 0 || sy >= c.height) continue;
        const i = (sy * c.width + sx) * 4;
        const lum = data[i];
        const rawDark = 1 - lum / 255;
        // Solid: umbral duro (sin degradados), tamaño completo
        const darkness = solid ? (rawDark > 0.5 ? 1 : 0) : rawDark;
        if (darkness <= 0.02) continue;

        const cx = xx * cos - yy * sin + c.width / 2;
        const cy = xx * sin + yy * cos + c.height / 2;

        // Color del punto
        if (colorData) {
          ctx.fillStyle = `rgb(${colorData[i]}, ${colorData[i + 1]}, ${colorData[i + 2]})`;
          ctx.strokeStyle = ctx.fillStyle;
        } else {
          ctx.fillStyle = knockoutColor;
          ctx.strokeStyle = knockoutColor;
        }

        if (shape === "dot") {
          const r = solid ? step / 2 : (step / 2) * Math.sqrt(darkness);
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const len = solid ? step : step * darkness;
          ctx.lineWidth = solid ? Math.max(1, step * 0.4) : Math.max(1, step * 0.4 * darkness);
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rad);
          ctx.beginPath();
          ctx.moveTo(-len / 2, 0);
          ctx.lineTo(len / 2, 0);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  function reset() {
    setKnockoutColor("#000000");
    setBgColor("#ffffff");
    setBgEnabled(true);
    setShape("dot");
    setDotSize(10);
    setAngle(45);
    setDpi(300);
    setContrast(1);
    setBrightness(0);
    setColorMode("bw");
    setSolid(false);
  }

  function download(format: "png" | "svg" | "jpg") {
    if (!canvasRef.current) return;
    if (format === "svg") {
      const c = canvasRef.current;
      const dataUrl = c.toDataURL("image/png");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}"><image href="${dataUrl}" width="${c.width}" height="${c.height}"/></svg>`;
      downloadDataUrl("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg), `halftone-${dpi}dpi-${Date.now()}.svg`);
    } else {
      const mime = format === "jpg" ? "image/jpeg" : "image/png";
      downloadDataUrl(canvasRef.current.toDataURL(mime, 0.95), `halftone-${dpi}dpi-${Date.now()}.${format}`);
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

  if (!src) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="Semitono (Halftone)" description="DTF / serigrafía: punto, ángulo, DPI, color y descarga." />
        <ImageDropzone onFiles={(f) => setSrc(f[0].dataUrl)} hint="Arrastra una imagen para empezar" />
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-6rem)] grid-cols-[260px_1fr_320px] gap-3">
      {/* LEFT: prompt + AI */}
      <aside className="space-y-3 overflow-y-auto rounded-2xl border border-border bg-card/40 p-3">
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
          {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Aplicar IA
        </Button>
        <Button variant="secondary" size="sm" className="w-full" onClick={() => handleAi("Quita el fondo, deja sujeto sobre transparente.")} disabled={aiBusy}>
          Quitar fondo
        </Button>
        <Button variant="secondary" size="sm" className="w-full" onClick={() => handleAi("Convierte en arte plano vectorial, colores sólidos, líneas limpias.")} disabled={aiBusy}>
          Vectorizar AI
        </Button>
        <Button variant="outline" size="sm" className="w-full" onClick={() => setSrc(null)}>
          Otra imagen
        </Button>
      </aside>

      {/* CENTER: preview tabs + canvas */}
      <section className="flex flex-col rounded-2xl border border-border bg-card/40">
        <div className="flex items-center justify-center gap-1 border-b border-border p-2">
          {(["original", "preview", "export", "mask"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm capitalize transition-colors ${
                tab === t ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto p-4">
          <canvas ref={canvasRef} className="max-h-full max-w-full rounded-lg shadow" />
        </div>
      </section>

      {/* RIGHT: controls */}
      <aside className="space-y-4 overflow-y-auto rounded-2xl border border-border bg-card/40 p-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        </div>

        <Section title="Color">
          <ColorRow label="Knockout" value={knockoutColor} onChange={setKnockoutColor} />
          <ColorRow
            label="BG"
            value={bgColor}
            onChange={setBgColor}
            enabled={bgEnabled}
            onToggle={setBgEnabled}
          />
        </Section>

        <Section title="Halftone Pattern">
          <p className="text-xs text-muted-foreground">Dot Shape</p>
          <div className="grid grid-cols-2 gap-1 rounded-md border border-border p-1">
            <button onClick={() => setShape("dot")} className={`rounded py-1.5 text-sm ${shape === "dot" ? "bg-foreground text-background" : ""}`}>
              <CircleDot className="mx-auto h-4 w-4" />
            </button>
            <button onClick={() => setShape("line")} className={`rounded py-1.5 text-sm ${shape === "line" ? "bg-foreground text-background" : ""}`}>
              ≡
            </button>
          </div>
          <SliderRow label="Dot Size" value={`${dotSize.toFixed(1)} px`}>
            <Slider value={[dotSize]} min={3} max={30} step={0.5} onValueChange={(v) => setDotSize(v[0])} />
          </SliderRow>
          <SliderRow label="Dot Angle" value={`${angle}°`}>
            <Slider value={[angle]} min={0} max={180} step={1} onValueChange={(v) => setAngle(v[0])} />
          </SliderRow>
        </Section>

        <Section title="Tonal Balance">
          <SliderRow label="Contraste" value={contrast.toFixed(2)}>
            <Slider value={[contrast]} min={0.3} max={2.5} step={0.05} onValueChange={(v) => setContrast(v[0])} />
          </SliderRow>
          <SliderRow label="Brillo" value={brightness}>
            <Slider value={[brightness]} min={-50} max={50} step={1} onValueChange={(v) => setBrightness(v[0])} />
          </SliderRow>
        </Section>

        <Section title="Export">
          <p className="text-xs text-muted-foreground">DPI</p>
          <div className="flex flex-wrap gap-1">
            {DPI_OPTS.map((d) => (
              <button
                key={d}
                onClick={() => setDpi(d)}
                className={`rounded px-2 py-1 text-xs ${dpi === d ? "bg-foreground text-background" : "bg-muted"}`}
              >
                {d}
              </button>
            ))}
          </div>
          <FormatDownload onDownload={download} />
        </Section>
      </aside>
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

function ColorRow({
  label, value, onChange, enabled, onToggle,
}: { label: string; value: string; onChange: (v: string) => void; enabled?: boolean; onToggle?: (v: boolean) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        {onToggle && (
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} /> Enable
          </label>
        )}
      </div>
      <div className="flex items-center gap-2 rounded border border-border bg-background p-1">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 cursor-pointer bg-transparent" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-xs outline-none"
        />
      </div>
    </div>
  );
}

function SliderRow({ label, value, children }: { label: string; value: string | number; children: React.ReactNode }) {
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
