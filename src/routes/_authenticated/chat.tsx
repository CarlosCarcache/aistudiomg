import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useEffect, type FormEvent } from "react";
import { Send, Download, Sparkles, ImageIcon, Loader2, User, Bot } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

type Format = "png" | "jpeg" | "webp" | "svg";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string;
};

const FORMATS: { value: Format; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPG" },
  { value: "webp", label: "WEBP" },
  { value: "svg", label: "SVG" },
];

async function convertImage(dataUrl: string, format: Format): Promise<string> {
  if (format === "png") return dataUrl;
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("No se pudo cargar la imagen"));
    img.src = dataUrl;
  });
  if (format === "svg") {
    return (
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${img.width}" height="${img.height}" viewBox="0 0 ${img.width} ${img.height}"><image href="${dataUrl}" width="${img.width}" height="${img.height}"/></svg>`,
      )
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  if (format === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL(`image/${format}`, 0.95);
}

function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState<Format>("png");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
    setMessages((m) => [...m, userMsg]);
    setPrompt("");
    setLoading(true);

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });
      const data = (await res.json()) as { image?: string; error?: string };
      if (!res.ok || !data.image) throw new Error(data.error ?? "Error generando imagen");

      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Aquí tienes tu imagen. Puedes descargarla en el formato que prefieras.",
          image: data.image,
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(msg);
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: `⚠️ ${msg}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(image: string) {
    try {
      const converted = await convertImage(image, format);
      const a = document.createElement("a");
      a.href = converted;
      a.download = `ai-studio-${Date.now()}.${format === "jpeg" ? "jpg" : format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success(`Descargado como ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al descargar");
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-6rem)] max-w-4xl flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Sparkles className="h-6 w-6 text-primary" />
            Chat con IA · Imágenes
          </h1>
          <p className="text-sm text-muted-foreground">
            Describe la imagen que necesitas y descárgala en el formato que quieras.
          </p>
        </div>
        <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMATS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-2xl border border-border bg-card/30 p-4 backdrop-blur"
      >
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div className="max-w-sm">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <ImageIcon className="h-7 w-7" />
              </div>
              <p className="mt-4 text-base font-medium text-foreground">
                Crea imágenes desde un prompt
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ej: "Logo minimalista de un zorro geométrico, fondo blanco, vectorial".
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] space-y-2 rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  {msg.image && (
                    <div className="space-y-2">
                      <img
                        src={msg.image}
                        alt="Imagen generada"
                        className="w-full rounded-xl border border-border"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDownload(msg.image!)}
                      >
                        <Download className="h-4 w-4" />
                        Descargar {format.toUpperCase()}
                      </Button>
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generando imagen...
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-4 flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring"
      >
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as FormEvent);
            }
          }}
          placeholder="Describe la imagen que quieres generar..."
          rows={1}
          className="min-h-[40px] flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !prompt.trim()} size="icon">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
