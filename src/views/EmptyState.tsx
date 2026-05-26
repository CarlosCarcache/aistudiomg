// View: estado vacío reutilizable.
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <Icon className="h-10 w-10 text-muted-foreground" />
      <h3 className="mt-3 font-medium">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
