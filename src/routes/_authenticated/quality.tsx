import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { PlaceholderPage } from "@/views/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/quality")({
  component: QualityPage,
});

function QualityPage() {
  return (
    <PlaceholderPage
      title="Mejorar calidad"
      description="Aumento de resolución y reconstrucción de detalles con control manual."
      icon={Sparkles}
      features={[
        "Barra de intensidad manual",
        "Reconstrucción de bordes y color",
        "Antes / después comparativo",
      ]}
    />
  );
}
