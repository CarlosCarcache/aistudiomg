import { Sparkles } from "lucide-react";

export function BrandLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-12 w-12" : "h-9 w-9";
  const text = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg";
  return (
    <div className="flex items-center gap-2">
      <div
        className={`${dims} grid place-items-center rounded-xl text-primary-foreground`}
        style={{
          background:
            "linear-gradient(135deg, var(--brand-pink), var(--brand-purple))",
        }}
      >
        <Sparkles className="h-4 w-4" />
      </div>
      <div className={`font-semibold tracking-tight ${text}`}>
        <span className="brand-text">AI Studio</span>{" "}
        <span className="text-foreground">MG</span>
      </div>
    </div>
  );
}
