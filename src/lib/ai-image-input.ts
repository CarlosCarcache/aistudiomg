import { z } from "zod";

export const aiImageInput = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, "Escribe una descripción")
    .transform((v) => v.slice(0, 2000)),
  images: z
    .array(
      z
        .string()
        .refine(
          (value) =>
            /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ||
            /^https:\/\//.test(value),
          "Imagen no válida",
        ),
    )
    .optional(),
});
