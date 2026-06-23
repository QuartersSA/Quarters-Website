const STOCK_PRECISION = 3;

export function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function roundStockQuantity(value) {
  const factor = 10 ** STOCK_PRECISION;
  return Math.round(finiteNumber(value) * factor) / factor;
}

export function sumStockQuantities(rows) {
  return roundStockQuantity(
    (Array.isArray(rows) ? rows : []).reduce(
      (sum, row) => sum + finiteNumber(row?.quantity),
      0,
    ),
  );
}

export function costPerInventoryUnit(baseCost, conversionFactor = 1) {
  const cost = Number(baseCost);
  const factor = Number(conversionFactor);
  if (!Number.isFinite(cost) || !Number.isFinite(factor) || factor <= 0) {
    return null;
  }
  return cost * factor;
}

export function calculateStockValue(
  inventoryQuantity,
  baseCost,
  conversionFactor = 1,
) {
  const unitCost = costPerInventoryUnit(baseCost, conversionFactor);
  if (unitCost === null) return null;
  return finiteNumber(inventoryQuantity) * unitCost;
}
