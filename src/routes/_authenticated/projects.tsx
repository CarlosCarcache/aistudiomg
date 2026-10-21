import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FolderKanban, Folder, ArrowLeft, Plus, Loader2, Pencil, Trash2, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
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
import { PageHeader } from "@/views/PageHeader";
import { EmptyState } from "@/views/EmptyState";
import { projectsController } from "@/controllers/projects.controller";
import { catalogController } from "@/controllers/catalog.controller";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import type { Project, ProductCategory } from "@/models/types";

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
  const [items, setItems] = useState<Project[]>([]);
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
  const folders = [...categories.map((c) => ({ id: c.id, name: c.name })), { id: "none", name: "Sin categoría" }];
  const visible = items.filter((p) => (p.category_id ?? "none") === folder);

  useEffect(() => {
    catalogController.listCategories().then(setCategories).catch(() => toast.error("No se pudieron cargar las categorías"));
    projectsController
      .list()
      .then(setItems)
      .catch((e) => toast.error(e instanceof Error ? e.message : "No se pudieron cargar"))
      .finally(() => setLoading(false));
  }, []);

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
          <Button className="gap-2" onClick={openNew}>
            <Plus className="h-4 w-4" /> Nuevo proyecto
          </Button>
        }
      />

      {folder && <div className="flex items-center gap-3"><Button variant="ghost" onClick={() => setFolder(null)}><ArrowLeft className="h-4 w-4" /> Categorías</Button><h2 className="font-semibold">{folders.find((f) => f.id === folder)?.name}</h2></div>}

      {loading ? (
        <div className="grid place-items-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !folder ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {folders.map((f) => <Button key={f.id} variant="outline" onClick={() => setFolder(f.id)} className="h-auto min-h-36 flex-col gap-3 whitespace-normal bg-card p-4"><Folder className="h-10 w-10 text-primary" /><span>{f.name}</span><span className="text-xs text-muted-foreground">{items.filter((p) => (p.category_id ?? "none") === f.id).length} proyectos</span></Button>)}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Aún no tienes proyectos"
          description="Crea tu primer proyecto para empezar a guardar diseños y reutilizarlos."
        />
      ) : (
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
    </div>
  );
}
