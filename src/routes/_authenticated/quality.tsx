import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Download, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ImageDropzone } from "@/components/image-dropzone";
import { aiImage, downloadDataUrl, loadImage } from "@/lib/image-utils";
import { PageHeader } from "@/views/PageHeader";

export const Route = createFileRoute("/_authenticated/quality")({
  component: QualityPage,
});

type Msg = { role: "user" | "assistant"; content: string };

function QualityPage() {
  const [src, setSrc] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(1);
  const [saturation, setSaturation] = useState(1);
  const [sharpen, setSharpen] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chat, setChat] = useState("");

  useEffect(() => {
    if (!working) return;
    (async () => {
      const img = await loadImage(working);
      const c = canvasRef.current!;
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.filter = `brightness(${1 + brightness / 100}) contrast(${contrast}) saturate(${saturation})`;
      ctx.drawImage(img, 0, 0);
      if (sharpen > 0) applySharpen(ctx, c.width, c.height, sharpen);
    })();
  }, [working, brightness, contrast, saturation, sharpen]);

  async function handleAiEnhance(extra?: string) {
    if (!src) return;
    setLoading(true);
    try {
      const out = await aiImage(
        `Mejora la calidad de esta imagen: aumenta nitidez, restaura detalles, mejora colores y bordes sin alterar el contenido.${extra ? " " + extra : ""}`,
        [working ?? src],
      );
      setWorking(out);
      toast.success("Mejorada por IA");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    const text = chat.trim();
    if (!text || !src) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setChat("");
    setMessages((m) => [...m, { role: "assistant", content: "Aplicando tu mejora..." }]);
    await handleAiEnhance(text);
    setMessages((m) => [
      ...m.slice(0, -1),
      { role: "assistant", content: "Listo. Revisa el preview y pide más cambios si quieres." },
    ]);
  }

  function handleDownload() {
    if (!canvasRef.current) return;
    downloadDataUrl(canvasRef.current.toDataURL("image/png"), `mejorada-${Date.now()}.png`);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Mejorar calidad" description="Ajustes manuales + chat IA para refinamiento." />

      {!src ? (
        <ImageDropzone onFiles={(f) => { setSrc(f[0].dataUrl); setWorking(f[0].dataUrl); }} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <Row label="Brillo" value={brightness}><Slider value={[brightness]} min={-50} max={50} step={1} onValueChange={(v) => setBrightness(v[0])} /></Row>
              <Row label="Contraste" value={contrast.toFixed(2)}><Slider value={[contrast]} min={0.5} max={2} step={0.05} onValueChange={(v) => setContrast(v[0])} /></Row>
              <Row label="Saturación" value={saturation.toFixed(2)}><Slider value={[saturation]} min={0} max={2} step={0.05} onValueChange={(v) => setSaturation(v[0])} /></Row>
              <Row label="Nitidez" value={sharpen}><Slider value={[sharpen]} min={0} max={5} step={1} onValueChange={(v) => setSharpen(v[0])} /></Row>
            </div>

            <Button onClick={() => handleAiEnhance()} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Mejorar con IA
            </Button>
            <Button onClick={handleDownload} variant="secondary" className="w-full">
              <Download className="h-4 w-4" /> Descargar PNG
            </Button>

            <div className="rounded-xl border border-border bg-card p-3">
              <p className="mb-2 text-sm font-medium">Chat de mejoras</p>
              <div className="mb-2 max-h-40 space-y-2 overflow-y-auto text-sm">
                {messages.length === 0 && <p className="text-xs text-muted-foreground">Pide mejoras específicas (ej: "más nitidez en los ojos", "color piel más natural").</p>}
                {messages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                    <span className={`inline-block max-w-[90%] rounded-lg px-2 py-1 text-xs ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {m.content}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea rows={2} value={chat} onChange={(e) => setChat(e.target.value)} placeholder="Pide una mejora..." />
                <Button size="icon" onClick={handleSend} disabled={loading || !chat.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/30 p-4">
            <canvas ref={canvasRef} className="mx-auto block max-h-[560px] max-w-full rounded-xl bg-white" />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, children }: { label: string; value: number | string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  );
}

function applySharpen(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  const k = amount * 0.2;
  const weights = [0, -k, 0, -k, 1 + 4 * k, -k, 0, -k, 0];
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const s = src.data, d = out.data;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) for (let kx = -1; kx <= 1; kx++) {
          sum += s[((y + ky) * w + (x + kx)) * 4 + c] * weights[(ky + 1) * 3 + (kx + 1)];
        }
        d[(y * w + x) * 4 + c] = Math.max(0, Math.min(255, sum));
      }
      d[(y * w + x) * 4 + 3] = s[(y * w + x) * 4 + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
}
