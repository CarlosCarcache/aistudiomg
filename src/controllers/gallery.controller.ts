// Controller: galería de imágenes (privada, por cliente y portafolio público).
import { supabase } from "@/integrations/supabase/client";
import type {
  GalleryImage,
  GalleryShare,
  NewGalleryImage,
  UpdateGalleryImage,
} from "@/models/types";

const BUCKET = "gallery";
const YEAR = 60 * 60 * 24 * 365;

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

  // Sube un archivo al almacén privado y devuelve la ruta guardada.
  async upload(userId: string, file: File): Promise<string> {
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw error;
    return path;
  },

  // Convierte una ruta del almacén en una URL visible (las URLs externas pasan igual).
  async resolveUrl(value: string): Promise<string> {
    if (/^(https?:|data:|blob:)/.test(value)) return value;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(value, YEAR);
    if (error || !data) return "";
    return data.signedUrl;
  },

  async resolveMany(images: GalleryImage[]): Promise<Record<string, string>> {
    const entries = await Promise.all(
      images.map(async (img) => [img.id, await this.resolveUrl(img.image_url)] as const),
    );
    return Object.fromEntries(entries);
  },

  // Enlaces seguros por cliente.
  async listShares(): Promise<GalleryShare[]> {
    const { data, error } = await supabase
      .from("gallery_shares")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async createShare(userId: string, clientId: string): Promise<GalleryShare> {
    const { data, error } = await supabase
      .from("gallery_shares")
      .insert({ user_id: userId, client_id: clientId })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async removeShare(id: string) {
    const { error } = await supabase.from("gallery_shares").delete().eq("id", id);
    if (error) throw error;
  },

  // Enlace seguro: lectura pública de las imágenes de un cliente vía token.
  async listShared(token: string): Promise<GalleryImage[]> {
    const { data, error } = await supabase.rpc("get_shared_gallery", {
      _token: token,
    });
    if (error) throw new Error("No se pudo cargar la galería compartida");
    return data ?? [];
  },
};
