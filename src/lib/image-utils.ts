// Utilidades de imagen reutilizadas por todas las herramientas.

export type Format = "png" | "jpeg" | "webp" | "svg";

export async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("No se pudo cargar la imagen"));
    img.src = src;
  });
  return img;
}

export async function convertImage(dataUrl: string, format: Format): Promise<string> {
  const img = await loadImage(dataUrl);
  if (format === "svg") {
    return (
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${img.width}" height="${img.height}" viewBox="0 0 ${img.width} ${img.height}"><image href="${dataUrl}" width="${img.width}" height="${img.height}"/></svg>`,
      )
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  if (format === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL(`image/${format}`, 0.95);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadAs(dataUrl: string, format: Format, basename = "image") {
  const out = await convertImage(dataUrl, format);
  const ext = format === "jpeg" ? "jpg" : format;
  downloadDataUrl(out, `${basename}-${Date.now()}.${ext}`);
}

// Llama al endpoint de generación/edición con IA.
export async function aiImage(prompt: string, images?: string[]): Promise<string> {
  const res = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, images }),
  });
  const data = (await res.json()) as { image?: string; error?: string };
  if (!res.ok || !data.image) throw new Error(data.error ?? "Error con la IA");
  return data.image;
}
