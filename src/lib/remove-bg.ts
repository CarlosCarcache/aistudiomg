// Quita el fondo en el navegador y refina el borde para que quede fino y limpio.
import { loadImage } from "@/lib/image-utils";

/**
 * Ajusta el canal alfa: elimina el halo semitransparente y conserva un
 * antialias de ~1px para bordes suaves pero nítidos.
 */
export function refineAlpha(data: Uint8ClampedArray, low = 40, high = 215) {
  const range = high - low;
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i];
    if (a <= low) {
      data[i] = 0;
      data[i - 3] = 0;
      data[i - 2] = 0;
      data[i - 1] = 0;
    } else if (a >= high) {
      data[i] = 255;
    } else {
      data[i] = Math.round(((a - low) / range) * 255);
    }
  }
}

export async function removeBackgroundClean(src: string): Promise<string> {
  const { removeBackground } = await import("@imgly/background-removal");
  const blob = await removeBackground(src, { output: { format: "image/png", quality: 1 } });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, c.width, c.height);
    refineAlpha(imageData.data);
    ctx.putImageData(imageData, 0, 0);
    return c.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
