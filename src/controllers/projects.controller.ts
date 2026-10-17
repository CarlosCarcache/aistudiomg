// Controller: proyectos (CRUD sobre la tabla `projects`).
import { supabase } from "@/integrations/supabase/client";
import type { Project } from "@/models/types";

export type ProjectInput = { title: string; description?: string | null; thumbnail_url?: string | null };

export const projectsController = {
  async list(): Promise<Project[]> {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: ProjectInput): Promise<Project> {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Debes iniciar sesión");
    const { data, error } = await supabase
      .from("projects")
      .insert({ ...input, user_id: u.user.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, input: ProjectInput): Promise<Project> {
    const { data, error } = await supabase
      .from("projects")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string) {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
  },
};
