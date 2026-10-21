import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export const getSharedGallery = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
    if (!url || !key) throw new Error("No se pudo cargar la galería");
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    const { data: images, error } = await client.rpc("get_shared_gallery", { _token: data.token });
    if (error) throw new Error("No se pudo cargar la galería");
    if (!images?.length) return { images: [], urls: {} as Record<string, string> };
    // The RPC has already restricted this capability to its client's images.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const entries = await Promise.all(images.map(async (image) => {
      if (/^https?:/.test(image.image_url)) return [image.id, image.image_url] as const;
      const { data: signed, error: signingError } = await supabaseAdmin.storage.from("gallery").createSignedUrl(image.image_url, 3600);
      if (signingError || !signed) throw new Error("No se pudo mostrar una imagen");
      const signedUrl = new URL(signed.signedUrl);
      const browserOrigin = new URL(import.meta.env.VITE_SUPABASE_URL);
      return [image.id, `${browserOrigin.origin}${signedUrl.pathname}${signedUrl.search}`] as const;
    }));
    return { images, urls: Object.fromEntries(entries) };
  });