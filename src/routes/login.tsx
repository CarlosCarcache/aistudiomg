import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { authController } from "@/controllers/auth.controller";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Iniciar sesión | AI Studio MG" },
      {
        name: "description",
        content:
          "Accede a AI Studio MG con tu usuario y contraseña para gestionar diseños, pedidos y galería.",
      },
      { property: "og:title", content: "Iniciar sesión | AI Studio MG" },
      {
        property: "og:description",
        content: "Acceso al estudio de diseño asistido por IA de AI Studio MG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authController.getSession().then((session) => {
      if (session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    const { error } = await authController.signIn(username, password);
    setLoading(false);
    if (error) {
      console.error("[login] error:", error);
      toast.error("No pudimos iniciar sesión", {
        description: "Revisa tu usuario y contraseña.",
      });
      return;
    }
    toast.success("Bienvenido a AI Studio MG");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="brand-glow pointer-events-none absolute inset-x-0 top-0 h-[420px]" />

      <header className="relative z-10 flex items-center justify-between px-4 py-3">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-72px)] max-w-md flex-col justify-center px-4 pb-12">
        <div className="mb-6 flex justify-center"><BrandLogo size="lg" /></div>

        <div className="rounded-2xl border border-border bg-card/80 p-6 backdrop-blur brand-ring">
          <div className="mb-5 text-center">
            <h1 className="text-xl font-semibold tracking-tight">Iniciar sesión</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ingresa con tu usuario y contraseña.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  required
                  placeholder="user password"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Acceso restringido. Solicita tus credenciales al administrador.
        </p>
      </main>
    </div>
  );
}
