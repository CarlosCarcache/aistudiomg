import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { prompt } = (await request.json()) as { prompt?: string };
          if (!prompt || prompt.trim().length === 0) {
            return new Response(JSON.stringify({ error: "Prompt vacío" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          const key = process.env.LOVABLE_API_KEY;
          if (!key) {
            return new Response(JSON.stringify({ error: "LOVABLE_API_KEY no configurada" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image",
              prompt: prompt.slice(0, 2000),
            }),
          });

          if (!upstream.ok) {
            const text = await upstream.text();
            const status = upstream.status === 429 || upstream.status === 402 ? upstream.status : 500;
            const message =
              upstream.status === 429
                ? "Has excedido el límite de peticiones, intenta más tarde."
                : upstream.status === 402
                  ? "Créditos agotados en Lovable AI. Agrega créditos en Workspace."
                  : "Error generando imagen";
            console.error("AI image error:", upstream.status, text);
            return new Response(JSON.stringify({ error: message }), {
              status,
              headers: { "Content-Type": "application/json" },
            });
          }

          const data = (await upstream.json()) as {
            data?: Array<{ b64_json?: string; url?: string }>;
          };
          const first = data.data?.[0];
          const b64 = first?.b64_json;
          const url = first?.url;
          const image = b64 ? `data:image/png;base64,${b64}` : url;
          if (!image) {
            return new Response(JSON.stringify({ error: "Respuesta sin imagen" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ image }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("generate-image error:", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
