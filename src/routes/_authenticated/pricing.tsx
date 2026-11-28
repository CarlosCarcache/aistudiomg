import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calculator, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/views/PageHeader";
import { EmptyState } from "@/views/EmptyState";
import { catalogController } from "@/controllers/catalog.controller";
import { inventoryController } from "@/controllers/inventory.controller";
import type { Product, ProductCategory, ProductRecipe, Supply } from "@/models/types";
import {
  calculateSuggestedPricing,
  MINIMUM_PROFIT_MARGIN,
  suggestedVolumeDiscount,
} from "@/lib/pricing";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/_authenticated/pricing")({
  component: SuggestedPricingPage,
  head: () => ({
    meta: [
      { title: "Precio sugerido | AI Studio MG" },
      {
        name: "description",
        content: "Calcula costos de recetas y precios sugeridos de productos en AI Studio MG.",
      },
      { property: "og:title", content: "Precio sugerido | AI Studio MG" },
      {
        property: "og:description",
        content: "Calcula costos de recetas y precios sugeridos de productos en AI Studio MG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SuggestedPricingPage() {
  const perm = usePermissions("catalog");
  const { user } = useAuth();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [supplyId, setSupplyId] = useState("");
  const [recipeQuantity, setRecipeQuantity] = useState("1");
  const [recipeDrafts, setRecipeDrafts] = useState<Record<string, string>>({});
  const [orderQuantity, setOrderQuantity] = useState("1");
  const [discountDraft, setDiscountDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [savingDiscount, setSavingDiscount] = useState(false);

  useEffect(() => {
    Promise.all([
      catalogController.listCategories(),
      catalogController.listProducts(),
      inventoryController.listSupplies(),
      inventoryController.listRecipes(),
    ])
      .then(([categoryRows, productRows, supplyRows, recipeRows]) => {
        setCategories(categoryRows);
        setProducts(productRows);
        setSupplies(supplyRows);
        setRecipes(recipeRows);
      })
      .catch(() => toast.error("No se pudo cargar la calculadora de precios"))
      .finally(() => setLoading(false));
  }, []);

  const categoryProducts = useMemo(
    () => products.filter((product) => product.category_id === categoryId),
    [products, categoryId],
  );
  const categorySupplies = useMemo(
    () => supplies.filter((supply) => supply.category_id === categoryId),
    [supplies, categoryId],
  );
  const product = products.find((item) => item.id === productId) ?? null;
  const productRecipes = recipes.filter((recipe) => recipe.product_id === productId);
  const supplyById = useMemo(
    () => Object.fromEntries(supplies.map((supply) => [supply.id, supply])),
    [supplies],
  );

  useEffect(() => {
    setDiscountDraft(
      product?.manual_discount_pct == null ? "" : String(product.manual_discount_pct),
    );
  }, [productId, product?.manual_discount_pct]);

  useEffect(() => {
    if (!categorySupplies.some((supply) => supply.id === supplyId)) {
      setSupplyId(categorySupplies[0]?.id ?? "");
    }
  }, [categorySupplies, supplyId]);

  const unitCost = productRecipes.reduce((total, recipe) => {
    const supply = supplyById[recipe.supply_id];
    return total + (supply ? supply.unit_cost * recipe.quantity_used : 0);
  }, 0);
  const quantity = Math.max(1, Number(orderQuantity) || 1);
  const discountInputValid =
    discountDraft.trim() === "" ||
    (Number.isFinite(Number(discountDraft)) &&
      Number(discountDraft) >= 0 &&
      Number(discountDraft) <= 100);
  const manualDiscount =
    discountDraft.trim() === "" || !discountInputValid ? null : Number(discountDraft);
  const pricing = calculateSuggestedPricing(unitCost, quantity, manualDiscount);
  const currentProductDiscount = product?.manual_discount_pct ?? null;
  const parsedDiscount = discountDraft.trim() === "" ? null : Number(discountDraft);
  const discountChanged = product && parsedDiscount !== currentProductDiscount;

  const selectCategory = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
    setProductId(products.find((item) => item.category_id === nextCategoryId)?.id ?? "");
  };

  const addRecipeSupply = async () => {
    if (!perm.guard("update")) return;
    if (!user || !product) return toast.error("Selecciona un producto e inicia sesión");
    const used = Number(recipeQuantity);
    if (!supplyId) return toast.error("No hay insumos disponibles en esta categoría");
    if (!Number.isFinite(used) || used <= 0)
      return toast.error("La cantidad usada debe ser mayor que cero");
    setSavingRecipe(true);
    try {
      const current = productRecipes.find((recipe) => recipe.supply_id === supplyId);
      const saved = current
        ? await inventoryController.updateRecipe(current.id, used)
        : await inventoryController.createRecipe({
            user_id: user.id,
            product_id: product.id,
            supply_id: supplyId,
            quantity_used: used,
          });
      setRecipes((rows) =>
        current
          ? rows.map((recipe) => (recipe.id === saved.id ? saved : recipe))
          : [...rows, saved],
      );
      setRecipeQuantity("1");
      toast.success(current ? "Cantidad de receta actualizada" : "Insumo agregado a la receta");
    } catch {
      toast.error("No se pudo guardar: producto e insumo deben compartir categoría");
    } finally {
      setSavingRecipe(false);
    }
  };

  const saveRecipeQuantity = async (recipe: ProductRecipe) => {
    if (!perm.guard("update")) return;
    const used = Number(recipeDrafts[recipe.id] ?? recipe.quantity_used);
    if (!Number.isFinite(used) || used <= 0)
      return toast.error("La cantidad usada debe ser mayor que cero");
    try {
      const saved = await inventoryController.updateRecipe(recipe.id, used);
      setRecipes((rows) => rows.map((item) => (item.id === saved.id ? saved : item)));
      setRecipeDrafts((drafts) => {
        const next = { ...drafts };
        delete next[recipe.id];
        return next;
      });
      toast.success("Receta actualizada");
    } catch {
      toast.error("No se pudo actualizar la receta");
    }
  };

  const removeRecipeSupply = async (recipe: ProductRecipe) => {
    if (!perm.guard("update")) return;
    try {
      await inventoryController.removeRecipe(recipe.id);
      setRecipes((rows) => rows.filter((item) => item.id !== recipe.id));
      toast.success("Insumo retirado de la receta");
    } catch {
      toast.error("No se pudo retirar el insumo");
    }
  };

  const saveManualDiscount = async () => {
    if (!perm.guard("update")) return;
    if (!product) return;
    if (!discountInputValid) return toast.error("El descuento debe estar entre 0% y 100%");
    setSavingDiscount(true);
    try {
      const updated = await catalogController.updateProduct(product.id, {
        manual_discount_pct: parsedDiscount,
      });
      setProducts((rows) =>
        rows.map((item) =>
          item.id === updated.id
            ? { ...item, manual_discount_pct: updated.manual_discount_pct }
            : item,
        ),
      );
      toast.success(
        parsedDiscount == null ? "Descuento manual eliminado" : "Descuento manual guardado",
      );
    } catch {
      toast.error("No se pudo guardar el descuento");
    } finally {
      setSavingDiscount(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Precio sugerido"
        description="Calcula el costo de receta y protege el margen de ganancia de cada producto."
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando productos e insumos...
        </div>
      ) : products.length === 0 || categories.length === 0 ? (
        <EmptyState
          icon={Calculator}
          title="Falta configurar el catálogo"
          description="Crea primero una categoría y un producto en Catálogo para armar su receta."
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select
                value={categoryId || "none"}
                onValueChange={(value) => selectCategory(value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecciona una categoría</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Producto</Label>
              <Select
                value={productId || "none"}
                onValueChange={(value) => setProductId(value === "none" ? "" : value)}
                disabled={!categoryId || categoryProducts.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un producto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecciona un producto</SelectItem>
                  {categoryProducts.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categoryId && categoryProducts.length === 0 && (
                <p className="text-xs text-muted-foreground">No hay productos en esta categoría.</p>
              )}
            </div>
          </div>

          {product && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="text-base">Receta · {product.name}</CardTitle>
                    <Badge variant="outline">
                      {categories.find((category) => category.id === product.category_id)?.name}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {productRecipes.length === 0 ? (
                    <EmptyState
                      icon={Calculator}
                      title="Receta vacía"
                      description="Agrega los insumos usados para fabricar una unidad de este producto."
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Insumo</TableHead>
                          <TableHead>Costo unitario</TableHead>
                          <TableHead>Uso por producto</TableHead>
                          <TableHead className="text-right">Costo aplicado</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productRecipes.map((recipe) => {
                          const supply = supplyById[recipe.supply_id];
                          if (!supply) return null;
                          const used = Number(recipeDrafts[recipe.id] ?? recipe.quantity_used);
                          return (
                            <TableRow key={recipe.id}>
                              <TableCell className="font-medium">{supply.name}</TableCell>
                              <TableCell>{formatMoney(supply.unit_cost, "NIO")}</TableCell>
                              <TableCell className="w-36">
                                <Input
                                  type="number"
                                  min="0.001"
                                  step="0.001"
                                  aria-label={`Cantidad de ${supply.name} por producto`}
                                  value={recipeDrafts[recipe.id] ?? String(recipe.quantity_used)}
                                  onChange={(event) =>
                                    setRecipeDrafts((drafts) => ({
                                      ...drafts,
                                      [recipe.id]: event.target.value,
                                    }))
                                  }
                                />
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatMoney(
                                  supply.unit_cost * (Number.isFinite(used) ? used : 0),
                                  "NIO",
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => void saveRecipeQuantity(recipe)}
                                  aria-label={`Guardar cantidad de ${supply.name}`}
                                  title="Guardar cantidad"
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => void removeRecipeSupply(recipe)}
                                  aria-label={`Quitar ${supply.name}`}
                                  title="Quitar insumo"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}

                  <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Label>Insumo de la categoría</Label>
                      <Select
                        value={supplyId || "none"}
                        onValueChange={(value) => setSupplyId(value === "none" ? "" : value)}
                        disabled={categorySupplies.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un insumo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Selecciona un insumo</SelectItem>
                          {categorySupplies.map((supply) => (
                            <SelectItem key={supply.id} value={supply.id}>
                              {supply.name} · {formatMoney(supply.unit_cost, "NIO")}/u
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-full space-y-2 sm:w-40">
                      <Label htmlFor="recipe-quantity">Cantidad por unidad</Label>
                      <Input
                        id="recipe-quantity"
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={recipeQuantity}
                        onChange={(event) => setRecipeQuantity(event.target.value)}
                      />
                    </div>
                    <Button
                      onClick={() => void addRecipeSupply()}
                      disabled={savingRecipe || categorySupplies.length === 0}
                    >
                      {savingRecipe ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Agregar insumo
                    </Button>
                  </div>
                  {categorySupplies.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Registra primero insumos para esta categoría.
                    </p>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Descuento por cantidad</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="order-quantity">Unidades a vender</Label>
                      <Input
                        id="order-quantity"
                        type="number"
                        min="1"
                        step="1"
                        value={orderQuantity}
                        onChange={(event) => setOrderQuantity(event.target.value)}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="manual-discount">Descuento manual (%)</Label>
                        <Input
                          id="manual-discount"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={discountDraft}
                          onChange={(event) => setDiscountDraft(event.target.value)}
                          placeholder="Usar sugerencia por cantidad"
                          aria-invalid={!discountInputValid}
                        />
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => void saveManualDiscount()}
                        disabled={!discountChanged || savingDiscount || !discountInputValid}
                        aria-label="Guardar descuento manual"
                        title="Guardar descuento manual"
                      >
                        {savingDiscount ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {!discountInputValid ? (
                      <p className="text-xs text-destructive">
                        El descuento debe estar entre 0% y 100%.
                      </p>
                    ) : (
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>
                          Sugerencia por volumen:{" "}
                          <span className="font-medium text-foreground">
                            {suggestedVolumeDiscount(quantity)}%
                          </span>
                        </p>
                        <p>
                          Descuento aplicado:{" "}
                          <span className="font-medium text-foreground">
                            {pricing.discountPct}%
                          </span>
                          {manualDiscount != null ? " · manual" : " · por cantidad"}
                        </p>
                        <p className="text-xs">
                          Regla sugerida: 5% desde 12 unidades y 10% desde 24.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Resumen de precios</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1 border-l-2 border-primary pl-3">
                        <p className="text-xs text-muted-foreground">Sugerido por unidad</p>
                        <p className="text-lg font-semibold">
                          {formatMoney(pricing.baseUnitPrice, "NIO")}
                        </p>
                      </div>
                      <div className="space-y-1 border-l-2 border-primary pl-3">
                        <p className="text-xs text-muted-foreground">Sugerido por docena</p>
                        <p className="text-lg font-semibold">
                          {formatMoney(pricing.baseDozenPrice, "NIO")}
                        </p>
                      </div>
                      <div className="space-y-1 border-l-2 border-border pl-3">
                        <p className="text-xs text-muted-foreground">Costo por unidad</p>
                        <p className="text-lg font-semibold">{formatMoney(unitCost, "NIO")}</p>
                      </div>
                    </div>
                    {productRecipes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Agrega insumos para calcular precios y margen.
                      </p>
                    ) : (
                      <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Precio con descuento / unidad
                          </p>
                          <p className="font-semibold">{formatMoney(pricing.unitPrice, "NIO")}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Precio con descuento / docena
                          </p>
                          <p className="font-semibold">{formatMoney(pricing.dozenPrice, "NIO")}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Total por {quantity} unidades
                          </p>
                          <p className="font-semibold">
                            {formatMoney(pricing.quantityTotal, "NIO")}
                          </p>
                        </div>
                      </div>
                    )}
                    {productRecipes.length > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                        <span className="text-sm">Margen estimado</span>
                        <Badge
                          variant={
                            pricing.marginPct >= MINIMUM_PROFIT_MARGIN * 100
                              ? "default"
                              : "destructive"
                          }
                        >
                          {pricing.marginPct.toFixed(1)}%
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {productRecipes.length > 0 && pricing.belowMinimum && (
                <div
                  role="alert"
                  className="flex items-start gap-3 border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      El descuento deja el margen por debajo del 45% mínimo.
                    </p>
                    <p>
                      Margen actual: {pricing.marginPct.toFixed(1)}%. Precio mínimo para conservar
                      el margen: {formatMoney(pricing.baseUnitPrice, "NIO")} por unidad.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
