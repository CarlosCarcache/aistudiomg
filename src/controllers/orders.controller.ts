// Controller: pedidos (CRUD sobre la tabla `orders`).
import { supabase } from "@/integrations/supabase/client";
import type { NewOrder, Order, OrderStatus } from "@/models/types";

export const ordersController = {
  async list(): Promise<Order[]> {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: NewOrder): Promise<Order> {
    const { data, error } = await supabase
      .from("orders")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async setStatus(id: string, status: OrderStatus): Promise<Order> {
    const { data, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string) {
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) throw error;
  },
};
