import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { authController } from "@/controllers/auth.controller";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authController.getSession().then((session) => {
      if (session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await authController.sendOtp(email.trim());
    setLoading(false);
    if (error) {
      console.error("[login] OTP send error:", error);
      toast.error("No pudimos enviar el código", { description: "Verifica tu correo e intenta de nuevo." });
      return;
    }
    toast.success("Código enviado", {
      description: `Revisa ${email} y escribe el código de 6 dígitos.`,
    });
    setStep("code");
  };

  const verify = async (value: string) => {
    setLoading(true);
    const { error } = await authController.verifyOtp(email.trim(), value);
    setLoading(false);
    if (error) {
      toast.error("Código incorrecto", { description: error.message });
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
          {step === "email" ? (
            <>
              <div className="mb-5 text-center">
                <h1 className="text-xl font-semibold tracking-tight">Iniciar sesión</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Te enviaremos un código de 6 dígitos a tu correo.
                </p>
              </div>
              <form onSubmit={requestCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      required
                      placeholder="tu@correo.com"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar código"}
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-5 text-center">
                <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h1 className="text-xl font-semibold tracking-tight">Código de verificación</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Escribe el código que enviamos a <span className="text-foreground">{email}</span>
                </p>
              </div>
              <div className="flex flex-col items-center gap-4">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={(v) => {
                    setCode(v);
                    if (v.length === 6) verify(v);
                  }}
                >
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>

                <Button
                  variant="link"
                  size="sm"
                  type="button"
                  onClick={() => { setStep("email"); setCode(""); }}
                  disabled={loading}
                >
                  Usar otro correo
                </Button>
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Al continuar aceptas el uso seguro de tu correo para autenticación.
        </p>
      </main>
    </div>
  );
}
