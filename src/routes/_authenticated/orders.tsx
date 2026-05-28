import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { PlaceholderPage } from "@/views/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/orders")({
  component: OrdersPage,
});

function OrdersPage() {
  return (
    <PlaceholderPage
      title="Pedidos e historial"
      description="Pedidos realizados con fecha y empleado responsable."
      icon={ClipboardList}
    />
  );
}
