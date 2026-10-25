import { usePermissions } from "@/hooks/use-permissions";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/views/PageHeader";
import { EmptyState } from "@/views/EmptyState";
import { employeesController } from "@/controllers/employees.controller";
import type { Employee } from "@/models/types";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/employees")({
  component: EmployeesPage,
  head: () => ({
    meta: [
      { title: "Empleados | AI Studio MG" },
      {
        name: "description",
        content:
          "Alta y baja de personal del estudio con cargo, contacto y estado activo.",
      },
      { property: "og:title", content: "Empleados | AI Studio MG" },
      {
        property: "og:description",
        content: "Gestiona el personal autorizado para operar el sistema.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const emptyForm = {
  first_name: "",
  last_name: "",
  role_title: "",
  email: "",
  phone: "",
};

function EmployeesPage() {
  const perm = usePermissions("employees");
  const { user } = useAuth();
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");

  useEffect(() => {
    employeesController
      .list()
      .then(setRows)
      .catch(() => toast.error("No se pudieron cargar los empleados"))
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof typeof emptyForm, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const openNewEmployee = () => {
    reset();
    setEmployeeDialogOpen(true);
  };

  const submit = async () => {
    if (!perm.guard(editingId ? "update" : "create")) return;
    if (!form.first_name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (!user && !editingId) {
      toast.error("Inicia sesión para registrar empleados");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        role_title: form.role_title.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
      };
      if (editingId) {
        const updated = await employeesController.update(editingId, payload);
        setRows((r) => r.map((e) => (e.id === updated.id ? updated : e)));
        toast.success("Empleado actualizado");
      } else {
        const created = await employeesController.create({
          ...payload,
          user_id: user!.id,
        });
        setRows((r) => [created, ...r]);
        toast.success("Empleado creado");
      }
      reset();
      setEmployeeDialogOpen(false);
    } catch {
      toast.error("No se pudo guardar el empleado");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (e: Employee) => {
    try {
      const updated = await employeesController.update(e.id, {
        active: !e.active,
      });
      setRows((r) => r.map((x) => (x.id === updated.id ? updated : x)));
    } catch {
      toast.error("No se pudo cambiar el estado");
    }
  };

  const remove = async (id: string) => {
    if (!perm.guard("delete")) return;
    try {
      await employeesController.remove(id);
      setRows((r) => r.filter((e) => e.id !== id));
      if (editingId === id) reset();
      toast.success("Empleado eliminado");
    } catch {
      toast.error("No se pudo eliminar el empleado");
    }
  };

  const filteredRows = rows.filter((employee) =>
    `${employee.first_name} ${employee.last_name ?? ""}`
      .trim()
      .toLocaleLowerCase()
      .includes(employeeSearch.trim().toLocaleLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empleados"
        description="Personal del estudio: cargo, contacto y estado activo."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={employeeSearch}
            onChange={(event) => setEmployeeSearch(event.target.value)}
            placeholder="Buscar por nombre de empleado…"
            aria-label="Buscar por nombre de empleado"
            className="pl-9"
          />
        </div>
        <Button onClick={openNewEmployee}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo empleado
        </Button>
      </div>

      <Dialog
        open={employeeDialogOpen}
        onOpenChange={(isOpen) => {
          setEmployeeDialogOpen(isOpen);
          if (!isOpen) reset();
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">
                {editingId ? "Editar empleado" : "Nuevo empleado"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="e_first">Nombre *</Label>
                <Input
                  id="e_first"
                  value={form.first_name}
                  onChange={(ev) => set("first_name", ev.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e_last">Apellido</Label>
                <Input
                  id="e_last"
                  value={form.last_name}
                  onChange={(ev) => set("last_name", ev.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e_role">Cargo</Label>
                <Input
                  id="e_role"
                  placeholder="Diseñador, ventas…"
                  value={form.role_title}
                  onChange={(ev) => set("role_title", ev.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e_email">Email</Label>
                <Input
                  id="e_email"
                  type="email"
                  value={form.email}
                  onChange={(ev) => set("e_email", ev.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e_phone">Teléfono</Label>
                <Input
                  id="e_phone"
                  value={form.phone}
                  onChange={(ev) => set("e_phone", ev.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={submit} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {editingId ? "Guardar" : "Crear"}
                </Button>
                {editingId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      reset();
                      setEmployeeDialogOpen(false);
                    }}
                  >
                    <X className="mr-2 h-4 w-4" /> Cancelar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando empleados…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title="Sin empleados"
          description="Registra al personal autorizado del estudio con el botón Nuevo empleado."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No se encontraron empleados con ese nombre.
                    </TableCell>
                  </TableRow>
                ) : filteredRows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      {e.first_name} {e.last_name ?? ""}
                    </TableCell>
                    <TableCell>
                      {e.role_title ? (
                        <Badge variant="secondary">{e.role_title}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.email ?? e.phone ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={e.active}
                        onCheckedChange={() => toggleActive(e)}
                        aria-label="Activo"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Editar"
                        onClick={() => {
                          setEditingId(e.id);
                          setForm({
                            first_name: e.first_name ?? "",
                            last_name: e.last_name ?? "",
                            role_title: e.role_title ?? "",
                            email: e.email ?? "",
                            phone: e.phone ?? "",
                          });
                          setEmployeeDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Eliminar"
                        onClick={() => remove(e.id)}
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
