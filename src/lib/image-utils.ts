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

export async function canvasToDpiBlob(
  canvas: HTMLCanvasElement,
  mime: "image/png" | "image/jpeg",
  dpi: number,
  quality?: number,
): Promise<Blob> {
  if (!Number.isFinite(dpi) || dpi <= 0) throw new Error("Los DPI deben ser mayores que cero");
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("No se pudo codificar la imagen"))),
      mime,
      quality,
    );
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const taggedBytes = mime === "image/png" ? setPngDpi(bytes, dpi) : setJpegDpi(bytes, dpi);
  const output = new Uint8Array(taggedBytes.byteLength);
  output.set(taggedBytes);
  return new Blob([output.buffer], { type: mime });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setPngDpi(bytes: Uint8Array, dpi: number): Uint8Array {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 33 || !signature.every((value, index) => bytes[index] === value)) {
    throw new Error("El archivo PNG exportado no tiene un encabezado válido");
  }

  const pixelsPerMeter = Math.round(dpi / 0.0254);
  const physChunk = new Uint8Array(21);
  const physView = new DataView(physChunk.buffer);
  physView.setUint32(0, 9);
  physChunk.set([112, 72, 89, 115], 4);
  physView.setUint32(8, pixelsPerMeter);
  physView.setUint32(12, pixelsPerMeter);
  physChunk[16] = 1;
  physView.setUint32(17, crc32(physChunk.subarray(4, 17)));

  const chunks: Uint8Array[] = [bytes.subarray(0, 8)];
  let offset = 8;
  let replacedPhys = false;
  while (offset + 12 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error("El archivo PNG exportado está incompleto");
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type === "pHYs") {
      if (!replacedPhys) chunks.push(physChunk);
      replacedPhys = true;
    } else {
      chunks.push(bytes.subarray(offset, end));
      if (type === "IHDR" && !replacedPhys) {
        chunks.push(physChunk);
        replacedPhys = true;
      }
    }
    offset = end;
  }
  if (offset !== bytes.length || !replacedPhys) {
    throw new Error("No se pudo actualizar la resolución del PNG");
  }

  const output = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let outputOffset = 0;
  for (const chunk of chunks) {
    output.set(chunk, outputOffset);
    outputOffset += chunk.length;
  }
  return output;
}

function setJpegDpi(bytes: Uint8Array, dpi: number): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("El archivo JPG exportado no tiene un encabezado válido");
  }
  const density = Math.min(65_535, Math.round(dpi));
  const segment = new Uint8Array([
    0xff,
    0xe0,
    0,
    16,
    0x4a,
    0x46,
    0x49,
    0x46,
    0,
    1,
    1,
    1,
    density >> 8,
    density & 0xff,
    density >> 8,
    density & 0xff,
    0,
    0,
  ]);

  let offset = 2;
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.length) {
      throw new Error("El archivo JPG exportado está incompleto");
    }
    if (
      marker === 0xe0 &&
      bytes[offset + 4] === 0x4a &&
      bytes[offset + 5] === 0x46 &&
      bytes[offset + 6] === 0x49 &&
      bytes[offset + 7] === 0x46 &&
      bytes[offset + 8] === 0
    ) {
      const output = bytes.slice();
      output[offset + 11] = 1;
      output[offset + 12] = density >> 8;
      output[offset + 13] = density & 0xff;
      output[offset + 14] = density >> 8;
      output[offset + 15] = density & 0xff;
      return output;
    }
    offset = end;
  }

  const output = new Uint8Array(bytes.length + segment.length);
  output.set(bytes.subarray(0, 2));
  output.set(segment, 2);
  output.set(bytes.subarray(2), 2 + segment.length);
  return output;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
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
