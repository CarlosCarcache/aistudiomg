import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, Folder, FolderOpen, GalleryHorizontalEnd, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { catalogController } from "@/controllers/catalog.controller";
import { ordersController } from "@/controllers/orders.controller";
import { formatMoney, orderTotal } from "@/lib/money";
import { toast } from "sonner";
import { PageHeader } from "@/views/PageHeader";
import { EmptyState } from "@/views/EmptyState";
import { galleryController } from "@/controllers/gallery.controller";
import type { GalleryImage, Order, ProductCategory } from "@/models/types";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
      <CategoryFolders images={images} urls={urls} />
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
      ) : null}
    </div>
  );
}
function CategoryFolders({
  images,
  urls,
}: {
  images: GalleryImage[];
  urls: Record<string, string>;
}) {
  const [cats, setCats] = useState<ProductCategory[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<GalleryImage | null>(null);
  useEffect(() => {
    catalogController.listCategories().then(setCats).catch(() => {});
    ordersController.list().then(setOrders).catch(() => {});
  }, []);
  const folders = [...cats.map((c) => ({ id: c.id, name: c.name })), { id: "none", name: "Sin categoría" }];
  const inFolder = (id: string) =>
    orders.filter((o) => (id === "none" ? !o.category_id : o.category_id === id));
  const current = open ? folders.find((f) => f.id === open) : null;
  const currentImages = current
    ? images.filter((image) => (image.category_id ?? "none") === current.id)
    : [];
  const currentOrders = current ? inFolder(current.id) : [];
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Portafolio e historial por categoría</h2>
      {current ? (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => setOpen(null)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Carpetas
          </Button>
          <h3 className="flex items-center gap-2 font-medium">
            <FolderOpen className="h-5 w-5 text-primary" /> {current.name}
          </h3>
          {currentImages.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Imágenes del portafolio</h4>
              <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
                {currentImages.map((image) => (
                  <Card
                    key={image.id}
                    className="flex items-center justify-between gap-3 break-inside-avoid p-3"
                  >
                    <p className="text-sm font-medium">{image.title}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setPreviewImage(image)}
                      disabled={!urls[image.id]}
                      aria-label={`Ver imagen ${image.title}`}
                      title="Ver imagen"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {currentOrders.length === 0 ? (
            currentImages.length === 0 && (
              <p className="text-sm text-muted-foreground">Esta carpeta no tiene imágenes ni pedidos.</p>
            )
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {currentOrders.map((o) => (
                <Card key={o.id} className="p-3 space-y-1">
                  <p className="font-medium">{o.title}</p>
                  {o.description && <p className="text-xs text-muted-foreground">{o.description}</p>}
                  <p className="text-xs text-muted-foreground">
                    {o.price != null
                      ? `${formatMoney(Number(o.price), o.currency)} × ${o.quantity ?? 1} = ${formatMoney(orderTotal(o.price, o.quantity), o.currency)}`
                      : "Sin precio"}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {folders.map((f) => (
            <button key={f.id} onClick={() => setOpen(f.id)}
              className="flex flex-col items-center gap-2 rounded-lg border bg-card p-4 text-center hover:bg-accent transition-colors">
              <Folder className="h-10 w-10 text-primary" />
              <span className="text-sm font-medium">{f.name}</span>
              <span className="text-xs text-muted-foreground">
                {images.filter((image) => (image.category_id ?? "none") === f.id).length} imágenes ·{" "}
                {inFolder(f.id).length} pedidos
              </span>
            </button>
          ))}
        </div>
      )}
      <Dialog
        open={!!previewImage}
        onOpenChange={(isOpen) => !isOpen && setPreviewImage(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewImage?.title}</DialogTitle>
          </DialogHeader>
          {previewImage && urls[previewImage.id] && (
            <img
              src={urls[previewImage.id]}
              alt={previewImage.title}
              className="max-h-[75vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
