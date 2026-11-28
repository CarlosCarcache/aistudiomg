// Ruta pública: galería compartida por enlace seguro (solo lectura + cotización).
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { galleryController } from "@/controllers/gallery.controller";
import { getSharedGallery, submitSharedQuote } from "@/lib/shared-gallery.functions";
import { MAX_SHARED_QUOTE_IMAGE_SIZE, sharedQuoteSchema } from "@/lib/shared-order";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { Check, Download, Images, Loader2, RefreshCw, Send, X } from "lucide-react";
import { toast } from "sonner";
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
        content: "Revisa las imágenes que el estudio compartió contigo y solicita una cotización.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const fmt = (n: number) => `C$${n.toFixed(2)}`;

type SavedClient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type UploadedImage = { name: string; dataUrl: string };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

function PublicGalleryPage() {
  const loadGallery = useServerFn(getSharedGallery);
  const sendQuote = useServerFn(submitSharedQuote);
  const { token } = Route.useParams();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [savedClient, setSavedClient] = useState<SavedClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [notes, setNotes] = useState("");
  const [upload, setUpload] = useState<UploadedImage | null>(null);
  const [quotes, setQuotes] = useState<SharedQuote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [quotesError, setQuotesError] = useState(false);
  const [respondingQuote, setRespondingQuote] = useState<string | null>(null);

  const refreshQuotes = useCallback(async () => {
    setQuotesLoading(true);
    setQuotesError(false);
    try {
      setQuotes(await galleryController.listSharedQuotes(token));
    } catch {
      setQuotesError(true);
    } finally {
      setQuotesLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    setQuotes([]);
    setQuotesLoading(true);
    setQuotesError(false);
    galleryController
      .listSharedQuotes(token)
      .then((rows) => {
        if (active) setQuotes(rows);
      })
      .catch(() => {
        if (active) setQuotesError(true);
      })
      .finally(() => {
        if (active) setQuotesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setSelected(new Set());
    setUpload(null);
    loadGallery({ data: { token } })
      .then((result) => {
        if (!active) return;
        setImages(result.images);
        setUrls(result.urls);
        setSavedClient(result.client);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, loadGallery]);

  const selectedImages = useMemo(
    () => images.filter((image) => selected.has(image.id)),
    [images, selected],
  );
  const clientName = [savedClient?.firstName, savedClient?.lastName].filter(Boolean).join(" ");

  const toggle = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chooseImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Usa una imagen JPG, PNG o WEBP");
      input.value = "";
      return;
    }
    if (file.size > MAX_SHARED_QUOTE_IMAGE_SIZE) {
      toast.error("La imagen no puede superar 5 MB");
      input.value = "";
      return;
    }
    setPreparing(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setUpload({ name: file.name.slice(0, 160), dataUrl });
    } catch {
      toast.error("No se pudo leer la imagen");
    } finally {
      setPreparing(false);
      input.value = "";
    }
  };

  const submit = async () => {
    if (sending) return;
    const input = {
      notes,
      imageName: upload?.name ?? "",
      imageDataUrl: upload?.dataUrl ?? "",
      imageIds: [...selected],
    };
    const validated = sharedQuoteSchema.safeParse(input);
    if (!validated.success)
      return toast.error(validated.error.issues[0]?.message ?? "Revisa la solicitud");
    setSending(true);
    try {
      await sendQuote({ data: { token, ...validated.data } });
      toast.success("Cotización enviada al estudio");
      setOpen(false);
      setSelected(new Set());
      setNotes("");
      setUpload(null);
      await refreshQuotes();
    } catch {
      toast.error("No se pudo enviar la cotización, intenta de nuevo");
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
      toast.success(
        accept ? "Cotización aceptada; tu pedido está en proceso" : "Cotización rechazada",
      );
    } catch {
      toast.error("No se pudo registrar tu respuesta");
    } finally {
      setRespondingQuote(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Galería del cliente</h1>
          <p className="text-xs text-muted-foreground">
            Elige imágenes compartidas o adjunta una referencia para cotizar
          </p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={loading || error || !savedClient}>
          <Send className="h-4 w-4" />
          Solicitar cotización{selected.size > 0 ? ` (${selected.size})` : ""}
        </Button>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        {loading ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/40 py-20 text-center">
            <Images className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">El enlace no es válido o expiró.</p>
          </div>
        ) : images.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/40 py-20 text-center">
            <Images className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No hay imágenes compartidas, pero puedes adjuntar una para solicitar tu cotización.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image) => {
              const isSelected = selected.has(image.id);
              return (
                <figure
                  key={image.id}
                  className={`overflow-hidden rounded-xl border bg-card transition ${
                    isSelected ? "border-primary ring-2 ring-primary/40" : "border-border"
                  }`}
                >
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => toggle(image.id)}
                    className="relative block h-auto w-full rounded-none p-0"
                    aria-label={`Seleccionar ${image.title}`}
                    aria-pressed={isSelected}
                  >
                    {urls[image.id] ? (
                      <img
                        src={urls[image.id]}
                        alt={image.title}
                        loading="lazy"
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div className="aspect-square bg-muted" />
                    )}
                    {isSelected && (
                      <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                  <figcaption className="flex items-center justify-between gap-2 p-3 text-sm">
                    <span className="truncate">{image.title}</span>
                    <span className="flex items-center gap-1">
                      <span className="font-medium">{fmt(image.price ?? 0)}</span>
                      {urls[image.id] && (
                        <Button asChild size="icon" variant="ghost">
                          <a
                            href={urls[image.id]}
                            download
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Descargar ${image.title}`}
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
              <p className="text-sm text-muted-foreground">
                Consulta los precios enviados por el estudio y responde desde aquí.
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void refreshQuotes()}
              disabled={quotesLoading}
              aria-label="Actualizar cotizaciones"
              title="Actualizar cotizaciones"
            >
              <RefreshCw className={`h-4 w-4 ${quotesLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          {quotesLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando cotizaciones...
            </div>
          ) : quotesError ? (
            <p className="py-4 text-sm text-destructive">
              No se pudieron cargar tus cotizaciones. Intenta actualizar.
            </p>
          ) : quotes.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Aún no tienes cotizaciones.</p>
          ) : (
            <div className="divide-y divide-border border-y border-border">
              {quotes.map((quote) => {
                const statusText =
                  quote.quote_status === "solicitada"
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
                  <article
                    key={quote.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <h3 className="font-medium">{quote.title}</h3>
                      {quote.description && (
                        <p className="text-sm text-muted-foreground">{quote.description}</p>
                      )}
                      {quote.price != null && (
                        <p className="text-lg font-semibold">
                          {formatMoney(quote.price, quote.currency)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {statusText} · {new Date(quote.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {quote.quote_status === "enviada" && (
                      <div className="flex shrink-0 gap-2">
                        <Button disabled={busy} onClick={() => void respondToQuote(quote, true)}>
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Aceptar precio
                        </Button>
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => void respondToQuote(quote, false)}
                        >
                          Rechazar
                        </Button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Dialog open={open} onOpenChange={(nextOpen) => !sending && setOpen(nextOpen)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Solicitar cotización</DialogTitle>
            <DialogDescription>
              Tus datos registrados se adjuntan automáticamente y no se pueden editar.
            </DialogDescription>
          </DialogHeader>
          <form
            id="shared-quote-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            className="space-y-4"
          >
            <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="quote-client-name">Nombre del cliente</Label>
                <Input id="quote-client-name" value={clientName} readOnly aria-readonly="true" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quote-client-phone">Teléfono registrado</Label>
                <Input
                  id="quote-client-phone"
                  value={savedClient?.phone || "No registrado"}
                  readOnly
                  aria-readonly="true"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quote-client-email">Correo registrado</Label>
                <Input
                  id="quote-client-email"
                  value={savedClient?.email || "No registrado"}
                  readOnly
                  aria-readonly="true"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quote-image">Subir una imagen propia</Label>
              <Input
                id="quote-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={chooseImage}
                disabled={preparing || sending}
              />
              <p className="text-xs text-muted-foreground">JPG, PNG o WEBP · máximo 5 MB</p>
              {preparing && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Preparando imagen…
                </p>
              )}
              {upload && (
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <img
                    src={upload.dataUrl}
                    alt="Referencia para cotizar"
                    className="h-20 w-20 rounded-md object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{upload.name}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setUpload(null)}
                    aria-label="Quitar imagen adjunta"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {selectedImages.length > 0 && (
              <div className="space-y-2">
                <Label>Imágenes compartidas seleccionadas</Label>
                <ul className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border p-3 text-sm">
                  {selectedImages.map((image) => (
                    <li key={image.id} className="flex items-center gap-3">
                      {urls[image.id] && (
                        <img
                          src={urls[image.id]}
                          alt={image.title}
                          className="h-12 w-12 shrink-0 rounded object-cover"
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate">{image.title}</span>
                      <span className="text-xs text-muted-foreground">Precio por confirmar</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Puedes usar una imagen propia, imágenes compartidas o ambas. El estudio confirmará el
              precio.
            </p>
            <div className="space-y-2">
              <Label htmlFor="quote-notes">Detalles para cotizar (opcional)</Label>
              <Textarea
                id="quote-notes"
                maxLength={1000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Cantidades, tamaños, colores, fecha deseada…"
                rows={4}
              />
            </div>
          </form>
          <DialogFooter>
            <Button
              type="submit"
              form="shared-quote-form"
              disabled={sending || preparing || !savedClient}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar cotización
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
