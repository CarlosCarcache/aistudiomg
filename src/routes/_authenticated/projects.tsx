import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FolderKanban, Folder, ArrowLeft, Plus, Loader2, Pencil, Trash2, ImagePlus, X, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ImageDropzone } from "@/components/image-dropzone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/views/PageHeader";
import { EmptyState } from "@/views/EmptyState";
import { projectsController } from "@/controllers/projects.controller";
import { catalogController } from "@/controllers/catalog.controller";
import { galleryController } from "@/controllers/gallery.controller";
import { clientsController } from "@/controllers/clients.controller";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import type { Client, GalleryImage, GalleryShare, Project, ProductCategory } from "@/models/types";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Proyectos | AI Studio MG" },
      { name: "description", content: "Crea, edita y organiza tus proyectos de diseño." },
      { property: "og:title", content: "Proyectos | AI Studio MG" },
      { property: "og:description", content: "Crea, edita y organiza tus proyectos de diseño." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Projects,
});

// Reduce la imagen a una miniatura JPEG liviana para guardarla con el proyecto.
async function toThumbnail(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Imagen no válida"));
      i.src = url;
    });
    const max = 480;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const context = c.getContext("2d");
    if (!context) throw new Error("No se pudo preparar la portada");
    context.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Projects() {
  const perm = usePermissions("projects");
  const galleryPerm = usePermissions("gallery");
  const { user } = useAuth();
  const [items, setItems] = useState<Project[]>([]);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [shares, setShares] = useState<GalleryShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumb, setThumb] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("none");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareClient, setShareClient] = useState("");
  const [sharing, setSharing] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [productForm, setProductForm] = useState({
    title: "",
    category_id: "none",
    client_id: "none",
    is_portfolio: false,
    price: "",
  });
  const folders = [...categories.map((c) => ({ id: c.id, name: c.name })), { id: "none", name: "Sin categoría" }];
  const visible = items.filter((p) => (p.category_id ?? "none") === folder);
  const visibleImages = images.filter((image) => (image.category_id ?? "none") === folder);
  const folderShares = shares.filter((share) => share.is_category_scoped && (share.category_id ?? "none") === folder);
  const clientName = useMemo(
    () => Object.fromEntries(clients.map((client) => [client.id, `${client.first_name} ${client.last_name ?? ""}`.trim()])),
    [clients],
  );

  function openAddProduct() {
    if (!galleryPerm.guard("create")) return;
    setProductForm({
      title: "",
      category_id: folder ?? "none",
      client_id: "none",
      is_portfolio: false,
      price: "",
    });
    setAddProductOpen(true);
  }

  async function handleProductFiles(files: { file: File; dataUrl: string }[]) {
    if (!galleryPerm.guard("create")) return;
    if (!user) return toast.error("Inicia sesión para subir imágenes");
    setUploading(true);
    try {
      const created: GalleryImage[] = [];
      for (const item of files) {
        const path = await galleryController.upload(user.id, item.file);
        created.push(
          await galleryController.create({
            user_id: user.id,
            image_url: path,
            title: productForm.title.trim() || item.file.name,
            category_id: productForm.category_id === "none" ? null : productForm.category_id,
            client_id: productForm.client_id === "none" ? null : productForm.client_id,
            is_portfolio: productForm.is_portfolio,
            price: productForm.price ? Number(productForm.price) : null,
          }),
        );
      }
      setImages((prev) => [...created, ...prev]);
      const resolvedUrls = await galleryController.resolveMany(created);
      setImageUrls((prev) => ({ ...prev, ...resolvedUrls }));
      setProductForm((prev) => ({ ...prev, title: "", price: "" }));
      setAddProductOpen(false);
      toast.success(`${created.length} imagen(es) subida(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    Promise.all([
      catalogController.listCategories(),
      projectsController.list(),
      galleryController.list(),
      clientsController.list(),
      galleryController.listShares(),
    ])
      .then(async ([loadedCategories, loadedProjects, loadedImages, loadedClients, loadedShares]) => {
        setCategories(loadedCategories);
        setItems(loadedProjects);
        setImages(loadedImages);
        setImageUrls(await galleryController.resolveMany(loadedImages));
        setClients(loadedClients);
        setShares(loadedShares);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "No se pudieron cargar los proyectos"))
      .finally(() => setLoading(false));
  }, []);

  async function shareFolder() {
    if (!galleryPerm.guard("create")) return;
    if (!user) return toast.error("Inicia sesión para compartir la categoría");
    if (!shareClient) return toast.error("Selecciona un cliente");
    if (!folder) return;
    if (visibleImages.length === 0) return toast.error("Agrega al menos un producto a esta categoría antes de compartirla");
    setSharing(true);
    try {
      const share = await galleryController.createShare(user.id, shareClient, folder === "none" ? null : folder, true);
      setShares((prev) => [share, ...prev]);
      setShareClient("");
      setShareOpen(false);
      toast.success("Enlace de la categoría creado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo compartir la categoría");
    } finally {
      setSharing(false);
    }
  }

  async function copyShareLink(token: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/g/${token}`);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  }

  async function removeFolderShare(share: GalleryShare) {
    if (!galleryPerm.guard("delete")) return;
    try {
      await galleryController.removeShare(share.id);
      setShares((prev) => prev.filter((item) => item.id !== share.id));
      toast.success("Enlace revocado");
    } catch {
      toast.error("No se pudo revocar el enlace");
    }
  }

  function openNew() {
    if (!perm.guard("create")) return;
    setEditing(null);
    setTitle("");
    setDescription("");
    setThumb(null);
    setCategoryId(folder ?? "none");
    setOpen(true);
  }

  function openEdit(p: Project) {
    if (!perm.guard("update")) return;
    setEditing(p);
    setTitle(p.title);
    setDescription(p.description ?? "");
    setThumb(p.thumbnail_url);
    setCategoryId(p.category_id ?? "none");
    setOpen(true);
  }

  async function save() {
    const t = title.trim();
    if (!t) return toast.error("Escribe un nombre para el proyecto");
    if (t.length > 120) return toast.error("El nombre es demasiado largo");
    setSaving(true);
    try {
      const payload = { title: t, description: description.trim() || null, thumbnail_url: thumb, category_id: categoryId === "none" ? null : categoryId };
      if (editing) {
        const updated = await projectsController.update(editing.id, payload);
        setItems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        toast.success("Proyecto actualizado");
      } else {
        const created = await projectsController.create(payload);
        setItems((prev) => [created, ...prev]);
        toast.success("Proyecto creado");
      }
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Project) {
    if (!perm.guard("delete")) return;
    if (!confirm(`¿Eliminar el proyecto "${p.title}"?`)) return;
    try {
      await projectsController.remove(p.id);
      setItems((prev) => prev.filter((x) => x.id !== p.id));
      toast.success("Proyecto eliminado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Proyectos"
        description="Gestiona y reutiliza tus diseños guardados."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button className="gap-2" onClick={openAddProduct}>
              <Plus className="h-4 w-4" /> Agregar Producto
            </Button>
          </div>
        }
      />

      {folder && <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={() => setFolder(null)}><ArrowLeft className="h-4 w-4" /> Categorías</Button>
        <h2 className="font-semibold">{folders.find((f) => f.id === folder)?.name}</h2>
        <Button className="ml-auto gap-2" variant="outline" onClick={() => setShareOpen(true)} disabled={visibleImages.length === 0}>
          <Share2 className="h-4 w-4" /> Compartir carpeta
        </Button>
      </div>}

      {loading ? (
        <div className="grid place-items-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !folder ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {folders.map((f) => <Button key={f.id} variant="outline" onClick={() => setFolder(f.id)} className="h-auto min-h-36 flex-col gap-3 whitespace-normal bg-card p-4"><Folder className="h-10 w-10 text-primary" /><span>{f.name}</span><span className="text-xs text-muted-foreground">{images.filter((image) => (image.category_id ?? "none") === f.id).length} productos · {items.filter((p) => (p.category_id ?? "none") === f.id).length} proyectos</span></Button>)}
        </div>
      ) : visible.length === 0 && visibleImages.length === 0 && folderShares.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Aún no tienes proyectos"
          description="Crea tu primer proyecto para empezar a guardar diseños y reutilizarlos."
        />
      ) : (
        <div className="space-y-6">
          {folderShares.length > 0 && <section className="space-y-2">
            <h3 className="font-medium">Enlaces compartidos de esta carpeta</h3>
            {folderShares.map((share) => <div key={share.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm">
              <span className="font-medium">{clientName[share.client_id] ?? "Cliente"}</span>
              <code className="truncate rounded bg-muted px-2 py-1 font-mono text-xs">/g/{share.token}</code>
              <div className="ml-auto flex gap-1">
                <Button size="icon" variant="outline" onClick={() => void copyShareLink(share.token)} aria-label="Copiar enlace"><Copy className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => void removeFolderShare(share)} aria-label="Revocar enlace"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>)}
          </section>}
          {visibleImages.length > 0 && <section className="space-y-3">
            <h3 className="font-medium">Productos de la categoría</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleImages.map((image) => <div key={image.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                {imageUrls[image.id] ? <img src={imageUrls[image.id]} alt={image.title} loading="lazy" className="aspect-square w-full bg-muted object-cover" /> : <div className="grid aspect-square place-items-center bg-muted"><ImagePlus className="h-10 w-10 text-muted-foreground" /></div>}
                <div className="p-4">
                  <p className="truncate font-medium">{image.title}</p>
                  <p className="text-sm text-muted-foreground">C${(image.price ?? 0).toFixed(2)}</p>
                </div>
              </div>)}
            </div>
          </section>}
          {visible.length > 0 && <section className="space-y-3">
            <h3 className="font-medium">Proyectos</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="grid aspect-video place-items-center bg-muted">
                {p.thumbnail_url ? (
                  <img src={p.thumbnail_url} alt={p.title} className="h-full w-full object-cover" />
                ) : (
                  <FolderKanban className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(p)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(p)} title="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {p.description && <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
              </div>
            </div>
          ))}
            </div>
          </section>}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar proyecto" : "Nuevo proyecto"}</DialogTitle>
            <DialogDescription>Ponle un nombre, una descripción y una imagen de portada opcional.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="p-title">Nombre</Label>
              <Input id="p-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Logo panadería" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-category">Categoría</Label>
              <Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger id="p-category"><SelectValue /></SelectTrigger><SelectContent>{folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-desc">Descripción</Label>
              <Textarea id="p-desc" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Portada</Label>
              {thumb ? (
                <div className="relative">
                  <img src={thumb} alt="Portada" className="max-h-48 w-full rounded-lg object-cover" />
                  <Button size="icon" variant="secondary" className="absolute right-2 top-2 h-7 w-7" onClick={() => setThumb(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground hover:bg-muted/50">
                  <ImagePlus className="h-4 w-4" /> Subir imagen
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        setThumb(await toThumbnail(f));
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Imagen no válida");
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Guardar cambios" : "Crear proyecto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva imagen</DialogTitle>
            <DialogDescription>
              Agrega productos a la galería y configura su precio, categoría, cliente y visibilidad.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="project-product-title">Título (opcional)</Label>
                <Input
                  id="project-product-title"
                  value={productForm.title}
                  onChange={(event) =>
                    setProductForm({ ...productForm, title: event.target.value })
                  }
                  placeholder="Taza personalizada"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-product-price">Precio por imagen (C$)</Label>
                <Input
                  id="project-product-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.price}
                  onChange={(event) =>
                    setProductForm({ ...productForm, price: event.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select
                    value={productForm.category_id}
                    onValueChange={(value) =>
                      setProductForm({ ...productForm, category_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin categoría</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select
                    value={productForm.client_id}
                    onValueChange={(value) =>
                      setProductForm({ ...productForm, client_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin cliente</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {clientName[client.id]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="project-product-portfolio"
                  checked={productForm.is_portfolio}
                  onCheckedChange={(value) =>
                    setProductForm({ ...productForm, is_portfolio: value })
                  }
                />
                <Label htmlFor="project-product-portfolio">
                  Mostrar en el portafolio público
                </Label>
              </div>
            </div>
            <ImageDropzone
              multiple
              onFiles={handleProductFiles}
              hint={
                uploading
                  ? "Subiendo…"
                  : "Arrastra imágenes aquí o haz click para seleccionar"
              }
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartir carpeta</DialogTitle>
            <DialogDescription>
              Comparte los productos de “{folders.find((f) => f.id === folder)?.name}” con un cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="share-client">Cliente</Label>
            <Select value={shareClient} onValueChange={setShareClient}>
              <SelectTrigger id="share-client"><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger>
              <SelectContent>
                {clients.map((client) => <SelectItem key={client.id} value={client.id}>{clientName[client.id]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)} disabled={sharing}>Cancelar</Button>
            <Button onClick={() => void shareFolder()} disabled={sharing || !shareClient}>
              {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              Crear enlace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
