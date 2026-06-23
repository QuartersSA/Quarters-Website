export const VAT_RATE = 0.15;

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

export function round4(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return NaN;
  return Math.round(x * 10000) / 10000;
}

export function withVat(excl) {
  const n = Number(excl);
  if (!Number.isFinite(n)) return NaN;
  return round2(n * (1 + VAT_RATE));
}

export function withoutVat(incl) {
  const n = Number(incl);
  if (!Number.isFinite(n)) return NaN;
  return round2(n / (1 + VAT_RATE));
}

export function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return NaN;
  return Math.min(max, Math.max(min, x));
}

export function todayISO() {
  return todayRiyadhDateKey();
}

export function computeGreenBeanMetrics(draft) {
  const price = toNumberOrNullFromInput(draft.priceKgExclTax);
  const bag = toNumberOrNullFromInput(draft.bagSizeKg);

  const roastExcl = toNumberOrNullFromInput(draft.roastCostExclTax);
  const roastIncl = toNumberOrNullFromInput(draft.roastCostInclTax);

  const roastCostPerKgIncl =
    roastIncl !== null
      ? roastIncl
      : roastExcl !== null
        ? withVat(roastExcl)
        : NaN;

  const roastTotalIncl =
    bag !== null && Number.isFinite(roastCostPerKgIncl)
      ? round2(bag * roastCostPerKgIncl)
      : NaN;

  const extraPerKg = toNumberOrNullFromInput(draft.extraCostPerKg);

  const receivedAfterWaste = toNumberOrNullFromInput(draft.receivedKg);

  const bagCostExcl =
    price !== null && bag !== null ? round2(price * bag) : NaN;
  const bagCostIncl = Number.isFinite(bagCostExcl) ? withVat(bagCostExcl) : NaN;

  const extraTotal =
    extraPerKg !== null && bag !== null ? round2(extraPerKg * bag) : NaN;

  const totalIncl =
    Number.isFinite(bagCostIncl) &&
    Number.isFinite(roastTotalIncl) &&
    Number.isFinite(extraTotal)
      ? round2(bagCostIncl + roastTotalIncl + extraTotal)
      : NaN;

  const wastePercentDerived =
    bag !== null && bag > 0 && receivedAfterWaste !== null
      ? clamp((1 - receivedAfterWaste / bag) * 100, 0, 100)
      : NaN;

  const finalPricePerKg =
    Number.isFinite(totalIncl) && receivedAfterWaste !== null
      ? receivedAfterWaste > 0
        ? round2(totalIncl / receivedAfterWaste)
        : NaN
      : NaN;

  return {
    bagCostExcl,
    bagCostIncl,
    roastCostPerKgIncl,
    roastTotalIncl,
    totalIncl,
    wastePercentDerived,
    finalPricePerKg,
  };
}
import { todayRiyadhDateKey } from "./dateUtils.js";
