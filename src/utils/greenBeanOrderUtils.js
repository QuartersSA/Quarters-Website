const VAT_RATE = 0.15;

export function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ar-SA-u-nu-latn", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ar-SA-u-nu-latn", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

export function toNumberOrNullFromInput(raw) {
  if (raw === "" || raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return NaN;
  return Math.round(x * 100) / 100;
}

export function withVat(excl) {
  const n = Number(excl);
  if (!Number.isFinite(n)) return NaN;
  return round2(n * (1 + VAT_RATE));
}

// Groups order items that share identical params (bean + price + waste +
// extra + bag size + roast cost) into a single row labelled with the bag
// count. Items with diverging params for the same bean stay separate so
// we never hide real variations. Used by both the screen table and the
// Excel/PDF exports so the two stay in sync.
export function groupOrderItems(items) {
  if (!Array.isArray(items)) return [];
  const groups = new Map();
  for (const it of items) {
    const key = [
      it.bean_id ?? "_",
      it.price_kg_excl_tax ?? "_",
      it.waste_percent ?? "_",
      it.extra_cost_kg ?? "_",
      it.bag_size_kg ?? "_",
      it.roast_cost_incl_tax ?? "_",
    ].join("|");
    if (groups.has(key)) {
      const g = groups.get(key);
      g.itemIds.push(it.id);
      g.totalReceived += Number(it.computed_received_after_waste_kg) || 0;
      g.totalCostIncl += Number(it.computed_total_incl) || 0;
      g.bagCount += 1;
    } else {
      groups.set(key, {
        groupKey: key,
        firstItem: it,
        itemIds: [it.id],
        totalReceived: Number(it.computed_received_after_waste_kg) || 0,
        totalCostIncl: Number(it.computed_total_incl) || 0,
        bagCount: 1,
      });
    }
  }
  return Array.from(groups.values());
}

export function todayISO() {
  try {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return "";
  }
}

export function computeLine(line) {
  const price = toNumberOrNullFromInput(line.priceKgExclTax);
  const bag = toNumberOrNullFromInput(line.bagSizeKg);
  const roastInclPerKg = toNumberOrNullFromInput(line.roastCostInclTax);
  const extraPerKg = toNumberOrNullFromInput(line.extraCostPerKg);
  const wastePercent = toNumberOrNullFromInput(line.wastePercent);

  const bagCostExcl =
    price !== null && bag !== null ? round2(price * bag) : NaN;
  const bagCostIncl = Number.isFinite(bagCostExcl) ? withVat(bagCostExcl) : NaN;

  const roastTotalIncl =
    roastInclPerKg !== null && bag !== null
      ? round2(roastInclPerKg * bag)
      : NaN;

  const extraTotal =
    extraPerKg !== null && bag !== null ? round2(extraPerKg * bag) : NaN;

  const totalIncl =
    Number.isFinite(bagCostIncl) &&
    Number.isFinite(roastTotalIncl) &&
    Number.isFinite(extraTotal)
      ? round2(bagCostIncl + roastTotalIncl + extraTotal)
      : NaN;

  const wastePct = wastePercent === null ? NaN : Number(wastePercent);
  const receivedAfterWaste =
    bag !== null && Number.isFinite(wastePct)
      ? bag * (1 - wastePct / 100)
      : NaN;

  const finalPricePerKg =
    Number.isFinite(totalIncl) && receivedAfterWaste > 0
      ? round2(totalIncl / receivedAfterWaste)
      : NaN;

  return {
    totalIncl,
    receivedAfterWaste,
    finalPricePerKg,
  };
}
