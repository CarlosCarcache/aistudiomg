// Controller: clientes (CRUD sobre la tabla `clients`).
import { supabase } from "@/integrations/supabase/client";
import type { Client, NewClient, UpdateClient } from "@/models/types";

export const clientsController = {
  async list(): Promise<Client[]> {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: NewClient): Promise<Client> {
    const { data, error } = await supabase
      .from("clients")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, input: UpdateClient): Promise<Client> {
    const { data, error } = await supabase
      .from("clients")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string) {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) throw error;
  },
};
