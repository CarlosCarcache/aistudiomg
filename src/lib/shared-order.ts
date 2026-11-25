import { z } from "zod";

export const MAX_SHARED_QUOTE_IMAGE_SIZE = 5 * 1024 * 1024;

export const sharedGalleryTokenSchema = z
  .string()
  .regex(
    /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i,
    "Enlace no válido",
  );

const sharedImageIdsSchema = z.array(z.string().uuid()).max(100);
const uniqueImageIds = (ids: string[]) => new Set(ids).size === ids.length;

export const sharedOrderSchema = z.object({
  name: z.string().trim().min(1, "Escribe tu nombre").max(100),
  phone: z.string().trim().max(40),
  notes: z.string().trim().max(1000),
  imageIds: sharedImageIdsSchema
    .min(1, "Selecciona al menos una imagen")
    .refine(uniqueImageIds, "No repitas las imágenes seleccionadas"),
});

export const sharedQuoteSchema = z
  .object({
    notes: z.string().trim().max(1000, "Las notas no pueden superar 1000 caracteres"),
    imageName: z.string().trim().max(160),
    imageDataUrl: z.union([
      z.literal(""),
      z
        .string()
        .max(7_000_000, "La imagen no puede superar 5 MB")
        .regex(/^data:image\/(?:jpeg|png|webp);base64,/i, "Usa una imagen JPG, PNG o WEBP"),
    ]),
    imageIds: sharedImageIdsSchema.refine(uniqueImageIds, "No repitas las imágenes seleccionadas"),
  })
  .refine((input) => input.imageDataUrl !== "" || input.imageIds.length > 0, {
    message: "Adjunta una imagen o selecciona una imagen compartida",
    path: ["imageDataUrl"],
  });

export function sharedImageTotal(images: { price: number | null }[]) {
  return images.reduce((sum, image) => sum + (image.price ?? 0), 0);
}
