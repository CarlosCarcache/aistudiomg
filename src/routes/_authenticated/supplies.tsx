import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Package, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/views/PageHeader";
import { EmptyState } from "@/views/EmptyState";
import { inventoryController } from "@/controllers/inventory.controller";
import { catalogController } from "@/controllers/catalog.controller";
import type { ProductCategory, Supply } from "@/models/types";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/supplies")({
  component: SuppliesPage,
  head: () => ({
    meta: [
      { title: "Insumos | AI Studio MG" },
      {
        name: "description",
        content: "Gestiona materias primas y costos unitarios por categoría en AI Studio MG.",
      },
      { property: "og:title", content: "Insumos | AI Studio MG" },
      {
        property: "og:description",
        content: "Gestiona materias primas y costos unitarios por categoría en AI Studio MG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const emptyForm = {
  category_id: "",
  name: "",
  package_cost: "",
  package_quantity: "",
};

function SuppliesPage() {
  const perm = usePermissions("supplies");
  const { user } = useAuth();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([catalogController.listCategories(), inventoryController.listSupplies()])
      .then(([categoryRows, supplyRows]) => {
        setCategories(categoryRows);
        setSupplies(supplyRows);
      })
      .catch(() => toast.error("No se pudieron cargar los insumos"))
      .finally(() => setLoading(false));
  }, []);

  const categoryNames = useMemo(
    () => Object.fromEntries(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const openNew = () => {
    if (!perm.guard("create")) return;
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (supply: Supply) => {
    if (!perm.guard("update")) return;
    setEditingId(supply.id);
    setForm({
      category_id: supply.category_id,
      name: supply.name,
      package_cost: String(supply.package_cost),
      package_quantity: String(supply.package_quantity),
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!perm.guard(editingId ? "update" : "create")) return;
    const packageCost = Number(form.package_cost);
    const packageQuantity = Number(form.package_quantity);
    if (!form.category_id) return toast.error("Selecciona una categoría");
    if (!form.name.trim()) return toast.error("Escribe el nombre del insumo");
    if (!Number.isFinite(packageCost) || packageCost < 0)
      return toast.error("El costo debe ser igual o mayor que cero");
    if (!Number.isFinite(packageQuantity) || packageQuantity <= 0)
      return toast.error("La cantidad del paquete debe ser mayor que cero");
    if (!user) return toast.error("Inicia sesión para registrar insumos");

    setSaving(true);
    try {
      const payload = {
        category_id: form.category_id,
        name: form.name.trim(),
        package_cost: packageCost,
        package_quantity: packageQuantity,
      };
      const saved = editingId
        ? await inventoryController.updateSupply(editingId, payload)
        : await inventoryController.createSupply({ ...payload, user_id: user.id });
      setSupplies((current) =>
        editingId
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [...current, saved].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setDialogOpen(false);
      resetForm();
      toast.success(editingId ? "Insumo actualizado" : "Insumo creado");
    } catch {
      toast.error("No se pudo guardar el insumo");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!perm.guard("delete")) return;
    try {
      await inventoryController.removeSupply(id);
      setSupplies((current) => current.filter((item) => item.id !== id));
      toast.success("Insumo eliminado");
    } catch {
      toast.error("No se puede eliminar: el insumo está incluido en una receta");
    }
  };

  const unitCost = Number(form.package_cost) / Number(form.package_quantity);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insumos"
        description="Registra materias primas por categoría y consulta su costo unitario."
      />
      <div className="flex justify-end">
        <Button onClick={openNew} disabled={categories.length === 0}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo insumo
        </Button>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar insumo" : "Nuevo insumo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select
                value={form.category_id}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, category_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supply-name">Nombre del insumo</Label>
              <Input
                id="supply-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Taza blanca 11 oz"
                maxLength={120}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="package-cost">Costo del paquete (C$)</Label>
                <Input
                  id="package-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.package_cost}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, package_cost: event.target.value }))
                  }
                  placeholder="120.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="package-quantity">Unidades por paquete</Label>
                <Input
                  id="package-quantity"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={form.package_quantity}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, package_quantity: event.target.value }))
                  }
                  placeholder="12"
                />
              </div>
            </div>
            {Number.isFinite(unitCost) && unitCost >= 0 && Number(form.package_quantity) > 0 && (
              <p className="text-sm text-muted-foreground">
                Costo por unidad:{" "}
                <span className="font-semibold text-foreground">
                  {formatMoney(unitCost, "NIO")}
                </span>
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {editingId ? "Guardar cambios" : "Crear insumo"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}
                disabled={saving}
              >
                <X className="mr-2 h-4 w-4" /> Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {categories.length === 0 && !loading ? (
        <EmptyState
          icon={Package}
          title="Primero crea una categoría"
          description="Los insumos comparten las categorías existentes del catálogo."
        />
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando insumos...
        </div>
      ) : supplies.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sin insumos"
          description="Registra una materia prima para comenzar a calcular costos."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Paquete</TableHead>
                  <TableHead>Costo unitario</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplies.map((supply) => (
                  <TableRow key={supply.id}>
                    <TableCell className="font-medium">{supply.name}</TableCell>
                    <TableCell>{categoryNames[supply.category_id] ?? "—"}</TableCell>
                    <TableCell>
                      {formatMoney(supply.package_cost, "NIO")} / {supply.package_quantity}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatMoney(supply.unit_cost, "NIO")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(supply)}
                        aria-label={`Editar ${supply.name}`}
                        title="Editar insumo"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => void remove(supply.id)}
                        aria-label={`Eliminar ${supply.name}`}
                        title="Eliminar insumo"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
