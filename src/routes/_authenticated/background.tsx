import { createFileRoute } from "@tanstack/react-router";
import { Layers } from "lucide-react";
import { PlaceholderPage } from "@/views/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/background")({
  component: BackgroundPage,
});

function BackgroundPage() {
  return (
    <PlaceholderPage
      title="Fondos y detalles"
      description="Quitar fondo, agregar fondos o detalles vectorizados e íconos."
      icon={Layers}
      features={[
        "Eliminación automática de fondo",
        "Fondos generados o cargados",
        "Inserción de íconos / vectores",
      ]}
    />
  );
}
