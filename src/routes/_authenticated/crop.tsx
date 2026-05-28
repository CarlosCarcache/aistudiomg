import { createFileRoute } from "@tanstack/react-router";
import { Crop } from "lucide-react";
import { PlaceholderPage } from "@/views/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/crop")({
  component: CropPage,
});

function CropPage() {
  return (
    <PlaceholderPage
      title="Recortes"
      description="Recortes manuales y asistidos con segmentación por IA."
      icon={Crop}
      features={[
        "Segmentación de imagen para análisis preciso",
        "Recorte manual con guías",
        "Recorte asistido con IA",
      ]}
    />
  );
}
