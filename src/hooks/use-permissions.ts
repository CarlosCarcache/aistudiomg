// Permisos CRUD por módulo, definidos por el administrador en "Usuarios y roles".
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type PermAction = "create" | "read" | "update" | "delete";

const LABEL: Record<PermAction, string> = {
  create: "crear",
  read: "ver",
  update: "editar",
  delete: "borrar",
};

export function usePermissions(module: string) {
  const { data } = useQuery({
    queryKey: ["my-permissions", module],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: admin }, { data: perm }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle(),
        supabase
          .from("user_permissions")
          .select("can_create, can_read, can_update, can_delete")
          .eq("user_id", u.user.id)
          .eq("module", module)
          .maybeSingle(),
      ]);
      return { isAdmin: !!admin, perm };
    },
  });

  const can = (action: PermAction) => {
    if (!data) return true; // mientras carga
    if (data.isAdmin || !data.perm) return true; // sin restricciones definidas
    return data.perm[`can_${action}` as const];
  };

  const guard = (action: PermAction) => {
    if (can(action)) return true;
    toast.error(`No tienes permiso para ${LABEL[action]} en este módulo`);
    return false;
  };

  return { can, guard };
}
