import { createFileRoute } from "@tanstack/react-router";
import { Wand2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vectorize")({
  component: VectorizePage,
});

function VectorizePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vectorizar</h1>
        <p className="text-sm text-muted-foreground">Convierte raster en SVG, EPS o PDF.</p>
      </div>
      <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/40 py-20 text-center">
        <Wand2 className="h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Vectorización en navegador en la siguiente fase.</p>
      </div>
    </div>
  );
}
