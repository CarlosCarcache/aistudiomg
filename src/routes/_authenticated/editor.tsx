import { createFileRoute } from "@tanstack/react-router";
import { Scissors } from "lucide-react";

export const Route = createFileRoute("/_authenticated/editor")({
  component: EditorPage,
});

function EditorPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Editor de imagen</h1>
        <p className="text-sm text-muted-foreground">Recortes, quitar fondos y antes/después.</p>
      </div>
      <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/40 py-20 text-center">
        <Scissors className="h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Editor en la siguiente fase.</p>
      </div>
    </div>
  );
}
