export function BrandLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const logo =
    size === "sm"
      ? { src: "/brand/icon.png", className: "h-7 w-9" }
      : size === "lg"
        ? { src: "/brand/logo-secundario.png", className: "h-28 w-28" }
        : { src: "/brand/logo-primario.png", className: "h-9 w-48" };

  return (
    <div className="flex items-center justify-center gap-2">
      <img src={logo.src} alt="" className={`${logo.className} object-contain`} />
      {size === "sm" && (
        <div className="whitespace-nowrap font-semibold tracking-tight text-base group-data-[collapsible=icon]:hidden">
          <span className="brand-text">AI Studio</span> <span className="text-foreground">MG</span>
        </div>
      )}
    </div>
  );
}
