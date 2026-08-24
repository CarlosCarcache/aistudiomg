import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Wand2,
  ImagePlus,
  MessageSquare,
  Scissors,
  FolderKanban,
  ArrowRight,
  Users,
  PackageCheck,
  DollarSign,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/views/PageHeader";
import { projectsController } from "@/controllers/projects.controller";
import { clientsController } from "@/controllers/clients.controller";
import { ordersController } from "@/controllers/orders.controller";
import type { Order, Project } from "@/models/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Panel de control | AI Studio MG" },
      {
        name: "description",
        content:
          "Control de proyectos, clientes, entregas y ventas de AI Studio MG en un solo panel.",
      },
      { property: "og:title", content: "Panel de control | AI Studio MG" },
      {
        property: "og:description",
        content: "Métricas de proyectos, clientes, entregas y ventas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const quick = [
  { to: "/generate", icon: ImagePlus, title: "Generar imagen", desc: "Crea desde un prompt" },
  { to: "/vectorize", icon: Wand2, title: "Vectorizar", desc: "Raster → SVG / EPS / PDF" },
  { to: "/editor", icon: Scissors, title: "Editor", desc: "Recorta, quita fondos" },
  { to: "/chat", icon: MessageSquare, title: "Chat IA", desc: "Pide mejoras específicas" },
];

const currency = new Intl.NumberFormat("es-NI", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

interface KpiProps {
  icon: typeof Users;
  label: string;
  value: string;
  hint: string;
  to: string;
  loading: boolean;
}

function KpiCard({ icon: Icon, label, value, hint, to, loading }: KpiProps) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-lg"
    >
      <div className="flex items-start justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </Link>
  );
}

function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clientsCount, setClientsCount] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      projectsController.list(),
      clientsController.list(),
      ordersController.list(),
    ])
      .then(([p, c, o]) => {
        if (!active) return;
        if (p.status === "fulfilled") setProjects(p.value);
        if (c.status === "fulfilled") setClientsCount(c.value.length);
        if (o.status === "fulfilled") setOrders(o.value);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const delivered = orders.filter((o) => o.status === "terminado");
  const inProgress = orders.filter((o) => o.status === "en_proceso");
  const sales = delivered.reduce((sum, o) => sum + Number(o.price ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title={<>Bienvenido a tu <span className="brand-text">estudio</span></>}
        description="Control de proyectos, clientes, entregas y ventas."
      />

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Control general</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={FolderKanban}
            label="Proyectos"
            value={String(projects.length)}
            hint="Diseños guardados"
            to="/projects"
            loading={loading}
          />
          <KpiCard
            icon={Users}
            label="Clientes"
            value={String(clientsCount)}
            hint="Registrados en cartera"
            to="/clients"
            loading={loading}
          />
          <KpiCard
            icon={PackageCheck}
            label="Entregas"
            value={String(delivered.length)}
            hint={`${inProgress.length} en proceso`}
            to="/orders"
            loading={loading}
          />
          <KpiCard
            icon={DollarSign}
            label="Ventas"
            value={currency.format(sales)}
            hint="Pedidos terminados"
            to="/orders"
            loading={loading}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Accesos rápidos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quick.map((q) => (
            <Link
              key={q.to}
              to={q.to}
              className="group rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-lg"
            >
              <div
                className="mb-3 grid h-10 w-10 place-items-center rounded-xl text-primary-foreground"
                style={{ background: "linear-gradient(135deg, var(--brand-pink), var(--brand-purple))" }}
              >
                <q.icon className="h-5 w-5" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{q.title}</div>
                  <div className="text-xs text-muted-foreground">{q.desc}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
