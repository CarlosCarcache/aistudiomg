import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Pencil, Save, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/views/PageHeader";
import { EmptyState } from "@/views/EmptyState";
import { clientsController } from "@/controllers/clients.controller";
import type { Client } from "@/models/types";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsPage,
  head: () => ({
    meta: [
      { title: "Clientes | AI Studio MG" },
      {
        name: "description",
        content:
          "Registro de clientes con contacto, método de pago y notas para el estudio de diseño.",
      },
      { property: "og:title", content: "Clientes | AI Studio MG" },
      {
        property: "og:description",
        content: "Alta, edición y borrado de clientes del estudio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const emptyForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  payment_method: "",
  notes: "",
};

function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    clientsController
      .list()
      .then(setClients)
      .catch(() => toast.error("No se pudieron cargar los clientes"))
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof typeof emptyForm, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (c: Client) => {
    setEditingId(c.id);
    setForm({
      first_name: c.first_name ?? "",
      last_name: c.last_name ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      payment_method: c.payment_method ?? "",
      notes: c.notes ?? "",
    });
  };

  const submit = async () => {
    if (!form.first_name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (!user && !editingId) {
      toast.error("Inicia sesión para registrar clientes");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        payment_method: form.payment_method.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        const updated = await clientsController.update(editingId, payload);
        setClients((cs) => cs.map((c) => (c.id === updated.id ? updated : c)));
        toast.success("Cliente actualizado");
      } else {
        const created = await clientsController.create({
          ...payload,
          user_id: user!.id,
        });
        setClients((cs) => [created, ...cs]);
        toast.success("Cliente creado");
      }
      reset();
    } catch {
      toast.error("No se pudo guardar el cliente");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await clientsController.remove(id);
      setClients((cs) => cs.filter((c) => c.id !== id));
      if (editingId === id) reset();
      toast.success("Cliente eliminado");
    } catch {
      toast.error("No se pudo eliminar el cliente");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Alta, edición y borrado de clientes con contacto y método de pago."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingId ? "Editar cliente" : "Nuevo cliente"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="first_name">Nombre *</Label>
            <Input
              id="first_name"
              value={form.first_name}
              onChange={(e) => set("first_name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Apellido</Label>
            <Input
              id="last_name"
              value={form.last_name}
              onChange={(e) => set("last_name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_method">Método de pago</Label>
            <Input
              id="payment_method"
              placeholder="Efectivo, transferencia…"
              value={form.payment_method}
              onChange={(e) => set("payment_method", e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
          <div className="flex gap-2 md:col-span-3">
            <Button onClick={submit} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {editingId ? "Guardar cambios" : "Crear cliente"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={reset}>
                <X className="mr-2 h-4 w-4" /> Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando clientes…
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin clientes"
          description="Registra tu primer cliente con el formulario de arriba."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.first_name} {c.last_name ?? ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.phone ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.payment_method ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startEdit(c)}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(c.id)}
                        aria-label="Eliminar"
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
