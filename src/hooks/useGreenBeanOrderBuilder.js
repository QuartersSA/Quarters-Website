import { useCallback, useMemo, useState } from "react";
import {
  todayISO,
  toNumberOrNullFromInput,
  round2,
} from "@/utils/greenBeanOrderUtils";

const VAT_MULTIPLIER = 1.15;

function toInputString(value) {
  if (value === null || value === undefined) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return String(n);
}

function computeRow(
  {
    priceKgExclTax,
    bagSizeKg,
    roastCostInclTax,
    extraCostPerKg,
    extraCostKg,
    receivedAfterWasteKg,
  },
  qty = 1,
) {
  const price = toNumberOrNullFromInput(priceKgExclTax);
  const bag = toNumberOrNullFromInput(bagSizeKg);
  const roastIncl = toNumberOrNullFromInput(roastCostInclTax);
  const extra = toNumberOrNullFromInput(extraCostPerKg);
  const extraKg = toNumberOrNullFromInput(extraCostKg);
  const received = toNumberOrNullFromInput(receivedAfterWasteKg);

  const effectiveExtraKg = extraKg !== null ? extraKg : bag;

  // حسابات الخيشة الواحدة
  const bagCostExcl =
    price !== null && bag !== null ? round2(price * bag) : NaN;
  const bagCostIncl =
    price !== null && bag !== null ? round2(price * VAT_MULTIPLIER * bag) : NaN;
  const roastTotalIncl =
    roastIncl !== null && bag !== null ? round2(roastIncl * bag) : NaN;
  const extraTotal =
    extra !== null && effectiveExtraKg !== null
      ? round2(extra * effectiveExtraKg)
      : NaN;

  const totalInclPerBag =
    Number.isFinite(bagCostIncl) &&
    Number.isFinite(roastTotalIncl) &&
    Number.isFinite(extraTotal)
      ? round2(bagCostIncl + roastTotalIncl + extraTotal)
      : NaN;

  // الإجمالي لكل الخياش
  const totalIncl = Number.isFinite(totalInclPerBag)
    ? round2(totalInclPerBag * qty)
    : NaN;

  // الوزن الكلي المتوقع (حجم الخيشة × عدد الخياش)
  const totalBagKg = bag !== null ? bag * qty : null;

  // نسبة الهدر مقارنة بالوزن الكلي
  const wastePercent =
    totalBagKg !== null && totalBagKg > 0 && received !== null
      ? Math.min(100, Math.max(0, round2((1 - received / totalBagKg) * 100)))
      : NaN;

  // السعر الصافي للكيلو = إجمالي التكلفة / الواصل
  const finalPricePerKg =
    Number.isFinite(totalIncl) && received !== null && received > 0
      ? round2(totalIncl / received)
      : NaN;

  return {
    bagCostExcl,
    bagCostIncl,
    roastTotalIncl,
    extraTotal,
    totalIncl,
    wastePercent,
    finalPricePerKg,
  };
}

export function useGreenBeanOrderBuilder(beans) {
  const beansById = useMemo(() => {
    const map = new Map();
    if (Array.isArray(beans)) {
      for (const b of beans) {
        map.set(String(b.id), b);
      }
    }
    return map;
  }, [beans]);

  // itemsByBeanId: { [beanId]: { qty, priceKgExclTax, bagSizeKg, ... } }
  const [draft, setDraft] = useState({
    orderDate: todayISO(),
    supplierName: "",
    note: "",
    itemsByBeanId: {},
  });

  const selectedBeanIds = useMemo(
    () => Object.keys(draft.itemsByBeanId),
    [draft.itemsByBeanId],
  );

  const beanQtyMap = useMemo(() => {
    const map = {};
    for (const key of selectedBeanIds) {
      map[key] = draft.itemsByBeanId[key]?.qty || 1;
    }
    return map;
  }, [draft.itemsByBeanId, selectedBeanIds]);

  const resetDraft = useCallback(() => {
    setDraft({
      orderDate: todayISO(),
      supplierName: "",
      note: "",
      itemsByBeanId: {},
    });
  }, []);

  const setOrderField = useCallback((patch) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const _makeDefaultItem = useCallback(
    (beanId) => {
      const bean = beansById.get(String(beanId));
      const price = bean?.price_kg_excl_tax ?? null;
      const bag = bean?.bag_size_kg ?? null;
      const roastIncl = bean?.roast_cost_incl_tax ?? 8.05;
      const extra = bean?.extra_cost_per_kg ?? 0;

      return {
        qty: 1,
        priceKgExclTax: toInputString(price),
        bagSizeKg: toInputString(bag),
        roastCostInclTax: toInputString(roastIncl),
        extraCostPerKg: toInputString(extra),
        extraCostKg: "",
        receivedAfterWasteKg: "",
      };
    },
    [beansById],
  );

  const toggleBean = useCallback(
    (beanId) => {
      const key = String(beanId);
      setDraft((d) => {
        const exists = !!d.itemsByBeanId[key];
        if (exists) {
          const next = { ...d.itemsByBeanId };
          delete next[key];
          return { ...d, itemsByBeanId: next };
        }
        return {
          ...d,
          itemsByBeanId: {
            ...d.itemsByBeanId,
            [key]: _makeDefaultItem(key),
          },
        };
      });
    },
    [_makeDefaultItem],
  );

  const incrementBeanQty = useCallback((beanId) => {
    const key = String(beanId);
    setDraft((d) => {
      const entry = d.itemsByBeanId[key];
      if (!entry) return d;
      return {
        ...d,
        itemsByBeanId: {
          ...d.itemsByBeanId,
          [key]: { ...entry, qty: (entry.qty || 1) + 1 },
        },
      };
    });
  }, []);

  const decrementBeanQty = useCallback((beanId) => {
    const key = String(beanId);
    setDraft((d) => {
      const entry = d.itemsByBeanId[key];
      if (!entry) return d;
      const currentQty = entry.qty || 1;
      if (currentQty <= 1) {
        const next = { ...d.itemsByBeanId };
        delete next[key];
        return { ...d, itemsByBeanId: next };
      }
      return {
        ...d,
        itemsByBeanId: {
          ...d.itemsByBeanId,
          [key]: { ...entry, qty: currentQty - 1 },
        },
      };
    });
  }, []);

  const removeBean = useCallback((beanId) => {
    const key = String(beanId);
    setDraft((d) => {
      if (!d.itemsByBeanId[key]) return d;
      const next = { ...d.itemsByBeanId };
      delete next[key];
      return { ...d, itemsByBeanId: next };
    });
  }, []);

  const loadFromOrder = useCallback((order, items) => {
    if (!order) return;

    // Group backend items by bean_id (each row is one bag)
    const grouped = {};
    for (const it of items || []) {
      const key = String(it.bean_id);
      if (!grouped[key]) {
        grouped[key] = { items: [], count: 0, totalReceived: 0 };
      }
      grouped[key].items.push(it);
      grouped[key].count += 1;
      const recv = Number(it.computed_received_after_waste_kg);
      if (Number.isFinite(recv)) {
        grouped[key].totalReceived += recv;
      }
    }

    const itemsByBeanId = {};
    for (const [beanId, group] of Object.entries(grouped)) {
      const first = group.items[0];
      itemsByBeanId[beanId] = {
        qty: group.count,
        priceKgExclTax: toInputString(first.price_kg_excl_tax),
        bagSizeKg: toInputString(first.bag_size_kg),
        roastCostInclTax: toInputString(first.roast_cost_incl_tax),
        extraCostPerKg: toInputString(first.extra_cost_per_kg),
        extraCostKg:
          first.extra_cost_kg != null ? toInputString(first.extra_cost_kg) : "",
        receivedAfterWasteKg:
          group.totalReceived > 0
            ? toInputString(Math.round(group.totalReceived * 1000) / 1000)
            : "",
      };
    }

    setDraft({
      orderDate: order.order_date
        ? String(order.order_date).slice(0, 10)
        : todayISO(),
      supplierName: order.supplier_name || "",
      note: order.note || "",
      itemsByBeanId,
    });
  }, []);

  const updateItem = useCallback((beanId, patch) => {
    const key = String(beanId);
    setDraft((d) => {
      const prev = d.itemsByBeanId[key];
      if (!prev) return d;
      return {
        ...d,
        itemsByBeanId: {
          ...d.itemsByBeanId,
          [key]: { ...prev, ...patch },
        },
      };
    });
  }, []);

  const previewRows = useMemo(() => {
    const rows = [];
    for (const beanId of selectedBeanIds) {
      const entry = draft.itemsByBeanId[beanId];
      if (!entry) continue;
      const bean = beansById.get(beanId);
      const qty = entry.qty || 1;
      const line = {
        priceKgExclTax: entry.priceKgExclTax,
        bagSizeKg: entry.bagSizeKg,
        roastCostInclTax: entry.roastCostInclTax,
        extraCostPerKg: entry.extraCostPerKg,
        extraCostKg: entry.extraCostKg,
        receivedAfterWasteKg: entry.receivedAfterWasteKg,
      };
      rows.push({
        beanId,
        beanName: bean?.name || "—",
        qty,
        line,
        computed: computeRow(line, qty),
      });
    }
    return rows;
  }, [draft.itemsByBeanId, selectedBeanIds, beansById]);

  const validateAndBuildPayload = useCallback(() => {
    if (!draft.orderDate) {
      return { ok: false, error: "اختر تاريخ الطلب" };
    }

    if (selectedBeanIds.length === 0) {
      return { ok: false, error: "اختر نوع بن واحد على الأقل" };
    }

    const items = [];
    for (const beanId of selectedBeanIds) {
      const entry = draft.itemsByBeanId[beanId];
      if (!entry) continue;
      const qty = entry.qty || 1;
      const price = toNumberOrNullFromInput(entry.priceKgExclTax);
      const bag = toNumberOrNullFromInput(entry.bagSizeKg);
      const roastIncl = toNumberOrNullFromInput(entry.roastCostInclTax);
      const extra = toNumberOrNullFromInput(entry.extraCostPerKg);
      const extraKg = toNumberOrNullFromInput(entry.extraCostKg);
      const received = toNumberOrNullFromInput(entry.receivedAfterWasteKg);

      if (price === null || bag === null) {
        return { ok: false, error: "تأكد من سعر الكيلو وحجم الخيشة" };
      }

      if (received === null) {
        return {
          ok: false,
          error: "اكتب الكمية الواصلة بعد الهدر لكل نوع بن",
        };
      }

      // repeat the same item `qty` times for the backend
      // الواصل المدخل هو إجمالي لكل الخياش — نقسمه على العدد
      const receivedPerBag = received !== null ? received / qty : null;
      for (let i = 0; i < qty; i++) {
        items.push({
          beanId: Number(beanId),
          priceKgExclTax: price,
          bagSizeKg: bag,
          roastCostInclTax: roastIncl === null ? 8.05 : roastIncl,
          extraCostPerKg: extra === null ? 0 : extra,
          extraCostKg: extraKg,
          receivedAfterWasteKg: receivedPerBag,
        });
      }
    }

    return {
      ok: true,
      payload: {
        orderDate: draft.orderDate,
        supplierName: draft.supplierName,
        note: draft.note,
        items,
      },
    };
  }, [draft, selectedBeanIds]);

  return {
    draft,
    selectedBeanIds,
    beanQtyMap,
    previewRows,
    setOrderField,
    toggleBean,
    incrementBeanQty,
    decrementBeanQty,
    removeBean,
    loadFromOrder,
    updateItem,
    resetDraft,
    validateAndBuildPayload,
  };
}
