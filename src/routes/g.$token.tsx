// Ruta pública: galería compartida por enlace seguro (solo lectura).
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Images, Loader2 } from "lucide-react";
import { galleryController } from "@/controllers/gallery.controller";
import type { GalleryImage } from "@/models/types";
import { Button } from "@/components/ui/button";

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

function PublicGalleryPage() {
  const { token } = Route.useParams();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold">Galería del cliente</h1>
        <p className="text-xs text-muted-foreground">
          Enlace seguro · solo lectura
        </p>
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
            {images.map((img) => (
              <figure
                key={img.id}
                className="overflow-hidden rounded-xl border border-border bg-card"
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
                <figcaption className="flex items-center justify-between gap-2 p-3 text-sm">
                  <span className="truncate">{img.title}</span>
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
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
