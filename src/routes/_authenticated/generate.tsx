import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Download, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageDropzone, type DroppedFile } from "@/components/image-dropzone";
import { aiImage, downloadAs, type Format } from "@/lib/image-utils";
import { PageHeader } from "@/views/PageHeader";

export const Route = createFileRoute("/_authenticated/generate")({
  component: GeneratePage,
});

const FORMATS: Format[] = ["png", "jpeg", "webp", "svg"];

function GeneratePage() {
  const [refs, setRefs] = useState<DroppedFile[]>([]);
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState<Format>("png");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    if (!prompt.trim()) return toast.error("Escribe un prompt");
    setLoading(true);
    try {
      const images = refs.map((r) => r.dataUrl);
      const img = await aiImage(prompt, images.length ? images : undefined);
      setResult(img);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function handleEditCurrent() {
    if (!result) return;
    if (!prompt.trim()) return toast.error("Describe el cambio");
    setLoading(true);
    try {
      const img = await aiImage(prompt, [result]);
      setResult(img);
      toast.success("Imagen actualizada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Generar / Editar imagen"
        description="Genera desde un prompt, o sube imágenes de referencia y pide cambios por texto."
      />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <ImageDropzone
            multiple
            hint="Arrastra hasta 4 imágenes de referencia"
            onFiles={(f) => setRefs((prev) => [...prev, ...f].slice(0, 4))}
          />
          {refs.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {refs.map((r, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-border">
                  <img src={r.dataUrl} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => setRefs((p) => p.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 rounded bg-background/80 px-1 text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            placeholder="Describe la imagen o el cambio que quieres..."
          />

          <div className="flex gap-2">
            <Button onClick={handleGenerate} disabled={loading} className="flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generar
            </Button>
            <Button onClick={handleEditCurrent} disabled={loading || !result} variant="secondary">
              <Wand2 className="h-4 w-4" />
              Editar
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/30 p-4">
          {result ? (
            <div className="space-y-3">
              <img src={result} alt="Resultado" className="mx-auto max-h-[520px] rounded-xl" />
              <div className="flex items-center justify-end gap-2">
                <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => downloadAs(result, format, "generated")}>
                  <Download className="h-4 w-4" />
                  Descargar
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid h-full min-h-[420px] place-items-center text-center text-sm text-muted-foreground">
              <div>
                <Sparkles className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-2">Tu imagen generada aparecerá aquí.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
