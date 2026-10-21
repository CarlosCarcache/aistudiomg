import { usePermissions } from "@/hooks/use-permissions";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/views/PageHeader";
import { EmptyState } from "@/views/EmptyState";
import { ordersController } from "@/controllers/orders.controller";
import type { Order, OrderStatus, ProductCategory, Client, Employee } from "@/models/types";
import { clientsController } from "@/controllers/clients.controller";
import { employeesController } from "@/controllers/employees.controller";
import { catalogController } from "@/controllers/catalog.controller";
import { galleryController } from "@/controllers/gallery.controller";
import { CURRENCIES, formatMoney, orderTotal, type CurrencyCode } from "@/lib/money";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/orders")({
  component: OrdersPage,
  head: () => ({
    meta: [
      { title: "Pedidos | AI Studio MG" },
      {
        name: "description",
        content:
          "Gestiona pedidos nuevos, en proceso y terminados con precios, fechas de entrega y responsables.",
      },
      { property: "og:title", content: "Pedidos | AI Studio MG" },
      {
        property: "og:description",
        content: "Pedidos nuevos, en proceso y terminados en un solo panel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "nuevo", label: "Nuevos" },
  { value: "en_proceso", label: "En proceso" },
  { value: "terminado", label: "Terminados" },
];

const statusLabel = (s: OrderStatus) =>
  s === "nuevo" ? "Nuevo" : s === "en_proceso" ? "En proceso" : "Terminado";

function OrdersPage() {
  const perm = usePermissions("orders");
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sharedUrls, setSharedUrls] = useState<Record<string, string>>({});
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState("");
  const [cur, setCur] = useState<CurrencyCode>("NIO");
  const [categoryId, setCategoryId] = useState("");
  const [clientId, setClientId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<OrderStatus>("nuevo");

  useEffect(() => {
    ordersController
      .list()
      .then(async (rows) => {
        setOrders(rows);
        const paths = rows.flatMap((row) => Array.isArray(row.selected_images) ? row.selected_images.flatMap((item) => item && typeof item === "object" && !Array.isArray(item) && typeof item.image_url === "string" ? [item.image_url] : []) : []);
        setSharedUrls(Object.fromEntries(await Promise.all([...new Set(paths)].map(async (path) => [path, await galleryController.resolveUrl(path)]))));
      })
      .catch(() => toast.error("No se pudieron cargar los pedidos"))
      .finally(() => setLoading(false));
    catalogController.listCategories().then(setCategories).catch(() => {});
    clientsController.list().then(setClients).catch(() => {});
    employeesController.list().then(setEmployees).catch(() => {});
  }, []);

  const grouped = useMemo(
    () =>
      STATUSES.reduce<Record<OrderStatus, Order[]>>(
        (acc, s) => {
          acc[s.value] = orders.filter((o) => o.status === s.value);
          return acc;
        },
        { nuevo: [], en_proceso: [], terminado: [] },
      ),
    [orders],
  );

  const clientName = (id: string) => {
    const c = clients.find((cl) => cl.id === id);
    if (!c) return "—";
    return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "—";
  };

  const resetForm = () => {
    setEditingOrder(null);
    setTitle("");
    setDescription("");
    setNotes("");
    setPrice("");
    setCur("NIO");
    setQuantity("1");
    setCategoryId("");
    setClientId("");
    setEmployeeId("");
    setPaymentMethod("");
    setDueDate("");
    setStatus("nuevo");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perm.guard(editingOrder ? "update" : "create")) return;
    if (!title.trim()) {
      toast.error("Escribe un título para el pedido");
      return;
    }
    if (!user) {
      toast.error("Inicia sesión para gestionar pedidos");
      return;
    }
    setSaving(true);
    try {
      if (editingOrder) {
        const updated = await ordersController.update(editingOrder.id, {
          title: title.trim(),
          description: description.trim() || null,
          notes: notes.trim() || null,
          ...(Array.isArray(editingOrder.selected_images)
            ? {}
            : {
                price: price ? Number(price) : null,
                currency: cur,
                quantity: Math.max(1, Number(quantity) || 1),
              }),
          category_id: categoryId || null,
          client_id: clientId || null,
          employee_id: employeeId || null,
          payment_method: paymentMethod.trim() || null,
          due_date: dueDate || null,
          status,
        });
        setOrders((prev) => prev.map((order) => (order.id === updated.id ? updated : order)));
        toast.success("Pedido actualizado");
      } else {
        const created = await ordersController.create({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          notes: notes.trim() || null,
          price: price ? Number(price) : null,
          currency: cur,
          category_id: categoryId || null,
          client_id: clientId || null,
          employee_id: employeeId || null,
          quantity: Math.max(1, Number(quantity) || 1),
          payment_method: paymentMethod.trim() || null,
          due_date: dueDate || null,
          status,
        });
        setOrders((prev) => [created, ...prev]);
        toast.success("Pedido creado");
      }
      resetForm();
    } catch {
      toast.error(editingOrder ? "No se pudo actualizar el pedido" : "No se pudo crear el pedido");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (order: Order) => {
    if (!perm.guard("update")) return;
    setEditingOrder(order);
    setTitle(order.title);
    setDescription(order.description ?? "");
    setNotes(order.notes ?? "");
    setPrice(order.price == null ? "" : String(order.price));
    setCur(order.currency as CurrencyCode);
    setCategoryId(order.category_id ?? "");
    setClientId(order.client_id ?? "");
    setEmployeeId(order.employee_id ?? "");
    setQuantity(String(order.quantity ?? 1));
    setPaymentMethod(order.payment_method ?? "");
    setDueDate(order.due_date ?? "");
    setStatus(order.status);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleStatus = async (id: string, next: OrderStatus) => {
    if (!perm.guard("update")) return;
    const prev = orders;
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, status: next } : o)));
    try {
      await ordersController.setStatus(id, next);
    } catch {
      setOrders(prev);
      toast.error("No se pudo actualizar el estado");
    }
  };

  const handleEmployee = async (id: string, next: string | null) => {
    if (!perm.guard("update")) return;
    const prev = orders;
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, employee_id: next } : o)));
    try {
      await ordersController.setEmployee(id, next);
      toast.success(next ? "Empleado asignado" : "Empleado liberado");
    } catch {
      setOrders(prev);
      toast.error("No se pudo asignar el empleado");
    }
  };

  const handleRemove = async (id: string) => {
    if (!perm.guard("delete")) return;
    const prev = orders;
    setOrders((os) => os.filter((o) => o.id !== id));
    try {
      await ordersController.remove(id);
      toast.success("Pedido eliminado");
    } catch {
      setOrders(prev);
      toast.error("No se pudo eliminar el pedido");
    }
  };

  const renderList = (list: Order[]) => {
    if (loading) {
      return (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando pedidos...
        </div>
      );
    }
    if (list.length === 0) {
      return (
        <EmptyState
          icon={ClipboardList}
          title="Sin pedidos en esta etapa"
          description="Crea un pedido nuevo con el formulario de arriba."
        />
      );
    }
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((order) => (
          <Card key={order.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{order.title}</CardTitle>
                <Badge variant="secondary">{statusLabel(order.status)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.isArray(order.selected_images) && <div className="space-y-2">{order.selected_images.map((item, index) => {
                if (!item || typeof item !== "object" || Array.isArray(item)) return null;
                return <div key={index} className="flex items-center gap-3">{typeof item.image_url === "string" && sharedUrls[item.image_url] && <img src={sharedUrls[item.image_url]} alt={String(item.title ?? "Imagen")} className="h-14 w-14 rounded object-cover" />}<span className="min-w-0 flex-1 text-sm">{String(item.title ?? "Imagen")}</span><span className="text-sm font-medium">{formatMoney(Number(item.price ?? 0), order.currency)}</span></div>;
              })}</div>}
              {order.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{order.notes}</p>}
              {order.description && (
                <p className="text-sm text-muted-foreground">{order.description}</p>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {order.price != null && (
                  <span>
                    Precio: {formatMoney(Number(order.price), order.currency)} ×{" "}
                    {order.quantity ?? 1} ={" "}
                    <span className="font-medium text-foreground">
                      {formatMoney(orderTotal(order.price, order.quantity), order.currency)}
                    </span>
                  </span>
                )}
                {order.client_id && (
                  <span>
                    Cliente:{" "}
                    <span className="font-medium text-foreground">
                      {clientName(order.client_id)}
                    </span>
                  </span>
                )}
                {order.category_id && (
                  <span>Categoría: {categories.find((c) => c.id === order.category_id)?.name ?? "—"}</span>
                )}
                {order.payment_method && <span>Pago: {order.payment_method}</span>}
                {order.due_date && <span>Entrega: {order.due_date}</span>}
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={order.employee_id || "none"}
                  onValueChange={(v) => handleEmployee(order.id, v === "none" ? null : v)}
                >
                  <SelectTrigger className="h-8 flex-1" aria-label="Empleado asignado">
                    <SelectValue placeholder="Asignar empleado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin empleado</SelectItem>
                    {employees
                      .filter((e) => e.active)
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {[e.first_name, e.last_name].filter(Boolean).join(" ") || e.email || e.id}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={order.status}
                  onValueChange={(v) => handleStatus(order.id, v as OrderStatus)}
                >
                  <SelectTrigger className="h-8 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {statusLabel(s.value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Editar pedido"
                  onClick={() => handleEdit(order)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Eliminar pedido"
                  onClick={() => handleRemove(order.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos e historial"
        description="Controla los pedidos nuevos, en proceso y terminados."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingOrder ? "Editar pedido" : "Nuevo pedido"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Camisetas DTF - Cliente X"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {statusLabel(s.value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clientId || "none"} onValueChange={(v) => setClientId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin cliente</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Empleado que lo realiza</Label>
              <Select value={employeeId || "none"} onValueChange={(v) => setEmployeeId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin empleado</SelectItem>
                  {employees
                    .filter((e) => e.active)
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {[e.first_name, e.last_name].filter(Boolean).join(" ") || e.email || e.id}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Precio unitario</Label>
              <div className="flex gap-2">
                <Select
                  value={cur}
                  onValueChange={(v) => setCur(v as CurrencyCode)}
                  disabled={Boolean(editingOrder && Array.isArray(editingOrder.selected_images))}
                >
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input id="price" type="number" step="0.01" value={price}
                  onChange={(e) => setPrice(e.target.value)} placeholder="0.00"
                  disabled={Boolean(editingOrder && Array.isArray(editingOrder.selected_images))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Cantidad de productos</Label>
              <Input id="quantity" type="number" min="1" step="1" value={quantity}
                onChange={(e) => setQuantity(e.target.value)} placeholder="1"
                disabled={Boolean(editingOrder && Array.isArray(editingOrder.selected_images))} />
              {editingOrder && Array.isArray(editingOrder.selected_images) && (
                <p className="text-xs text-muted-foreground">
                  El precio de este pedido se conserva según las imágenes seleccionadas.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Total: <span className="font-medium text-foreground">
                  {formatMoney(orderTotal(price || 0, Number(quantity) || 1), cur)}
                </span>
              </p>
            </div>
            <div className="space-y-2">
              <Label>Categoría (carpeta del portafolio)</Label>
              <Select value={categoryId || "none"} onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_method">Método de pago</Label>
              <Select value={paymentMethod || "none"} onValueChange={(v) => setPaymentMethod(v === "none" ? "" : v)}>
                <SelectTrigger id="payment_method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin especificar</SelectItem>
                  <SelectItem value="Efectivo">Efectivo</SelectItem>
                  <SelectItem value="Transferencia">Transferencia</SelectItem>
                  <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="Depósito">Depósito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="due">Fecha de entrega</Label>
              <Input
                id="due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="desc">Descripción</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalles del pedido, medidas, colores..."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionales del pedido..."
              />
            </div>
            <div className="md:col-span-2">
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingOrder ? "Guardar cambios" : "Crear pedido"}
                </Button>
                {editingOrder && (
                  <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Tabs defaultValue="nuevo">
        <TabsList>
          {STATUSES.map((s) => (
            <TabsTrigger key={s.value} value={s.value}>
              {s.label} ({grouped[s.value].length})
            </TabsTrigger>
          ))}
        </TabsList>
        {STATUSES.map((s) => (
          <TabsContent key={s.value} value={s.value} className="mt-4">
            {renderList(grouped[s.value])}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
