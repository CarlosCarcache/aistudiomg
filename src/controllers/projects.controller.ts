// Controller: proyectos (CRUD sobre la tabla `projects`).
import { supabase } from "@/integrations/supabase/client";
import type { NewProject, Project } from "@/models/types";

export const projectsController = {
  async list(): Promise<Project[]> {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: NewProject): Promise<Project> {
    const { data, error } = await supabase
      .from("projects")
      .insert(input)
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
