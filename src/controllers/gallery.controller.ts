// Controller: galería de imágenes (privada, por cliente y portafolio público).
import { supabase } from "@/integrations/supabase/client";
import type {
  GalleryImage,
  NewGalleryImage,
  UpdateGalleryImage,
} from "@/models/types";

export const galleryController = {
  async list(): Promise<GalleryImage[]> {
    const { data, error } = await supabase
      .from("gallery_images")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listPortfolio(): Promise<GalleryImage[]> {
    const { data, error } = await supabase
      .from("gallery_images")
      .select("*")
      .eq("is_portfolio", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: NewGalleryImage): Promise<GalleryImage> {
    const { data, error } = await supabase
      .from("gallery_images")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, input: UpdateGalleryImage): Promise<GalleryImage> {
    const { data, error } = await supabase
      .from("gallery_images")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string) {
    const { error } = await supabase.from("gallery_images").delete().eq("id", id);
    if (error) throw error;
  },

  // Enlace seguro: lectura pública de las imágenes de un cliente vía token.
  async listShared(token: string): Promise<GalleryImage[]> {
    const { data, error } = await (supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: GalleryImage[] | null; error: unknown }>;
    }).rpc("get_shared_gallery", { _token: token });
    if (error) throw new Error("No se pudo cargar la galería compartida");
    return data ?? [];
  },
};
