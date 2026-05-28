// View: página placeholder reutilizable para herramientas en desarrollo.
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "./PageHeader";
import { EmptyState } from "./EmptyState";

interface PlaceholderPageProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  features?: string[];
  actions?: ReactNode;
}

export function PlaceholderPage({
  title,
  description,
  icon: Icon,
  emptyTitle = "En construcción",
  emptyDescription = "Esta sección se implementará en la siguiente fase.",
  features,
  actions,
}: PlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={title} description={description} actions={actions} />

      {features && features.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f}
              className="rounded-xl border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground"
            >
              • {f}
            </div>
          ))}
        </div>
      )}

      <EmptyState icon={Icon} title={emptyTitle} description={emptyDescription} />
    </div>
  );
}
