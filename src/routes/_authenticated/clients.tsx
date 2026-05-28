import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { PlaceholderPage } from "@/views/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsPage,
});

function ClientsPage() {
  return (
    <PlaceholderPage
      title="Clientes"
      description="Gestión de clientes: id, nombre, apellido, método de pago e historial."
      icon={Users}
      features={[
        "Búsqueda y reutilización de diseños",
        "Historial de pedidos por cliente",
        "Vínculo con galería y portafolio",
      ]}
    />
  );
}
