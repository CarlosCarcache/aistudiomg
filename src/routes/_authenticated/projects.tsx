import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FolderKanban, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/views/PageHeader";
import { EmptyState } from "@/views/EmptyState";
import { projectsController } from "@/controllers/projects.controller";
import type { Project } from "@/models/types";

export const Route = createFileRoute("/_authenticated/projects")({
  component: Projects,
});

function Projects() {
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projectsController
      .list()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Proyectos"
        description="Gestiona y reutiliza tus diseños guardados."
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Nuevo proyecto
          </Button>
        }
      />

      {loading ? (
        <div className="grid place-items-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Aún no tienes proyectos"
          description="Crea tu primer proyecto para empezar a guardar diseños y reutilizarlos."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="font-medium">{p.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {new Date(p.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
