import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { authController } from "@/controllers/auth.controller";
import type { AppRole } from "@/models/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);
      if (u) {
        // Diferimos para evitar deadlocks dentro del listener
        setTimeout(() => {
          authController.getRoles(u.id).then(setRoles);
        }, 0);
      } else {
        setRoles([]);
      }
    });

    authController.getSession().then((session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) authController.getRoles(session.user.id).then(setRoles);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, roles, loading };
}
