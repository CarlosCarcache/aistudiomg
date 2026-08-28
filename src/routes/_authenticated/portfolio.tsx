import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GalleryHorizontalEnd, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/views/PageHeader";
import { EmptyState } from "@/views/EmptyState";
import { galleryController } from "@/controllers/gallery.controller";
import type { GalleryImage } from "@/models/types";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/portfolio")({
  component: PortfolioPage,
  head: () => ({
    meta: [
      { title: "Portafolio | AI Studio MG" },
      {
        name: "description",
        content:
          "Galería pública del estudio con los trabajos marcados como portafolio.",
      },
      { property: "og:title", content: "Portafolio | AI Studio MG" },
      {
        property: "og:description",
        content: "Trabajos destacados del estudio AI Studio MG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function PortfolioPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    galleryController
      .listPortfolio()
      .then(async (imgs) => {
        setImages(imgs);
        setUrls(await galleryController.resolveMany(imgs));
      })
      .catch(() => toast.error("No se pudo cargar el portafolio"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portafolio"
        description="Imágenes marcadas como portafolio, visibles públicamente."
      />
      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : images.length === 0 ? (
        <EmptyState
          icon={GalleryHorizontalEnd}
          title="Portafolio vacío"
          description="Marca imágenes como portafolio desde la galería para mostrarlas aquí."
        />
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
          {images.map((img) => (
            <Card key={img.id} className="overflow-hidden break-inside-avoid p-0">
              {urls[img.id] ? (
                <img
                  src={urls[img.id]}
                  alt={img.title}
                  loading="lazy"
                  className="w-full object-cover"
                />
              ) : (
                <div className="aspect-square bg-muted" />
              )}
              <p className="p-3 text-sm font-medium">{img.title}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
