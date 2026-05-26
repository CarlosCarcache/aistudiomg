// Controller: autenticación (OTP por email) y sesión.
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/models/types";

export const authController = {
  async sendOtp(email: string) {
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
  },

  async verifyOtp(email: string, token: string) {
    return supabase.auth.verifyOtp({ email, token, type: "email" });
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
