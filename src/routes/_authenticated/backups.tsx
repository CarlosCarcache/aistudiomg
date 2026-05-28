import { createFileRoute } from "@tanstack/react-router";
import { DatabaseBackup } from "lucide-react";
import { PlaceholderPage } from "@/views/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/backups")({
  component: BackupsPage,
});

function BackupsPage() {
  return (
    <PlaceholderPage
      title="Copias de seguridad"
      description="Respaldo cifrado de base de datos y archivos del sistema."
      icon={DatabaseBackup}
      features={[
        "Respaldos programados",
        "Cifrado con claves únicas",
        "Restauración guiada",
      ]}
    />
  );
}
