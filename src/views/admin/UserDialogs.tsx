import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createUser,
  getUserPermissions,
  saveUserPermissions,
  setUserPassword,
} from "@/lib/admin-users.functions";

const MODULES = [
  { key: "projects", label: "Proyectos" },
  { key: "orders", label: "Pedidos" },
  { key: "clients", label: "Clientes" },
  { key: "employees", label: "Empleados" },
  { key: "catalog", label: "Catálogo" },
  { key: "gallery", label: "Galería" },
  { key: "portfolio", label: "Portafolio" },
] as const;
type ModuleKey = (typeof MODULES)[number]["key"];
type Perm = { module: ModuleKey; can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean };
const ACTIONS = [
  { key: "can_create", label: "Crear" },
  { key: "can_read", label: "Ver" },
  { key: "can_update", label: "Editar" },
  { key: "can_delete", label: "Borrar" },
] as const;

export function CreateUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const fn = useServerFn(createUser);
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await fn({ data: { username, password, role } });
      toast.success("Usuario creado");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setUsername(""); setPassword(""); setRole("viewer");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message || "Error al crear usuario");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo usuario</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Usuario</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="usuario" />
          </div>
          <div className="space-y-1">
            <Label>Contraseña (mín. 8)</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">viewer</SelectItem>
                <SelectItem value="editor">editor</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy || username.length < 3 || password.length < 8}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PasswordDialog({ user, onClose }: { user: { id: string; name: string } | null; onClose: () => void }) {
  const fn = useServerFn(setUserPassword);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setPassword(""), [user]);
  const submit = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await fn({ data: { userId: user.id, password } });
      toast.success("Contraseña actualizada");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva contraseña para {user?.name}</DialogTitle></DialogHeader>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mín. 8 caracteres" />
        <DialogFooter>
          <Button onClick={submit} disabled={busy || password.length < 8}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PermissionsDialog({ user, onClose }: { user: { id: string; name: string } | null; onClose: () => void }) {
  const getFn = useServerFn(getUserPermissions);
  const saveFn = useServerFn(saveUserPermissions);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getFn({ data: { userId: user.id } })
      .then((rows) => {
        setPerms(
          MODULES.map((m) => {
            const r = rows.find((x) => x.module === m.key);
            return {
              module: m.key,
              can_create: r?.can_create ?? false,
              can_read: r?.can_read ?? true,
              can_update: r?.can_update ?? false,
              can_delete: r?.can_delete ?? false,
            };
          }),
        );
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [user, getFn]);

  const toggle = (mod: ModuleKey, key: (typeof ACTIONS)[number]["key"], v: boolean) =>
    setPerms((ps) => ps.map((p) => (p.module === mod ? { ...p, [key]: v } : p)));

  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await saveFn({ data: { userId: user.id, permissions: perms } });
      toast.success("Permisos guardados");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Permisos de {user?.name}</DialogTitle></DialogHeader>
        {loading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-2 text-left font-medium">Apartado</th>
                {ACTIONS.map((a) => <th key={a.key} className="py-2 font-medium">{a.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {perms.map((p) => (
                <tr key={p.module} className="border-t border-border">
                  <td className="py-2">{MODULES.find((m) => m.key === p.module)?.label}</td>
                  {ACTIONS.map((a) => (
                    <td key={a.key} className="py-2 text-center">
                      <Checkbox checked={p[a.key]} onCheckedChange={(v) => toggle(p.module, a.key, v === true)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <DialogFooter>
          <Button onClick={save} disabled={busy || loading}>Guardar permisos</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
