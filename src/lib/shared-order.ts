import { z } from "zod";

export const sharedOrderSchema = z.object({
  name: z.string().trim().min(1, "Escribe tu nombre").max(100),
  phone: z.string().trim().max(40),
  notes: z.string().trim().max(1000),
  imageIds: z.array(z.string().uuid()).min(1, "Selecciona al menos una imagen").max(100).refine((ids) => new Set(ids).size === ids.length),
});

export function sharedImageTotal(images: { price: number | null }[]) {
  return images.reduce((sum, image) => sum + (image.price ?? 0), 0);
}