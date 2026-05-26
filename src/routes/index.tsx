import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Wand2,
  ImagePlus,
  MessageSquare,
  Scissors,
  Shield,
  Sparkles,
  FolderKanban,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/")({
  component: Landing,
});

const features = [
  { icon: Wand2, title: "Vectorización", desc: "Convierte imágenes raster en SVG, EPS o PDF listos para imprimir." },
  { icon: ImagePlus, title: "Generación con IA", desc: "Crea logos, íconos e imanes desde un prompt en cualquier formato." },
  { icon: Scissors, title: "Edición avanzada", desc: "Quita fondos, recorta, mejora colores y reconstruye detalles." },
  { icon: MessageSquare, title: "Chat interactivo", desc: "Pide mejoras específicas a la IA mientras iteras tu diseño." },
  { icon: FolderKanban, title: "Proyectos", desc: "Guarda tus diseños y reutilízalos con nuevos clientes." },
  { icon: History, title: "Antes & después", desc: "Compara versiones y consulta tu historial de chats." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <BrandLogo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Iniciar sesión</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/login">Empezar</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="brand-glow pointer-events-none absolute inset-x-0 top-0 h-[420px]" />
          <div className="mx-auto max-w-5xl px-4 pt-20 pb-24 text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Estudio de diseño asistido por IA
            </div>
            <h1 className="text-balance text-5xl font-semibold tracking-tight md:text-6xl">
              Diseña, vectoriza y crea{" "}
              <span className="brand-text">en un solo lugar</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-muted-foreground md:text-lg">
              AI Studio MG combina vectorización, generación con IA, edición de imágenes y chat
              interactivo. Pensado para diseñadores, talleres de impresión y creadores.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link to="/login">
                  Entrar al estudio <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#features">Ver herramientas</a>
              </Button>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 pb-24">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
              >
                <div
                  className="mb-4 grid h-10 w-10 place-items-center rounded-xl text-primary-foreground"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--brand-pink), var(--brand-purple))",
                  }}
                >
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-card/40">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-16 text-center">
            <Shield className="h-8 w-8 text-primary" />
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Acceso seguro con código de verificación
            </h2>
            <p className="max-w-xl text-muted-foreground">
              Cada inicio de sesión usa un código único enviado a tu email. Roles y permisos por
              usuario, datos cifrados en tránsito.
            </p>
            <Button asChild size="lg">
              <Link to="/login">Iniciar sesión</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 text-sm text-muted-foreground">
          <BrandLogo size="sm" />
          <span>© {new Date().getFullYear()} AI Studio MG</span>
        </div>
      </footer>
    </div>
  );
}
