import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  MAX_SHARED_QUOTE_IMAGE_SIZE,
  sharedGalleryTokenSchema,
  sharedQuoteSchema,
} from "@/lib/shared-order";

function createPublicClient(url: string, key: string) {
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const getSharedGallery = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ token: sharedGalleryTokenSchema }).parse(input))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
    if (!url || !key) throw new Error("No se pudo cargar la galería");
    const client = createPublicClient(url, key);
    const [galleryResult, clientResult] = await Promise.all([
      client.rpc("get_shared_gallery", { _token: data.token }),
      client.rpc("get_shared_gallery_client", { _token: data.token }),
    ]);
    if (galleryResult.error || clientResult.error) throw new Error("No se pudo cargar la galería");
    const savedClient = clientResult.data?.[0];
    if (!savedClient) throw new Error("El enlace no es válido");
    const images = galleryResult.data ?? [];
    const clientInfo = {
      id: savedClient.client_id,
      firstName: savedClient.first_name,
      lastName: savedClient.last_name,
      email: savedClient.email,
      phone: savedClient.phone,
    };
    if (!images.length) {
      return { images, urls: {} as Record<string, string>, client: clientInfo };
    }

    // La función de base de datos ya limitó el enlace a las imágenes permitidas.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const entries = await Promise.all(
      images.map(async (image) => {
        if (/^https?:/.test(image.image_url)) return [image.id, image.image_url] as const;
        const { data: signed, error: signingError } = await supabaseAdmin.storage
          .from("gallery")
          .createSignedUrl(image.image_url, 3600);
        if (signingError || !signed) throw new Error("No se pudo mostrar una imagen");
        const signedUrl = new URL(signed.signedUrl);
        const browserOrigin = new URL(import.meta.env.VITE_SUPABASE_URL);
        return [
          image.id,
          `${browserOrigin.origin}${signedUrl.pathname}${signedUrl.search}`,
        ] as const;
      }),
    );
    return { images, urls: Object.fromEntries(entries), client: clientInfo };
  });

export const submitSharedQuote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.intersection(sharedQuoteSchema, z.object({ token: sharedGalleryTokenSchema })).parse(input),
  )
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
    if (!url || !key) throw new Error("No se pudo enviar la cotización");
    const client = createPublicClient(url, key);
    const { data: clientRows, error: clientError } = await client.rpc("get_shared_gallery_client", {
      _token: data.token,
    });
    const savedClient = clientRows?.[0];
    if (clientError || !savedClient) throw new Error("El enlace no es válido");

    let imagePath = "";
    let uploaded = false;
    let supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin | null =
      null;

    if (data.imageDataUrl) {
      const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i.exec(data.imageDataUrl);
      const mime = match?.[1]?.toLowerCase();
      const encoded = match?.[2];
      if (!mime || !encoded) throw new Error("La imagen adjunta no es válida");
      const bytes = Buffer.from(encoded, "base64");
      if (bytes.length === 0 || bytes.length > MAX_SHARED_QUOTE_IMAGE_SIZE)
        throw new Error("La imagen no puede superar 5 MB");

      const validSignature =
        mime === "image/jpeg"
          ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
          : mime === "image/png"
            ? bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
            : bytes[0] === 0x52 &&
              bytes[1] === 0x49 &&
              bytes[2] === 0x46 &&
              bytes[3] === 0x46 &&
              bytes[8] === 0x57 &&
              bytes[9] === 0x45 &&
              bytes[10] === 0x42 &&
              bytes[11] === 0x50;
      if (!validSignature) throw new Error("El contenido de la imagen no es válido");

      const extension = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
      imagePath = `quote-uploads/${savedClient.owner_id}/${savedClient.client_id}/${crypto.randomUUID()}.${extension}`;
      ({ supabaseAdmin } = await import("@/integrations/supabase/client.server"));
      const { error: uploadError } = await supabaseAdmin.storage
        .from("gallery")
        .upload(imagePath, bytes, { contentType: mime, upsert: false });
      if (uploadError) throw new Error("No se pudo guardar la imagen");
      uploaded = true;
    }

    const { data: orderId, error } = await client.rpc("create_shared_gallery_quote", {
      _token: data.token,
      _notes: data.notes,
      _image_path: imagePath,
      _image_name: data.imageName,
      _image_ids: data.imageIds,
    });
    if (error || !orderId) {
      if (uploaded && supabaseAdmin)
        await supabaseAdmin.storage.from("gallery").remove([imagePath]);
      throw new Error("No se pudo enviar la cotización");
    }
    return { orderId };
  });
