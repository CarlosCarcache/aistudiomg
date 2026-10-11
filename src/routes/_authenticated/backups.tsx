import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DatabaseBackup, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/views/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/backups")({
  component: BackupsPage,
  head: () => ({
    meta: [
      { title: "Copias de seguridad | AI Studio MG" },
      {
        name: "description",
        content: "Descarga respaldos de tus datos en formato JSON.",
      },
      { property: "og:title", content: "Copias de seguridad | AI Studio MG" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const TABLES = [
  { key: "clients", label: "Clientes" },
  { key: "employees", label: "Empleados" },
  { key: "orders", label: "Pedidos" },
  { key: "products", label: "Productos" },
  { key: "product_categories", label: "Categorías" },
  { key: "projects", label: "Proyectos" },
  { key: "gallery_images", label: "Galería" },
] as const;

type TableKey = (typeof TABLES)[number]["key"];

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function BackupsPage() {
  const [busy, setBusy] = useState<string | null>(null);

  const exportTable = async (key: TableKey, label: string) => {
    setBusy(key);
    try {
      const { data, error } = await supabase.from(key).select("*");
      if (error) throw error;
      downloadJson(`respaldo-${key}-${new Date().toISOString().slice(0, 10)}.json`, data);
      toast.success(`Respaldo de ${label} descargado`);
    } catch {
      toast.error(`No se pudo respaldar ${label}`);
    } finally {
      setBusy(null);
    }
  };

  const exportAll = async () => {
    setBusy("all");
    try {
      const backup: Record<string, unknown> = {
        fecha: new Date().toISOString(),
      };
      for (const t of TABLES) {
        const { data, error } = await supabase.from(t.key).select("*");
        if (error) throw error;
        backup[t.key] = data;
      }
      downloadJson(
        `respaldo-completo-${new Date().toISOString().slice(0, 10)}.json`,
        backup,
      );
      toast.success("Respaldo completo descargado");
    } catch {
      toast.error("No se pudo generar el respaldo completo");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Copias de seguridad"
        description="Descarga tus datos en formato JSON para guardarlos fuera de la aplicación."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DatabaseBackup className="h-4 w-4" /> Respaldo completo
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button onClick={exportAll} disabled={busy !== null}>
            {busy === "all" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Descargar todo (JSON)
          </Button>
          <p className="text-sm text-muted-foreground">
            Incluye clientes, empleados, pedidos, productos, categorías,
            proyectos y galería en un solo archivo.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Respaldos por módulo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TABLES.map((t) => (
            <div
              key={t.key}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <span className="text-sm font-medium">{t.label}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportTable(t.key, t.label)}
                disabled={busy !== null}
              >
                {busy === t.key ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Descargar
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Nota: los archivos de imagen no se incluyen en el JSON; el respaldo
        guarda los datos y las referencias de cada imagen.
      </p>
    </div>
  );
}
