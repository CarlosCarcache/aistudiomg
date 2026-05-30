import { createFileRoute } from "@tanstack/react-router";

type Body = { prompt?: string; images?: string[] };

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { prompt, images } = (await request.json()) as Body;
          if (!prompt || prompt.trim().length === 0) {
            return json({ error: "Prompt vacío" }, 400);
          }
          const key = process.env.LOVABLE_API_KEY;
          if (!key) return json({ error: "LOVABLE_API_KEY no configurada" }, 500);

          // Build content: if images provided, use Gemini multimodal edit shape.
          const hasImages = Array.isArray(images) && images.length > 0;

          const body = hasImages
            ? {
                model: "google/gemini-3.1-flash-image-preview",
                modalities: ["image", "text"],
                messages: [
                  {
                    role: "user",
                    content: [
                      { type: "text", text: prompt.slice(0, 2000) },
                      ...images!.slice(0, 4).map((url) => ({
                        type: "image_url",
                        image_url: { url },
                      })),
                    ],
                  },
                ],
              }
            : {
                model: "google/gemini-2.5-flash-image",
                prompt: prompt.slice(0, 2000),
              };

          const endpoint = hasImages
            ? "https://ai.gateway.lovable.dev/v1/chat/completions"
            : "https://ai.gateway.lovable.dev/v1/images/generations";

          const upstream = await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          if (!upstream.ok) {
            const text = await upstream.text();
            console.error("AI image error:", upstream.status, text);
            const status =
              upstream.status === 429 || upstream.status === 402 ? upstream.status : 500;
            const message =
              upstream.status === 429
                ? "Has excedido el límite de peticiones."
                : upstream.status === 402
                  ? "Créditos agotados en Lovable AI."
                  : "Error generando imagen";
            return json({ error: message }, status);
          }

          const data = (await upstream.json()) as any;
          let image: string | undefined;

          if (hasImages) {
            // Chat completions multimodal response
            const msg = data.choices?.[0]?.message;
            const imgs = msg?.images;
            if (Array.isArray(imgs) && imgs[0]?.image_url?.url) {
              image = imgs[0].image_url.url;
            } else if (typeof msg?.content === "string" && msg.content.startsWith("data:image")) {
              image = msg.content;
            }
          } else {
            const first = data.data?.[0];
            const b64 = first?.b64_json;
            const url = first?.url;
            image = b64 ? `data:image/png;base64,${b64}` : url;
          }

          if (!image) {
            console.error("No image in response:", JSON.stringify(data).slice(0, 500));
            return json({ error: "Respuesta sin imagen" }, 500);
          }
          return json({ image });
        } catch (e) {
          console.error("generate-image error:", e);
          return json({ error: e instanceof Error ? e.message : "Error desconocido" }, 500);
        }
      },
    },
  },
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
