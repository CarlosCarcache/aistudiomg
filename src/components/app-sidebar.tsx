import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderKanban,
  MessageSquare,
  Wand2,
  Scissors,
  ImagePlus,
  Settings,
  LogOut,
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
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";

const tools = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Proyectos", url: "/projects", icon: FolderKanban },
  { title: "Chat con IA", url: "/chat", icon: MessageSquare },
  { title: "Generar imagen", url: "/generate", icon: ImagePlus },
  { title: "Vectorizar", url: "/vectorize", icon: Wand2 },
  { title: "Editor de imagen", url: "/editor", icon: Scissors },
];

const account = [
  { title: "Configuración", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => path === url || path.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center px-2 py-1">
          {collapsed ? <BrandLogo size="sm" /> : <BrandLogo size="sm" />}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Herramientas</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {tools.map((item) => (
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

        <SidebarGroup>
          <SidebarGroupLabel>Cuenta</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {account.map((item) => (
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
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2"
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Cerrar sesión</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
