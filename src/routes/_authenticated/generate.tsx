import { createFileRoute } from "@tanstack/react-router";
import { ImagePlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/generate")({
  component: GeneratePage,
});

function GeneratePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Generar imagen</h1>
        <p className="text-sm text-muted-foreground">Crea logos, íconos o imanes desde un prompt.</p>
      </div>
      <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/40 py-20 text-center">
        <ImagePlus className="h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Generación con Lovable AI en la siguiente fase.</p>
      </div>
    </div>
  );
}
