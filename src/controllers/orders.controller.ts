// Controller: pedidos (CRUD sobre la tabla `orders`).
import { supabase } from "@/integrations/supabase/client";
import type { NewOrder, Order, OrderStatus, UpdateOrder } from "@/models/types";

export const ordersController = {
  async list(): Promise<Order[]> {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .or("quote_status.is.null,quote_status.eq.aceptada")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listByClient(clientId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("client_id", clientId)
      .or("quote_status.is.null,quote_status.eq.aceptada")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listQuotes(): Promise<Order[]> {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .not("quote_status", "is", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async sendQuote(id: string, price: number, currency: string): Promise<Order> {
    const { data, error } = await supabase
      .from("orders")
      .update({ quote_status: "enviada", price, currency })
      .eq("id", id)
      .eq("quote_status", "solicitada")
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async denyQuote(id: string): Promise<Order> {
    const { data, error } = await supabase
      .from("orders")
      .update({ quote_status: "denegada" })
      .eq("id", id)
      .eq("quote_status", "solicitada")
      .select()
      .single();
    if (error) throw error;
    return data;
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

  async update(id: string, input: UpdateOrder): Promise<Order> {
    const { data, error } = await supabase
      .from("orders")
      .update(input)
      .eq("id", id)
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

  async setEmployee(id: string, employeeId: string | null): Promise<Order> {
    const { data, error } = await supabase
      .from("orders")
      .update({ employee_id: employeeId })
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
