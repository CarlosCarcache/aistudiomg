// Controller: autenticación (usuario + contraseña) y sesión.
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/models/types";

// El usuario escribe un nombre de usuario; internamente se convierte en un
// correo interno estable para la autenticación.
export function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@app.local`;
}

export const authController = {
  async signIn(username: string, password: string) {
    return supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
  },

  async signOut() {
    return supabase.auth.signOut();
  },

  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  async getRoles(userId: string): Promise<AppRole[]> {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error) return [];
    return (data ?? []).map((r) => r.role);
  },
};
