// Capa Model — formas del dominio (alineadas a las tablas de la BD).
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type UserRoleRow = Database["public"]["Tables"]["user_roles"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Chat = Database["public"]["Tables"]["chats"]["Row"];
export type ChatMessage = Database["public"]["Tables"]["chat_messages"]["Row"];

export type NewProject = Database["public"]["Tables"]["projects"]["Insert"];
export type NewChat = Database["public"]["Tables"]["chats"]["Insert"];
export type NewChatMessage = Database["public"]["Tables"]["chat_messages"]["Insert"];

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type Employee = Database["public"]["Tables"]["employees"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];

export type NewClient = Database["public"]["Tables"]["clients"]["Insert"];
export type NewEmployee = Database["public"]["Tables"]["employees"]["Insert"];
export type NewOrder = Database["public"]["Tables"]["orders"]["Insert"];

export type UpdateClient = Database["public"]["Tables"]["clients"]["Update"];
export type UpdateEmployee = Database["public"]["Tables"]["employees"]["Update"];

export type ProductCategory =
  Database["public"]["Tables"]["product_categories"]["Row"];
export type NewProductCategory =
  Database["public"]["Tables"]["product_categories"]["Insert"];
export type UpdateProductCategory =
  Database["public"]["Tables"]["product_categories"]["Update"];

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type NewProduct = Database["public"]["Tables"]["products"]["Insert"];
export type UpdateProduct = Database["public"]["Tables"]["products"]["Update"];

export type GalleryImage = Database["public"]["Tables"]["gallery_images"]["Row"];
export type NewGalleryImage =
  Database["public"]["Tables"]["gallery_images"]["Insert"];
export type UpdateGalleryImage =
  Database["public"]["Tables"]["gallery_images"]["Update"];
