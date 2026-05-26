import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Wand2,
  ImagePlus,
  MessageSquare,
  Scissors,
  FolderKanban,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/views/PageHeader";
import { EmptyState } from "@/views/EmptyState";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const quick = [
  { to: "/generate", icon: ImagePlus, title: "Generar imagen", desc: "Crea desde un prompt" },
  { to: "/vectorize", icon: Wand2, title: "Vectorizar", desc: "Raster → SVG / EPS / PDF" },
  { to: "/editor", icon: Scissors, title: "Editor", desc: "Recorta, quita fondos" },
  { to: "/chat", icon: MessageSquare, title: "Chat IA", desc: "Pide mejoras específicas" },
];

function Dashboard() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title={<>Bienvenido a tu <span className="brand-text">estudio</span></>}
        description="Empieza con una herramienta o abre un proyecto reciente."
      />

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Accesos rápidos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quick.map((q) => (
            <Link
              key={q.to}
              to={q.to}
              className="group rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-lg"
            >
              <div
                className="mb-3 grid h-10 w-10 place-items-center rounded-xl text-primary-foreground"
                style={{ background: "linear-gradient(135deg, var(--brand-pink), var(--brand-purple))" }}
              >
                <q.icon className="h-5 w-5" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{q.title}</div>
                  <div className="text-xs text-muted-foreground">{q.desc}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <EmptyState
        icon={FolderKanban}
        title="Aún no tienes proyectos"
        description="Cuando guardes diseños aparecerán aquí para reutilizarlos."
      />
    </div>
  );
}
