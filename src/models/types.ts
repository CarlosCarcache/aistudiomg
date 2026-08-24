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
