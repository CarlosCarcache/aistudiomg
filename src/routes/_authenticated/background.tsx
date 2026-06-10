import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Layers, Loader2, Download, Sparkles, Eraser } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImageDropzone } from "@/components/image-dropzone";
import { aiImage, downloadDataUrl } from "@/lib/image-utils";
import { PageHeader } from "@/views/PageHeader";
import { removeBackground } from "@imgly/background-removal";

export const Route = createFileRoute("/_authenticated/background")({
  component: BackgroundPage,
});

const PRESETS = [
  { label: "Limpiar imagen", prompt: "Limpia esta imagen, quita ruido y artefactos, conserva el sujeto principal nítido." },
  { label: "Fondo blanco", prompt: "Reemplaza el fondo por un blanco puro liso." },
  { label: "Fondo estudio", prompt: "Coloca al sujeto sobre un fondo de estudio gris degradado profesional." },
];

function BackgroundPage() {
  const [src, setSrc] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  async function run(p: string) {
    if (!src) return toast.error("Sube una imagen");
    if (!p.trim()) return;
    setLoading(true);
    try {
      const out = await aiImage(p, [result ?? src]);
      setResult(out);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function removeBg() {
    if (!src) return toast.error("Sube una imagen");
    setLoading(true);
    const t = toast.loading("Quitando fondo (puede tardar la primera vez)...");
    try {
      const input = result ?? src;
      const blob = await removeBackground(input);
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(new Error("read"));
        r.readAsDataURL(blob);
      });
      setResult(dataUrl);
      toast.success("Fondo quitado", { id: t });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error quitando fondo", { id: t });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Fondos" description="Quita fondo, limpia, agrega fondos nuevos o pide cambios por texto." />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <ImageDropzone
            preview={src}
            onClear={() => { setSrc(null); setResult(null); }}
            onFiles={(f) => { setSrc(f[0].dataUrl); setResult(null); }}
          />

          <div className="space-y-2 rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium">Acciones rápidas</p>
            <Button disabled={!src || loading} onClick={removeBg} className="w-full">
              <Eraser className="h-4 w-4" />
              Quitar fondo (transparente)
            </Button>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <Button key={p.label} variant="secondary" size="sm" disabled={!src || loading} onClick={() => run(p.prompt)}>
                  <Layers className="h-4 w-4" />
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="Ej: cámbiale el fondo a una playa al atardecer..."
          />
          <Button onClick={() => run(prompt)} disabled={!src || loading || !prompt.trim()} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Aplicar cambio
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-card/30 p-4">
          {result ? (
            <div className="space-y-3">
              <img
                src={result}
                alt="result"
                className="mx-auto max-h-[520px] rounded-xl"
                style={{ background: "repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 50% / 16px 16px" }}
              />
              <div className="flex justify-end">
                <Button onClick={() => downloadDataUrl(result, `bg-${Date.now()}.png`)}>
                  <Download className="h-4 w-4" />
                  Descargar PNG
                </Button>
              </div>
            </div>
          ) : src ? (
            <img src={src} alt="src" className="mx-auto max-h-[520px] rounded-xl" />
          ) : (
            <div className="grid h-full min-h-[420px] place-items-center text-sm text-muted-foreground">
              Sube una imagen para empezar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
