// Ruta pública: galería compartida por enlace seguro (solo lectura + pedido).
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Download, Images, Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { galleryController } from "@/controllers/gallery.controller";
import type { GalleryImage } from "@/models/types";
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
  const { token } = Route.useParams();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });

  useEffect(() => {
    galleryController
      .listShared(token)
      .then(async (imgs) => {
        setImages(imgs);
        setUrls(await galleryController.resolveMany(imgs));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  const selectedImages = useMemo(
    () => images.filter((i) => selected.has(i.id)),
    [images, selected],
  );
  const total = selectedImages.reduce((sum, i) => sum + (i.price ?? 0), 0);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Escribe tu nombre");
    if (selected.size === 0) return toast.error("Selecciona al menos una imagen");
    setSending(true);
    try {
      await galleryController.submitSharedOrder(token, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        notes: form.notes.trim(),
        imageIds: [...selected],
      });
      toast.success("Pedido enviado al estudio");
      setOpen(false);
      setSelected(new Set());
      setForm({ name: "", phone: "", notes: "" });
    } catch {
      toast.error("No se pudo enviar el pedido, intenta de nuevo");
    } finally {
      setSending(false);
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
        {selected.size > 0 && (
          <Button onClick={() => setOpen(true)}>
            <ShoppingCart className="h-4 w-4" />
            Solicitar pedido ({selected.size})
          </Button>
        )}
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
                  <button
                    type="button"
                    onClick={() => toggle(img.id)}
                    className="relative block w-full"
                    aria-label={`Seleccionar ${img.title}`}
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
                  </button>
                  <figcaption className="flex items-center justify-between gap-2 p-3 text-sm">
                    <span className="truncate">{img.title}</span>
                    <span className="flex items-center gap-1">
                      {img.price != null && (
                        <span className="font-medium">{fmt(img.price)}</span>
                      )}
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
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar pedido</DialogTitle>
            <DialogDescription>
              Revisa tus imágenes seleccionadas y completa tus datos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-3 text-sm">
              {selectedImages.map((img) => (
                <li key={img.id} className="flex justify-between gap-2">
                  <span className="truncate">{img.title}</span>
                  <span>{fmt(img.price ?? 0)}</span>
                </li>
              ))}
            </ul>
            <p className="text-right text-sm font-semibold">
              Total: {fmt(total)}
            </p>
            <div className="space-y-2">
              <Label htmlFor="po-name">Tu nombre</Label>
              <Input
                id="po-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nombre y apellido"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="po-phone">Teléfono (opcional)</Label>
              <Input
                id="po-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="8888-8888"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="po-notes">Notas (opcional)</Label>
              <Textarea
                id="po-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Cantidades, tamaños, detalles…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
