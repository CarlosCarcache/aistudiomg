// Ruta pública: galería compartida por enlace seguro (solo lectura).
import { createFileRoute } from "@tanstack/react-router";
import { Images } from "lucide-react";

export const Route = createFileRoute("/g/$token")({
  component: PublicGalleryPage,
});

function PublicGalleryPage() {
  const { token } = Route.useParams();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold">Galería del cliente</h1>
        <p className="text-xs text-muted-foreground">
          Enlace seguro · token <code className="font-mono">{token.slice(0, 8)}…</code>
        </p>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/40 py-20 text-center">
          <Images className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Aquí se mostrarán las imágenes de la categoría compartida.
          </p>
        </div>
      </main>
    </div>
  );
}
