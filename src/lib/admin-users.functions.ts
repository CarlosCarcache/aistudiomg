// Server functions: gestión de roles de usuarios (solo admin).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ROLES = ["admin", "editor", "viewer"] as const;

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("No se pudo verificar permisos");
  if (!data) throw new Error("Solo administradores pueden realizar esta acción");
}

export const listUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const { data: authList, error: authErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (authErr) throw new Error("No se pudo cargar usuarios");

    const ids = authList.users.map((u) => u.id);
    const [{ data: roles }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
      supabaseAdmin.from("profiles").select("id, display_name").in("id", ids),
    ]);

    const rolesByUser = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role);
      rolesByUser.set(r.user_id, list);
    });
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

    return authList.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      display_name: nameById.get(u.id) ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      roles: rolesByUser.get(u.id) ?? [],
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      role: z.enum(ROLES),
      action: z.enum(["add", "remove"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    // Evita que un admin se quite a sí mismo el último rol admin
    if (data.action === "remove" && data.role === "admin" && data.userId === context.userId) {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) throw new Error("No puedes quitar el último administrador");
    }

    if (data.action === "add") {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error("No se pudo asignar el rol");
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error("No se pudo quitar el rol");
    }

    return { ok: true };
  });

export const MODULES = ["projects", "orders", "clients", "employees", "catalog", "gallery", "portfolio"] as const;

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/),
      password: z.string().min(8).max(72),
      role: z.enum(ROLES),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const email = `${data.username.toLowerCase()}@app.local`;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.username },
    });
    if (error || !created.user) throw new Error("No se pudo crear el usuario (¿ya existe?)");
    if (data.role !== "viewer") {
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: created.user.id, role: data.role },
        { onConflict: "user_id,role" },
      );
    }
    return { id: created.user.id };
  });

export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(8).max(72) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error("No se pudo cambiar la contraseña");
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("No puedes eliminarte a ti mismo");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error("No se pudo eliminar el usuario");
    return { ok: true };
  });

export const getUserPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("user_permissions")
      .select("module, can_create, can_read, can_update, can_delete")
      .eq("user_id", data.userId);
    if (error) throw new Error("No se pudieron cargar permisos");
    return rows ?? [];
  });

const permSchema = z.object({
  module: z.enum(MODULES),
  can_create: z.boolean(),
  can_read: z.boolean(),
  can_update: z.boolean(),
  can_delete: z.boolean(),
});

export const saveUserPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), permissions: z.array(permSchema) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const rows = data.permissions.map((p) => ({ ...p, user_id: data.userId }));
    const { error } = await supabaseAdmin
      .from("user_permissions")
      .upsert(rows, { onConflict: "user_id,module" });
    if (error) throw new Error("No se pudieron guardar permisos");
    return { ok: true };
  });
