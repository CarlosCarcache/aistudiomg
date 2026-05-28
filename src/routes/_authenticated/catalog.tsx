import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { PlaceholderPage } from "@/views/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/catalog")({
  component: CatalogPage,
});

function CatalogPage() {
  return (
    <PlaceholderPage
      title="Catálogo de productos"
      description="Productos conectados con la galería por categoría."
      icon={BookOpen}
    />
  );
}
