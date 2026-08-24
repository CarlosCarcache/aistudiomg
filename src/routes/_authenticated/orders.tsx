import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/views/PageHeader";
import { EmptyState } from "@/views/EmptyState";
import { ordersController } from "@/controllers/orders.controller";
import type { Order, OrderStatus } from "@/models/types";
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
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<OrderStatus>("nuevo");

  useEffect(() => {
    ordersController
      .list()
      .then(setOrders)
      .catch(() => toast.error("No se pudieron cargar los pedidos"))
      .finally(() => setLoading(false));
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Escribe un título para el pedido");
      return;
    }
    if (!user) {
      toast.error("Inicia sesión para registrar pedidos");
      return;
    }
    setSaving(true);
    try {
      const created = await ordersController.create({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        price: price ? Number(price) : null,
        due_date: dueDate || null,
        status,
      });
      setOrders((prev) => [created, ...prev]);
      setTitle("");
      setDescription("");
      setPrice("");
      setDueDate("");
      setStatus("nuevo");
      toast.success("Pedido creado");
    } catch {
      toast.error("No se pudo crear el pedido");
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (id: string, next: OrderStatus) => {
    const prev = orders;
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, status: next } : o)));
    try {
      await ordersController.setStatus(id, next);
    } catch {
      setOrders(prev);
      toast.error("No se pudo actualizar el estado");
    }
  };

  const handleRemove = async (id: string) => {
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
              {order.description && (
                <p className="text-sm text-muted-foreground">{order.description}</p>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {order.price != null && <span>Precio: {order.price}</span>}
                {order.due_date && <span>Entrega: {order.due_date}</span>}
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
          <CardTitle className="text-base">Nuevo pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
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
              <Label htmlFor="price">Precio</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
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
            <div className="md:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear pedido
              </Button>
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
