import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiImageInput } from "./ai-image-input";

export const generateStudioImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => aiImageInput.parse(input))
  .handler(async ({ data }) => {
    const { generateImage, generateChatCompletion, GatewayError } = await import("@lovable.dev/ai-gateway");
    try {
      if (data.images?.length) {
        const result = await generateChatCompletion({
          model: "google/gemini-3.1-flash-image",
          modalities: ["image", "text"],
          messages: [{ role: "user", content: [{ type: "text", text: data.prompt }, ...data.images.slice(0, 4).map((url) => ({ type: "image_url" as const, image_url: { url } }))] }],
        });
        const message = result.choices?.[0]?.message;
        const image = message?.images?.[0]?.image_url.url ?? (message?.content?.startsWith("data:image") ? message.content : undefined);
        if (!image) throw new Error("La IA no devolvió una imagen");
        return { image };
      }
      const result = await generateImage({ model: "google/gemini-2.5-flash-image", prompt: data.prompt });
      const first = result.data?.[0];
      const image = first?.b64_json ? `data:image/png;base64,${first.b64_json}` : first?.url;
      if (!image) throw new Error("La IA no devolvió una imagen");
      return { image };
    } catch (error) {
      if (error instanceof GatewayError) {
        console.error("Image generation failed", error.code, error.httpStatus);
        throw new Error(error.httpStatus === 402 ? "Créditos de IA agotados" : error.httpStatus === 429 ? "La IA está ocupada; espera antes de intentar de nuevo" : "No se pudo generar la imagen; conserva tu descripción e inténtalo más tarde");
      }
      throw error;
    }
  });