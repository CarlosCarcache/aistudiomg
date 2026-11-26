// Ruta pública: galería compartida por enlace seguro (solo lectura + pedido).
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getSharedGallery } from "@/lib/shared-gallery.functions";
import { sharedOrderSchema, sharedImageTotal } from "@/lib/shared-order";
import { useEffect, useMemo, useState } from "react";
import { Check, Download, Images, Loader2, RefreshCw, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { galleryController } from "@/controllers/gallery.controller";
import type { GalleryImage } from "@/models/types";
import type { SharedQuote } from "@/models/types";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/g/$token")({
  component: PublicGalleryPage,
  head: () => ({
    meta: [
      { title: "Galería del cliente | AI Studio MG" },
      {
        name: "description",
        content: "Galería privada compartida por AI Studio MG mediante enlace seguro.",
      },
      { property: "og:title", content: "Galería del cliente | AI Studio MG" },
      {
        property: "og:description",
        content: "Revisa las imágenes que el estudio compartió contigo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const fmt = (n: number) => `C$${n.toFixed(2)}`;

function PublicGalleryPage() {
  const loadGallery = useServerFn(getSharedGallery);
  const { token } = Route.useParams();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [quotes, setQuotes] = useState<SharedQuote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [respondingQuote, setRespondingQuote] = useState<string | null>(null);

  const refreshQuotes = async () => {
    try {
      setQuotes(await galleryController.listSharedQuotes(token));
    } catch {
      toast.error("No se pudieron cargar las cotizaciones");
    } finally {
      setQuotesLoading(false);
    }
  };

  useEffect(() => {
    loadGallery({ data: { token } })
      .then((result) => {
        setImages(result.images);
        setUrls(result.urls);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    void refreshQuotes();
  }, [token]);

  const selectedImages = useMemo(
    () => images.filter((i) => selected.has(i.id)),
    [images, selected],
  );
  const total = sharedImageTotal(selectedImages);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    if (sending) return;
    const validated = sharedOrderSchema.safeParse({ ...form, imageIds: [...selected] });
    if (!validated.success) return toast.error(validated.error.issues[0]?.message ?? "Revisa tus datos");
    setSending(true);
    try {
      await galleryController.submitSharedOrder(token, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        notes: form.notes.trim(),
        imageIds: [...selected],
      });
      toast.success("Solicitud de cotización enviada al estudio");
      setOpen(false);
      setSelected(new Set());
      setForm({ name: "", phone: "", notes: "" });
      void refreshQuotes();
    } catch {
      toast.error("No se pudo enviar el pedido, intenta de nuevo");
    } finally {
      setSending(false);
    }
  };

  const respondToQuote = async (quote: SharedQuote, accept: boolean) => {
    if (respondingQuote) return;
    setRespondingQuote(quote.id);
    try {
      await galleryController.respondToSharedQuote(token, quote.id, accept);
      await refreshQuotes();
      toast.success(accept ? "Cotización aceptada; tu pedido está en proceso" : "Cotización rechazada");
    } catch {
      toast.error("No se pudo registrar tu respuesta");
    } finally {
      setRespondingQuote(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Galería del cliente</h1>
          <p className="text-xs text-muted-foreground">
            Enlace seguro · selecciona imágenes para pedir
          </p>
        </div>
          <Button onClick={() => setOpen(true)} disabled={selected.size === 0}>
            <ShoppingCart className="h-4 w-4" />
            Solicitar cotización ({selected.size})
          </Button>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        {loading ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error || images.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/40 py-20 text-center">
            <Images className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              {error
                ? "El enlace no es válido o expiró."
                : "Todavía no hay imágenes compartidas en este enlace."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((img) => {
              const isSel = selected.has(img.id);
              return (
                <figure
                  key={img.id}
                  className={`overflow-hidden rounded-xl border bg-card transition ${
                    isSel ? "border-primary ring-2 ring-primary/40" : "border-border"
                  }`}
                >
                  <Button variant="ghost"
                    type="button"
                    onClick={() => toggle(img.id)}
                    className="relative block h-auto w-full rounded-none p-0"
                    aria-label={`Seleccionar ${img.title}`}
                    aria-pressed={isSel}
                  >
                    {urls[img.id] ? (
                      <img
                        src={urls[img.id]}
                        alt={img.title}
                        loading="lazy"
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div className="aspect-square bg-muted" />
                    )}
                    {isSel && (
                      <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                  <figcaption className="flex items-center justify-between gap-2 p-3 text-sm">
                    <span className="truncate">{img.title}</span>
                    <span className="flex items-center gap-1">
                      <span className="font-medium">{fmt(img.price ?? 0)}</span>
                      {urls[img.id] && (
                        <Button asChild size="icon" variant="ghost">
                          <a
                            href={urls[img.id]}
                            download
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Descargar ${img.title}`}
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}

        <section className="space-y-3 border-t border-border pt-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Mis cotizaciones</h2>
              <p className="text-sm text-muted-foreground">Consulta los precios enviados por el estudio y responde desde aquí.</p>
            </div>
            <Button variant="outline" size="icon" onClick={() => void refreshQuotes()} disabled={quotesLoading} aria-label="Actualizar cotizaciones" title="Actualizar cotizaciones">
              <RefreshCw className={`h-4 w-4 ${quotesLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          {quotesLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando cotizaciones...</div>
          ) : quotes.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Aún no tienes cotizaciones.</p>
          ) : (
            <div className="divide-y divide-border border-y border-border">
              {quotes.map((quote) => {
                const statusText = quote.quote_status === "solicitada"
                  ? "Solicitud recibida"
                  : quote.quote_status === "enviada"
                    ? "Esperando tu respuesta"
                    : quote.quote_status === "aceptada"
                      ? "Aceptada · pedido en proceso"
                      : quote.quote_status === "denegada"
                        ? "El estudio no pudo aceptar la solicitud"
                        : "Rechazaste el precio";
                const busy = respondingQuote === quote.id;
                return (
                  <article key={quote.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <h3 className="font-medium">{quote.title}</h3>
                      {quote.description && <p className="text-sm text-muted-foreground">{quote.description}</p>}
                      {quote.price != null && <p className="text-lg font-semibold">{formatMoney(quote.price, quote.currency)}</p>}
                      <p className="text-xs text-muted-foreground">{statusText} · {new Date(quote.created_at).toLocaleDateString()}</p>
                    </div>
                    {quote.quote_status === "enviada" && (
                      <div className="flex shrink-0 gap-2">
                        <Button disabled={busy} onClick={() => void respondToQuote(quote, true)}>
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Aceptar precio
                        </Button>
                        <Button variant="outline" disabled={busy} onClick={() => void respondToQuote(quote, false)}>Rechazar</Button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar cotización</DialogTitle>
            <DialogDescription>
              Revisa las imágenes seleccionadas y completa tus datos para cotizar.
            </DialogDescription>
          </DialogHeader>
          <form id="shared-order-form" onSubmit={(event) => { event.preventDefault(); void submit(); }} className="space-y-3">
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-3 text-sm">
              {selectedImages.map((img) => (
                <li key={img.id} className="flex justify-between gap-2">
                   {urls[img.id] && <img src={urls[img.id]} alt={img.title} className="h-12 w-12 shrink-0 rounded object-cover" />}
                  <span className="truncate">{img.title}</span>
                  <span>{fmt(img.price ?? 0)}</span>
                </li>
              ))}
            </ul>
            <p className="text-right text-sm font-semibold">
              Subtotal de referencia: {fmt(total)}
            </p>
            <div className="space-y-2">
              <Label htmlFor="po-name">Tu nombre</Label>
              <Input
                id="po-name"
                required maxLength={100}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nombre y apellido"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="po-phone">Teléfono (opcional)</Label>
              <Input
                id="po-phone"
                type="tel" maxLength={40}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="8888-8888"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="po-notes">Notas (opcional)</Label>
              <Textarea
                id="po-notes"
                maxLength={1000}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Cantidades, tamaños, detalles…"
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="submit" form="shared-order-form" disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
