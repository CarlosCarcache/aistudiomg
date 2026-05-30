import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Wand2, Download, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ImageTracer from "imagetracerjs";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageDropzone, type DroppedFile } from "@/components/image-dropzone";
import { aiImage, downloadDataUrl, loadImage } from "@/lib/image-utils";
import { PageHeader } from "@/views/PageHeader";

export const Route = createFileRoute("/_authenticated/vectorize")({
  component: VectorizePage,
});

type VFormat = "svg" | "png";

function VectorizePage() {
  const [src, setSrc] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [colors, setColors] = useState(8);
  const [ltres, setLtres] = useState(1);
  const [qtres, setQtres] = useState(1);
  const [tintColor, setTintColor] = useState("#000000");
  const [tintEnabled, setTintEnabled] = useState(false);
  const [format, setFormat] = useState<VFormat>("svg");
  const [loading, setLoading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  async function handleVectorize() {
    if (!src) return;
    setLoading(true);
    try {
      const img = await loadImage(src);
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
        pathomit: 8,
        strokewidth: 1,
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
    if (!src) return;
    setAiBusy(true);
    try {
      const out = await aiImage(
        "Limpia esta imagen y prepárala para vectorizar: fondo transparente, colores planos sólidos, bordes nítidos, sin ruido ni sombras.",
        [src],
      );
      setSrc(out);
      toast.success("Imagen preparada por IA");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setAiBusy(false);
    }
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
      <PageHeader title="Vectorizar" description="Convierte raster a SVG. Manual con controles o asistido por IA." />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <ImageDropzone
            preview={src}
            onClear={() => {
              setSrc(null);
              setSvg(null);
            }}
            onFiles={(f) => setSrc(f[0].dataUrl)}
          />

          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <Label label="Colores" value={colors} />
            <Slider value={[colors]} min={2} max={32} step={1} onValueChange={(v) => setColors(v[0])} />
            <Label label="Detalle líneas" value={ltres} />
            <Slider value={[ltres]} min={0.1} max={3} step={0.1} onValueChange={(v) => setLtres(v[0])} />
            <Label label="Suavizado" value={qtres} />
            <Slider value={[qtres]} min={0.1} max={3} step={0.1} onValueChange={(v) => setQtres(v[0])} />

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
          {svg ? (
            <div className="space-y-3">
              <div
                className="mx-auto max-h-[520px] overflow-auto rounded-xl bg-white p-2 [&_svg]:mx-auto [&_svg]:max-h-[500px]"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <div className="flex items-center justify-end gap-2">
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
          ) : (
            <div className="grid h-full min-h-[420px] place-items-center text-center text-sm text-muted-foreground">
              <div>
                <Wand2 className="mx-auto h-10 w-10" />
                <p className="mt-2">Sube una imagen y pulsa Vectorizar.</p>
              </div>
            </div>
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
