import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, ShieldCheck, Trash2, Plus } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/views/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { listUsersWithRoles, setUserRole } from "@/lib/admin-users.functions";
import type { AppRole } from "@/models/types";

const ROLES: AppRole[] = ["admin", "editor", "viewer"];

export const Route = createFileRoute("/_authenticated/admin/users")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    const { data: r } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!r) throw redirect({ to: "/dashboard" });
  },
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const listFn = useServerFn(listUsersWithRoles);
  const setRoleFn = useServerFn(setUserRole);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState<Record<string, AppRole>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn(),
  });

  const mutate = useMutation({
    mutationFn: (vars: { userId: string; role: AppRole; action: "add" | "remove" }) =>
      setRoleFn({ data: vars }),
    onSuccess: () => {
      toast.success("Roles actualizados");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Error al actualizar"),
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (!q.trim()) return list;
    const s = q.toLowerCase();
    return list.filter(
      (u) =>
        u.email.toLowerCase().includes(s) ||
        (u.display_name ?? "").toLowerCase().includes(s),
    );
  }, [data, q]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger />
        <span className="text-sm font-medium">Administración / Usuarios y roles</span>
      </header>

      <main className="flex-1 space-y-6 p-6">
        <PageHeader
          icon={ShieldCheck}
          title="Usuarios y roles"
          description="Asigna o quita roles. Solo administradores pueden modificar esta información."
        />

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por correo o nombre…"
            className="pl-9"
          />
        </div>

        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead className="text-right">Asignar rol</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    Sin usuarios.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => {
                  const available = ROLES.filter((r) => !u.roles.includes(r));
                  const pending = adding[u.id] ?? available[0];
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">{u.display_name ?? u.email.split("@")[0]}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Sin rol</span>
                          ) : (
                            u.roles.map((r) => (
                              <Badge
                                key={r}
                                variant={r === "admin" ? "default" : "secondary"}
                                className="gap-1"
                              >
                                {r}
                                <button
                                  type="button"
                                  className="ml-1 opacity-70 hover:opacity-100"
                                  onClick={() =>
                                    mutate.mutate({ userId: u.id, role: r as AppRole, action: "remove" })
                                  }
                                  disabled={mutate.isPending}
                                  aria-label={`Quitar rol ${r}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.last_sign_in_at
                          ? new Date(u.last_sign_in_at).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {available.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <Select
                              value={pending}
                              onValueChange={(v) =>
                                setAdding((s) => ({ ...s, [u.id]: v as AppRole }))
                              }
                            >
                              <SelectTrigger className="h-8 w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {available.map((r) => (
                                  <SelectItem key={r} value={r}>
                                    {r}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              onClick={() =>
                                mutate.mutate({ userId: u.id, role: pending, action: "add" })
                              }
                              disabled={mutate.isPending}
                            >
                              <Plus className="h-3 w-3" /> Asignar
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
