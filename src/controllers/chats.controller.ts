// Controller: chats y mensajes con la IA.
import { supabase } from "@/integrations/supabase/client";
import type { Chat, ChatMessage, NewChat, NewChatMessage } from "@/models/types";

export const chatsController = {
  async listChats(): Promise<Chat[]> {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async createChat(input: NewChat): Promise<Chat> {
    const { data, error } = await supabase
      .from("chats")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listMessages(chatId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async addMessage(input: NewChatMessage): Promise<ChatMessage> {
    const { data, error } = await supabase
      .from("chat_messages")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
