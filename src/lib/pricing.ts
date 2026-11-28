export const MINIMUM_PROFIT_MARGIN = 0.45;

export function suggestedVolumeDiscount(quantity: number): number {
  if (quantity >= 24) return 10;
  if (quantity >= 12) return 5;
  return 0;
}

export function calculateSuggestedPricing(
  unitCost: number,
  quantity: number,
  manualDiscountPct: number | null,
) {
  const cost = Number.isFinite(unitCost) ? Math.max(0, unitCost) : 0;
  const count = Number.isFinite(quantity) ? Math.max(1, quantity) : 1;
  const baseUnitPrice = cost / (1 - MINIMUM_PROFIT_MARGIN);
  const discountPct = manualDiscountPct ?? suggestedVolumeDiscount(count);
  const boundedDiscount = Math.min(100, Math.max(0, discountPct));
  const unitPrice = baseUnitPrice * (1 - boundedDiscount / 100);
  const marginPct = unitPrice > 0 ? ((unitPrice - cost) / unitPrice) * 100 : 0;

  return {
    baseUnitPrice,
    baseDozenPrice: baseUnitPrice * 12,
    discountPct: boundedDiscount,
    unitPrice,
    dozenPrice: unitPrice * 12,
    quantityTotal: unitPrice * count,
    marginPct,
    belowMinimum: cost > 0 && marginPct < MINIMUM_PROFIT_MARGIN * 100,
  };
}
