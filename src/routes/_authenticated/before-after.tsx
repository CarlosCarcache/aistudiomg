import { createFileRoute } from "@tanstack/react-router";
import { GitCompare } from "lucide-react";
import { PlaceholderPage } from "@/views/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/before-after")({
  component: BeforeAfterPage,
});

function BeforeAfterPage() {
  return (
    <PlaceholderPage
      title="Antes y después"
      description="Comparativa interactiva de versiones de una misma imagen."
      icon={GitCompare}
    />
  );
}
