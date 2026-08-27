import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/views/PageHeader";
import { EmptyState } from "@/views/EmptyState";
import { catalogController } from "@/controllers/catalog.controller";
import type { Product, ProductCategory } from "@/models/types";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/catalog")({
  component: CatalogPage,
  head: () => ({
    meta: [
      { title: "Catálogo | AI Studio MG" },
      {
        name: "description",
        content:
          "Gestiona categorías y productos del estudio con precio, imagen y disponibilidad.",
      },
      { property: "og:title", content: "Catálogo | AI Studio MG" },
      {
        property: "og:description",
        content: "Categorías y productos con precio e imagen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function CatalogPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [catName, setCatName] = useState("");
  const [prod, setProd] = useState({
    name: "",
    description: "",
    price: "",
    image_url: "",
    category_id: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      catalogController.listCategories(),
      catalogController.listProducts(),
    ])
      .then(([c, p]) => {
        setCategories(c);
        setProducts(p);
      })
      .catch(() => toast.error("No se pudo cargar el catálogo"))
      .finally(() => setLoading(false));
  }, []);

  const catName_ = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const addCategory = async () => {
    if (!catName.trim()) return;
    if (!user) return toast.error("Inicia sesión para crear categorías");
    try {
      const created = await catalogController.createCategory({
        name: catName.trim(),
        user_id: user.id,
      });
      setCategories((c) => [...c, created].sort((a, b) => a.name.localeCompare(b.name)));
      setCatName("");
      toast.success("Categoría creada");
    } catch {
      toast.error("No se pudo crear la categoría");
    }
  };

  const removeCategory = async (id: string) => {
    try {
      await catalogController.removeCategory(id);
      setCategories((c) => c.filter((x) => x.id !== id));
      toast.success("Categoría eliminada");
    } catch {
      toast.error("No se pudo eliminar (¿tiene productos asociados?)");
    }
  };

  const addProduct = async () => {
    if (!prod.name.trim()) return toast.error("El nombre es obligatorio");
    if (!user) return toast.error("Inicia sesión para crear productos");
    setSaving(true);
    try {
      const created = await catalogController.createProduct({
        user_id: user.id,
        name: prod.name.trim(),
        description: prod.description.trim() || null,
        price: prod.price ? Number(prod.price) : null,
        image_url: prod.image_url.trim() || null,
        category_id: prod.category_id || null,
      });
      setProducts((p) => [created, ...p]);
      setProd({ name: "", description: "", price: "", image_url: "", category_id: "" });
      toast.success("Producto creado");
    } catch {
      toast.error("No se pudo crear el producto");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Product) => {
    try {
      const updated = await catalogController.updateProduct(p.id, {
        active: !p.active,
      });
      setProducts((ps) => ps.map((x) => (x.id === updated.id ? updated : x)));
    } catch {
      toast.error("No se pudo actualizar el producto");
    }
  };

  const removeProduct = async (id: string) => {
    try {
      await catalogController.removeProduct(id);
      setProducts((ps) => ps.filter((p) => p.id !== id));
      toast.success("Producto eliminado");
    } catch {
      toast.error("No se pudo eliminar el producto");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catálogo de productos"
        description="Categorías y productos con precio, imagen y disponibilidad."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Categorías</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nueva categoría"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
            />
            <Button onClick={addCategory}>
              <Plus className="mr-2 h-4 w-4" /> Agregar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.length === 0 && (
              <span className="text-sm text-muted-foreground">
                Aún no hay categorías.
              </span>
            )}
            {categories.map((c) => (
              <Badge key={c.id} variant="secondary" className="gap-1 py-1 pl-3 pr-1">
                {c.name}
                <button
                  type="button"
                  aria-label={`Eliminar ${c.name}`}
                  className="rounded-full p-1 hover:bg-background/60"
                  onClick={() => removeCategory(c.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nuevo producto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="p_name">Nombre *</Label>
            <Input
              id="p_name"
              value={prod.name}
              onChange={(e) => setProd({ ...prod, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p_price">Precio</Label>
            <Input
              id="p_price"
              type="number"
              step="0.01"
              value={prod.price}
              onChange={(e) => setProd({ ...prod, price: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select
              value={prod.category_id}
              onValueChange={(v) => setProd({ ...prod, category_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="p_img">URL de imagen</Label>
            <Input
              id="p_img"
              placeholder="https://…"
              value={prod.image_url}
              onChange={(e) => setProd({ ...prod, image_url: e.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="p_desc">Descripción</Label>
            <Textarea
              id="p_desc"
              rows={2}
              value={prod.description}
              onChange={(e) => setProd({ ...prod, description: e.target.value })}
            />
          </div>
          <div className="md:col-span-3">
            <Button onClick={addProduct} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Crear producto
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando catálogo…
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Sin productos"
          description="Crea tu primer producto para mostrarlo en el catálogo."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt={p.name}
                  loading="lazy"
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="grid h-40 w-full place-items-center bg-muted">
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{p.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {p.category_id ? catName_[p.category_id] ?? "—" : "Sin categoría"}
                    </p>
                  </div>
                  <span className="font-semibold">
                    {p.price != null ? `$${Number(p.price).toFixed(2)}` : "—"}
                  </span>
                </div>
                {p.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {p.description}
                  </p>
                )}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={p.active}
                      onCheckedChange={() => toggleActive(p)}
                      aria-label="Activo"
                    />
                    <span className="text-muted-foreground">
                      {p.active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Eliminar producto"
                    onClick={() => removeProduct(p.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
