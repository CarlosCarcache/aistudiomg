import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardCopy, FileCheck2, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { PageHeader } from "@/views/PageHeader";
import { EmptyState } from "@/views/EmptyState";
import { ordersController } from "@/controllers/orders.controller";
import { clientsController } from "@/controllers/clients.controller";
import { galleryController } from "@/controllers/gallery.controller";
import type { Client, GalleryShare, Order, QuoteStatus } from "@/models/types";
import { CURRENCIES, formatMoney, orderTotal, type CurrencyCode } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/quotes")({
  component: QuotesPage,
  head: () => ({ meta: [{ title: "Cotizaciones | AI Studio MG" }] }),
});

type QuoteTab = "solicitadas" | "esperando" | "cerradas";

const quoteLabel = (status: QuoteStatus) => {
  switch (status) {
    case "solicitada":
      return "Nueva solicitud";
    case "enviada":
      return "Esperando al cliente";
    case "aceptada":
      return "Aceptada";
    case "denegada":
      return "Solicitud denegada";
    case "rechazada":
      return "Precio rechazado";
  }
};

function QuotesPage() {
  const perm = usePermissions("quotes");
  const [quotes, setQuotes] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [shares, setShares] = useState<GalleryShare[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [currencies, setCurrencies] = useState<Record<string, CurrencyCode>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    ordersController
      .listQuotes()
      .then(setQuotes)
      .catch(() => toast.error("No se pudieron cargar las cotizaciones"))
      .finally(() => setLoading(false));
    clientsController
      .list()
      .then(setClients)
      .catch(() => {});
    galleryController
      .listShares()
      .then(setShares)
      .catch(() => {});
  }, []);

  const groups = useMemo(
    () => ({
      solicitadas: quotes.filter((quote) => quote.quote_status === "solicitada"),
      esperando: quotes.filter((quote) => quote.quote_status === "enviada"),
      cerradas: quotes.filter((quote) =>
        ["aceptada", "denegada", "rechazada"].includes(quote.quote_status ?? ""),
      ),
    }),
    [quotes],
  );

  const clientName = (id: string | null) => {
    const client = clients.find((item) => item.id === id);
    return client
      ? [client.first_name, client.last_name].filter(Boolean).join(" ") || client.email || "Cliente"
      : "Cliente";
  };

  const updateQuote = async (quote: Order, send: boolean) => {
    if (!perm.guard("update")) return;
    setSavingId(quote.id);
    try {
      const updated = send
        ? await ordersController.sendQuote(
            quote.id,
            Number(prices[quote.id]),
            currencies[quote.id] ?? "NIO",
          )
        : await ordersController.denyQuote(quote.id);
      setQuotes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(send ? "Cotización publicada en el enlace del cliente" : "Solicitud denegada");
    } catch {
      toast.error("No se pudo actualizar la cotización");
    } finally {
      setSavingId(null);
    }
  };

  const copyClientLink = async (quote: Order) => {
    const share = shares.find((item) => item.id === quote.quote_share_id);
    if (!share) {
      toast.error("No se encontró el enlace de este cliente");
      return;
    }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/g/${share.token}`);
      toast.success("Enlace del cliente copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  const renderQuotes = (items: Order[]) => {
    if (loading) {
      return (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando cotizaciones...
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <EmptyState
          icon={FileCheck2}
          title="Sin cotizaciones"
          description="Las solicitudes de los clientes aparecerán aquí."
        />
      );
    }
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((quote) => {
          const isRequested = quote.quote_status === "solicitada";
          const isSaving = savingId === quote.id;
          const currency = currencies[quote.id] ?? "NIO";
          const amount = prices[quote.id] ?? "";
          return (
            <Card key={quote.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{quote.title}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {clientName(quote.client_id)}
                    </p>
                  </div>
                  {quote.quote_status && (
                    <Badge variant={quote.quote_status === "aceptada" ? "default" : "secondary"}>
                      {quoteLabel(quote.quote_status)}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {quote.description && (
                  <p className="text-sm text-muted-foreground">{quote.description}</p>
                )}
                {quote.notes && (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{quote.notes}</p>
                )}
                {isRequested ? (
                  <>
                    <div className="flex gap-2">
                      <select
                        aria-label="Moneda de la cotización"
                        className="h-9 w-28 rounded-md border border-input bg-background px-2 text-sm"
                        value={currency}
                        onChange={(event) =>
                          setCurrencies((current) => ({
                            ...current,
                            [quote.id]: event.target.value as CurrencyCode,
                          }))
                        }
                      >
                        {CURRENCIES.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.value}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={(event) =>
                          setPrices((current) => ({ ...current, [quote.id]: event.target.value }))
                        }
                        placeholder="Precio total"
                        aria-label="Precio total de la cotización"
                      />
                    </div>
                    {amount !== "" && Number.isFinite(Number(amount)) && Number(amount) >= 0 && (
                      <p className="text-right text-sm font-medium">
                        Total: {formatMoney(orderTotal(amount, 1), currency)}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={
                          isSaving ||
                          amount === "" ||
                          !Number.isFinite(Number(amount)) ||
                          Number(amount) < 0
                        }
                        onClick={() => void updateQuote(quote, true)}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Aceptar y enviar precio
                      </Button>
                      <Button
                        variant="outline"
                        disabled={isSaving}
                        onClick={() => void updateQuote(quote, false)}
                      >
                        <X className="h-4 w-4" /> Denegar
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    {quote.price != null && (
                      <span className="font-semibold">
                        {formatMoney(orderTotal(quote.price, quote.quantity), quote.currency)}
                      </span>
                    )}
                    {quote.quote_status === "aceptada" && (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Check className="h-4 w-4" /> Pedido en proceso
                      </span>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => void copyClientLink(quote)}
                      aria-label="Copiar enlace del cliente"
                      title="Copiar enlace del cliente"
                    >
                      <ClipboardCopy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Recibida: {new Date(quote.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cotizaciones"
        description="Revisa solicitudes, define el precio y da seguimiento a la respuesta del cliente."
      />
      <Tabs defaultValue="solicitadas">
        <TabsList>
          <TabsTrigger value="solicitadas">Solicitadas ({groups.solicitadas.length})</TabsTrigger>
          <TabsTrigger value="esperando">
            Esperando respuesta ({groups.esperando.length})
          </TabsTrigger>
          <TabsTrigger value="cerradas">Cerradas ({groups.cerradas.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="solicitadas" className="mt-4">
          {renderQuotes(groups.solicitadas)}
        </TabsContent>
        <TabsContent value="esperando" className="mt-4">
          {renderQuotes(groups.esperando)}
        </TabsContent>
        <TabsContent value="cerradas" className="mt-4">
          {renderQuotes(groups.cerradas)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
