import { createFileRoute } from "@tanstack/react-router";
import { GalleryHorizontalEnd } from "lucide-react";
import { PlaceholderPage } from "@/views/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/portfolio")({
  component: PortfolioPage,
});

function PortfolioPage() {
  return (
    <PlaceholderPage
      title="Portafolio"
      description="Galería pública de imágenes almacenadas en la base de datos."
      icon={GalleryHorizontalEnd}
    />
  );
}
