import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Copy, Images, Link2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/views/PageHeader";
import { EmptyState } from "@/views/EmptyState";
import { galleryController } from "@/controllers/gallery.controller";
import { catalogController } from "@/controllers/catalog.controller";
import { clientsController } from "@/controllers/clients.controller";
import type {
  Client,
  GalleryImage,
  GalleryShare,
  ProductCategory,
} from "@/models/types";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageDropzone } from "@/components/image-dropzone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/gallery")({
  component: GalleryPage,
  head: () => ({
    meta: [
      { title: "Galería de productos | AI Studio MG" },
      {
        name: "description",
        content:
          "Sube imágenes, organízalas por categoría, asígnalas a clientes y comparte enlaces seguros.",
      },
      { property: "og:title", content: "Galería de productos | AI Studio MG" },
      {
        property: "og:description",
        content: "Imágenes por categoría, clientes y enlaces seguros.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ALL = "__all__";
const NONE = "__none__";

function GalleryPage() {
  const { user } = useAuth();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [shares, setShares] = useState<GalleryShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filterCat, setFilterCat] = useState<string>(ALL);
  const [form, setForm] = useState({
    title: "",
    category_id: NONE,
    client_id: NONE,
    is_portfolio: false,
  });
  const [shareClient, setShareClient] = useState<string>("");

  useEffect(() => {
    Promise.all([
      galleryController.list(),
      catalogController.listCategories(),
      clientsController.list(),
      galleryController.listShares(),
    ])
      .then(async ([imgs, cats, cls, shs]) => {
        setImages(imgs);
        setCategories(cats);
        setClients(cls);
        setShares(shs);
        setUrls(await galleryController.resolveMany(imgs));
      })
      .catch(() => toast.error("No se pudo cargar la galería"))
      .finally(() => setLoading(false));
  }, []);

  const catName = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  );
  const clientName = useMemo(
    () =>
      Object.fromEntries(
        clients.map((c) => [c.id, `${c.first_name} ${c.last_name ?? ""}`.trim()]),
      ),
    [clients],
  );

  const visible = useMemo(
    () => (filterCat === ALL ? images : images.filter((i) => i.category_id === filterCat)),
    [images, filterCat],
  );

  const handleFiles = async (files: { file: File; dataUrl: string }[]) => {
    if (!user) return toast.error("Inicia sesión para subir imágenes");
    setUploading(true);
    try {
      const created: GalleryImage[] = [];
      for (const f of files) {
        const path = await galleryController.upload(user.id, f.file);
        created.push(
          await galleryController.create({
            user_id: user.id,
            image_url: path,
            title: form.title.trim() || f.file.name,
            category_id: form.category_id === NONE ? null : form.category_id,
            client_id: form.client_id === NONE ? null : form.client_id,
            is_portfolio: form.is_portfolio,
          }),
        );
      }
      setImages((prev) => [...created, ...prev]);
      setUrls((prev) => ({ ...prev, ...(await galleryController.resolveMany(created)) }));
      setForm((f) => ({ ...f, title: "" }));
      toast.success(`${created.length} imagen(es) subida(s)`);
    } catch {
      toast.error("No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  };

  const togglePortfolio = async (img: GalleryImage) => {
    try {
      const updated = await galleryController.update(img.id, {
        is_portfolio: !img.is_portfolio,
      });
      setImages((p) => p.map((i) => (i.id === updated.id ? updated : i)));
    } catch {
      toast.error("No se pudo actualizar la imagen");
    }
  };

  const assign = async (img: GalleryImage, clientId: string) => {
    try {
      const updated = await galleryController.update(img.id, {
        client_id: clientId === NONE ? null : clientId,
      });
      setImages((p) => p.map((i) => (i.id === updated.id ? updated : i)));
      toast.success("Imagen asignada");
    } catch {
      toast.error("No se pudo asignar la imagen");
    }
  };

  const removeImage = async (id: string) => {
    try {
      await galleryController.remove(id);
      setImages((p) => p.filter((i) => i.id !== id));
      toast.success("Imagen eliminada");
    } catch {
      toast.error("No se pudo eliminar la imagen");
    }
  };

  const createShare = async () => {
    if (!user) return toast.error("Inicia sesión para crear enlaces");
    if (!shareClient) return toast.error("Selecciona un cliente");
    try {
      const share = await galleryController.createShare(user.id, shareClient);
      setShares((s) => [share, ...s]);
      setShareClient("");
      toast.success("Enlace seguro creado");
    } catch {
      toast.error("No se pudo crear el enlace");
    }
  };

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/g/${token}`);
    toast.success("Enlace copiado");
  };

  const removeShare = async (id: string) => {
    try {
      await galleryController.removeShare(id);
      setShares((s) => s.filter((x) => x.id !== id));
    } catch {
      toast.error("No se pudo eliminar el enlace");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Galería de productos"
        description="Sube imágenes, clasifícalas por categoría, asígnalas a clientes y comparte enlaces seguros."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nueva imagen</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="g-title">Título (opcional)</Label>
              <Input
                id="g-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Taza personalizada"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select
                  value={form.category_id}
                  onValueChange={(v) => setForm({ ...form, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin categoría</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select
                  value={form.client_id}
                  onValueChange={(v) => setForm({ ...form, client_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin cliente</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {clientName[c.id]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="g-portfolio"
                checked={form.is_portfolio}
                onCheckedChange={(v) => setForm({ ...form, is_portfolio: v })}
              />
              <Label htmlFor="g-portfolio">Mostrar en el portafolio público</Label>
            </div>
          </div>
          <div>
            <ImageDropzone
              multiple
              onFiles={handleFiles}
              hint={
                uploading
                  ? "Subiendo…"
                  : "Arrastra imágenes aquí o haz click para seleccionar"
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Enlaces seguros por cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select value={shareClient} onValueChange={setShareClient}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecciona un cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {clientName[c.id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={createShare}>
              <Link2 className="mr-2 h-4 w-4" /> Generar enlace
            </Button>
          </div>
          {shares.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay enlaces creados.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {shares.map((s) => (
                <li key={s.id} className="flex items-center gap-3 p-3 text-sm">
                  <span className="font-medium">
                    {clientName[s.client_id] ?? "Cliente"}
                  </span>
                  <code className="truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                    /g/{s.token}
                  </code>
                  <div className="ml-auto flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyLink(s.token)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeShare(s.id)}
                      aria-label="Eliminar enlace"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-sm">Filtrar por categoría</Label>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Images}
          title="Sin imágenes"
          description="Sube tu primera imagen para empezar a construir la galería."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((img) => (
            <Card key={img.id} className="overflow-hidden">
              <div className="aspect-square bg-muted">
                {urls[img.id] ? (
                  <img
                    src={urls[img.id]}
                    alt={img.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <CardContent className="space-y-3 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium">{img.title}</p>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Eliminar imagen"
                    onClick={() => removeImage(img.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {img.category_id && (
                  <Badge variant="secondary">{catName[img.category_id]}</Badge>
                )}
                <Select
                  value={img.client_id ?? NONE}
                  onValueChange={(v) => assign(img, v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Sin cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin cliente</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {clientName[c.id]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={img.is_portfolio}
                    onCheckedChange={() => togglePortfolio(img)}
                    id={`pf-${img.id}`}
                  />
                  <Label htmlFor={`pf-${img.id}`} className="text-xs">
                    Portafolio
                  </Label>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
