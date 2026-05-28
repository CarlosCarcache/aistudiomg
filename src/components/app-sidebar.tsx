import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderKanban,
  MessageSquare,
  Wand2,
  Scissors,
  ImagePlus,
  Settings,
  ShieldCheck,
  CircleDot,
  Sparkles,
  Layers,
  Crop,
  GitCompare,
  Images,
  GalleryHorizontalEnd,
  BookOpen,
  Users,
  ClipboardList,
  BadgeCheck,
  DatabaseBackup,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { BrandLogo } from "./brand-logo";
import { useAuth } from "@/hooks/use-auth";

type Item = { title: string; url: string; icon: typeof LayoutDashboard };

const general: Item[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Proyectos", url: "/projects", icon: FolderKanban },
  { title: "Chat con IA", url: "/chat", icon: MessageSquare },
];

const tools: Item[] = [
  { title: "Generar imagen", url: "/generate", icon: ImagePlus },
  { title: "Vectorizar", url: "/vectorize", icon: Wand2 },
  { title: "Editor de imagen", url: "/editor", icon: Scissors },
  { title: "Recortes", url: "/crop", icon: Crop },
  { title: "Fondos", url: "/background", icon: Layers },
  { title: "Semitono (DTF)", url: "/halftone", icon: CircleDot },
  { title: "Mejorar calidad", url: "/quality", icon: Sparkles },
  { title: "Antes / Después", url: "/before-after", icon: GitCompare },
];

const business: Item[] = [
  { title: "Galería", url: "/gallery", icon: Images },
  { title: "Portafolio", url: "/portfolio", icon: GalleryHorizontalEnd },
  { title: "Catálogo", url: "/catalog", icon: BookOpen },
  { title: "Clientes", url: "/clients", icon: Users },
  { title: "Pedidos", url: "/orders", icon: ClipboardList },
  { title: "Empleados", url: "/employees", icon: BadgeCheck },
];

const account: Item[] = [
  { title: "Configuración", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => path === url || path.startsWith(url + "/");
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");

  const renderGroup = (label: string, items: Item[]) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                <Link to={item.url} className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center px-2 py-1">
          <BrandLogo size="sm" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {renderGroup("General", general)}
        {renderGroup("Herramientas IA", tools)}
        {renderGroup("Negocio", business)}
        {renderGroup("Cuenta", account)}

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/admin/users")} tooltip="Usuarios y roles">
                    <Link to="/admin/users" className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Usuarios y roles</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/backups")} tooltip="Copias de seguridad">
                    <Link to="/backups" className="flex items-center gap-2">
                      <DatabaseBackup className="h-4 w-4" />
                      <span>Copias de seguridad</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            Login desactivado temporalmente
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
