export type CurrencyCode = "USD" | "NIO";

export const CURRENCIES: { value: CurrencyCode; label: string }[] = [
  { value: "NIO", label: "Córdobas (C$)" },
  { value: "USD", label: "Dólares ($)" },
];

export function formatMoney(amount: number, currency?: string | null): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const fixed = n.toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === "NIO" ? `C$ ${fixed}` : `$ ${fixed}`;
}

export function orderTotal(price: number | string | null | undefined, quantity?: number | null): number {
  return Number(price ?? 0) * Math.max(1, quantity ?? 1);
}
