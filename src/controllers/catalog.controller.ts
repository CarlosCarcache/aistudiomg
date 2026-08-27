// Controller: catálogo (categorías y productos).
import { supabase } from "@/integrations/supabase/client";
import type {
  NewProduct,
  NewProductCategory,
  Product,
  ProductCategory,
  UpdateProduct,
  UpdateProductCategory,
} from "@/models/types";

export const catalogController = {
  async listCategories(): Promise<ProductCategory[]> {
    const { data, error } = await supabase
      .from("product_categories")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async createCategory(input: NewProductCategory): Promise<ProductCategory> {
    const { data, error } = await supabase
      .from("product_categories")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateCategory(
    id: string,
    input: UpdateProductCategory,
  ): Promise<ProductCategory> {
    const { data, error } = await supabase
      .from("product_categories")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async removeCategory(id: string) {
    const { error } = await supabase
      .from("product_categories")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async listProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async createProduct(input: NewProduct): Promise<Product> {
    const { data, error } = await supabase
      .from("products")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateProduct(id: string, input: UpdateProduct): Promise<Product> {
    const { data, error } = await supabase
      .from("products")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async removeProduct(id: string) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
  },
};
