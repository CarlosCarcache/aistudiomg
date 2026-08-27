// Controller: empleados (CRUD sobre la tabla `employees`).
import { supabase } from "@/integrations/supabase/client";
import type { Employee, NewEmployee, UpdateEmployee } from "@/models/types";

export const employeesController = {
  async list(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: NewEmployee): Promise<Employee> {
    const { data, error } = await supabase
      .from("employees")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, input: UpdateEmployee): Promise<Employee> {
    const { data, error } = await supabase
      .from("employees")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string) {
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) throw error;
  },
};
