import { createFileRoute } from "@tanstack/react-router";
import { FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/projects")({
  component: Projects,
});

function Projects() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
          <p className="text-sm text-muted-foreground">Gestiona y reutiliza tus diseños guardados.</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Nuevo proyecto</Button>
      </div>
      <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/40 py-20 text-center">
        <FolderKanban className="h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Disponible en la siguiente fase.</p>
      </div>
    </div>
  );
}
