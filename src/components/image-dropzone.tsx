// Dropzone reutilizable: arrastra/suelta o haz click para cargar imágenes.
import { useCallback } from "react";
import { useDropzone, type Accept } from "react-dropzone";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type DroppedFile = { file: File; dataUrl: string };

interface ImageDropzoneProps {
  onFiles: (files: DroppedFile[]) => void;
  multiple?: boolean;
  className?: string;
  hint?: string;
  preview?: string | null;
  onClear?: () => void;
  accept?: Accept;
}

const DEFAULT_ACCEPT: Accept = {
  "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"],
};

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("No se pudo leer el archivo"));
    r.readAsDataURL(file);
  });
}

export function ImageDropzone({
  onFiles,
  multiple = false,
  className,
  hint = "Arrastra una imagen aquí o haz click para seleccionar",
  preview,
  onClear,
  accept = DEFAULT_ACCEPT,
}: ImageDropzoneProps) {
  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length) return;
      const items = await Promise.all(
        accepted.map(async (f) => ({ file: f, dataUrl: await fileToDataUrl(f) })),
      );
      onFiles(items);
    },
    [onFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple,
    accept,
  });

  if (preview) {
    return (
      <div className={cn("relative overflow-hidden rounded-xl border border-border bg-card", className)}>
        <img src={preview} alt="preview" className="max-h-[420px] w-full object-contain" />
        {onClear && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute right-2 top-2 h-8 w-8"
            onClick={onClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "grid cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border bg-card/40 p-8 text-center transition-colors hover:border-primary/60",
        isDragActive && "border-primary bg-primary/5",
        className,
      )}
    >
      <input {...getInputProps()} />
      <Upload className="h-8 w-8 text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
      <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, WEBP</p>
    </div>
  );
}
