const VAT_MULTIPLIER = 1.15;

export function computeOrderTotals(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  let totalBags = 0;
  let totalKg = 0;
  let totalReceivedKg = 0;
  let totalBeanCostIncl = 0;
  let totalRoastIncl = 0;
  let totalExtra = 0;
  let totalGrand = 0;

  for (const it of items) {
    totalBags += 1;

    const bag = Number(it.bag_size_kg);
    const price = Number(it.price_kg_excl_tax);
    const roastIncl = Number(it.roast_cost_incl_tax);
    const extraPerKg = Number(it.extra_cost_per_kg);
    const extraKg = it.extra_cost_kg != null ? Number(it.extra_cost_kg) : null;
    const received = Number(it.computed_received_after_waste_kg);
    const itemTotal = Number(it.computed_total_incl);

    if (Number.isFinite(bag) && bag > 0) {
      totalKg += bag;
    }

    if (Number.isFinite(received) && received > 0) {
      totalReceivedKg += received;
    }

    if (
      Number.isFinite(price) &&
      Number.isFinite(bag) &&
      price > 0 &&
      bag > 0
    ) {
      totalBeanCostIncl += price * VAT_MULTIPLIER * bag;
    }

    if (
      Number.isFinite(roastIncl) &&
      Number.isFinite(bag) &&
      roastIncl > 0 &&
      bag > 0
    ) {
      totalRoastIncl += roastIncl * bag;
    }

    if (Number.isFinite(extraPerKg) && extraPerKg > 0) {
      const effectiveExtraKg =
        extraKg !== null && Number.isFinite(extraKg) ? extraKg : bag;
      if (Number.isFinite(effectiveExtraKg)) {
        totalExtra += extraPerKg * effectiveExtraKg;
      }
    }

    if (Number.isFinite(itemTotal)) {
      totalGrand += itemTotal;
    }
  }

  const wasteKg = totalKg - totalReceivedKg;
  const wastePercent = totalKg > 0 ? (wasteKg / totalKg) * 100 : 0;
  const avgPricePerKg = totalReceivedKg > 0 ? totalGrand / totalReceivedKg : 0;

  return {
    totalBags: Math.round(totalBags),
    totalKg: Math.round(totalKg * 1000) / 1000,
    totalReceivedKg: Math.round(totalReceivedKg * 1000) / 1000,
    wasteKg: Math.round(wasteKg * 1000) / 1000,
    wastePercent: Math.round(wastePercent * 100) / 100,
    totalBeanCostIncl: Math.round(totalBeanCostIncl * 100) / 100,
    totalRoastIncl: Math.round(totalRoastIncl * 100) / 100,
    totalExtra: Math.round(totalExtra * 100) / 100,
    totalGrand: Math.round(totalGrand * 100) / 100,
    avgPricePerKg: Math.round(avgPricePerKg * 100) / 100,
    beanTypesCount: new Set(items.map((i) => String(i.bean_id))).size,
  };
}
