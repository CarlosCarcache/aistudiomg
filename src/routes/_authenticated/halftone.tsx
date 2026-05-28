import { createFileRoute } from "@tanstack/react-router";
import { CircleDot } from "lucide-react";
import { PlaceholderPage } from "@/views/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/halftone")({
  component: HalftonePage,
});

function HalftonePage() {
  return (
    <PlaceholderPage
      title="Semitono (Halftone)"
      description="Edición DTF con IA: resolución, ángulo, tamaño y color del semitono."
      icon={CircleDot}
      features={[
        "Resoluciones: 300, 400, 500, 600, 700, 800 DPI (DTF)",
        "Quitar fondo y vectorizar en un clic",
        "Selector de color con barra y entrada RGB",
        "Control de ángulo y tamaño del punto",
        "Chat IA para pedir mejoras puntuales",
        "Descarga: PNG, SVG, DTF, vector, WEB",
      ]}
    />
  );
}
