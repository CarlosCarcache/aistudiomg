import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<string>("viewer");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setName(data?.display_name ?? ""));

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data && data.length > 0) setRole(data.map((r) => r.role).join(", "));
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error("No se pudo guardar", { description: error.message });
    else toast.success("Perfil actualizado");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">Tu perfil y preferencias.</p>
      </div>
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="email">Correo</Label>
          <Input id="email" value={user?.email ?? ""} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Nombre para mostrar</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Rol</Label>
          <div className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs text-secondary-foreground">
            {role}
          </div>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
