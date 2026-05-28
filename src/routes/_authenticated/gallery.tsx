import { createFileRoute } from "@tanstack/react-router";
import { Images } from "lucide-react";
import { PlaceholderPage } from "@/views/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/gallery")({
  component: GalleryPage,
});

function GalleryPage() {
  return (
    <PlaceholderPage
      title="Galería de productos"
      description="Organiza los productos por categoría y genera enlaces seguros para clientes."
      icon={Images}
      features={[
        "Categorías y filtros",
        "Enlace seguro por cliente (sin acceso a la app)",
        "Reutilización de imágenes asignándolas a nuevos clientes",
      ]}
    />
  );
}
