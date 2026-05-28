import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";
import { PlaceholderPage } from "@/views/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/employees")({
  component: EmployeesPage,
});

function EmployeesPage() {
  return (
    <PlaceholderPage
      title="Empleados"
      description="Personal autorizado para operar el sistema."
      icon={BadgeCheck}
    />
  );
}
