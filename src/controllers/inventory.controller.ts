import { supabase } from "@/integrations/supabase/client";
import type {
  NewProductRecipe,
  NewSupply,
  ProductRecipe,
  Supply,
  UpdateSupply,
} from "@/models/types";

export const inventoryController = {
  async listSupplies(): Promise<Supply[]> {
    const { data, error } = await supabase
      .from("supplies")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async createSupply(input: NewSupply): Promise<Supply> {
    const { data, error } = await supabase.from("supplies").insert(input).select().single();
    if (error) throw error;
    return data;
  },

  async updateSupply(id: string, input: UpdateSupply): Promise<Supply> {
    const { data, error } = await supabase
      .from("supplies")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async removeSupply(id: string): Promise<void> {
    const { error } = await supabase.from("supplies").delete().eq("id", id);
    if (error) throw error;
  },

  async listRecipes(): Promise<ProductRecipe[]> {
    const { data, error } = await supabase
      .from("product_recipes")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async createRecipe(input: NewProductRecipe): Promise<ProductRecipe> {
    const { data, error } = await supabase.from("product_recipes").insert(input).select().single();
    if (error) throw error;
    return data;
  },

  async updateRecipe(id: string, quantityUsed: number): Promise<ProductRecipe> {
    const { data, error } = await supabase
      .from("product_recipes")
      .update({ quantity_used: quantityUsed })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async removeRecipe(id: string): Promise<void> {
    const { error } = await supabase.from("product_recipes").delete().eq("id", id);
    if (error) throw error;
  },
};
