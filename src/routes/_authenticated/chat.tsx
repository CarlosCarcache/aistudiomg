import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

function ChatPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Chat con IA</h1>
        <p className="text-sm text-muted-foreground">Pide mejoras específicas sobre tus diseños.</p>
      </div>
      <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/40 py-20 text-center">
        <MessageSquare className="h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Chat interactivo en la siguiente fase.</p>
      </div>
    </div>
  );
}
