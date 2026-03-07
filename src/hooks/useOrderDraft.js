import { useState, useCallback, useMemo } from "react";
import {
  todayISO,
  computeLine,
  toNumberOrNullFromInput,
} from "@/utils/greenBeanOrderUtils";

export function useOrderDraft() {
  const [orderDraft, setOrderDraft] = useState({
    orderDate: todayISO(),
    supplierName: "",
    note: "",
    items: [
      {
        beanId: "",
        priceKgExclTax: "",
        bagSizeKg: "",
        roastCostInclTax: "8.05",
        extraCostPerKg: "0",
        wastePercent: "0",
      },
    ],
  });

  const resetDraft = useCallback(() => {
    setOrderDraft({
      orderDate: todayISO(),
      supplierName: "",
      note: "",
      items: [
        {
          beanId: "",
          priceKgExclTax: "",
          bagSizeKg: "",
          roastCostInclTax: "8.05",
          extraCostPerKg: "0",
          wastePercent: "0",
        },
      ],
    });
  }, []);

  const addLine = useCallback(() => {
    setOrderDraft((d) => ({
      ...d,
      items: [
        ...d.items,
        {
          beanId: "",
          priceKgExclTax: "",
          bagSizeKg: "",
          roastCostInclTax: "8.05",
          extraCostPerKg: "0",
          wastePercent: "0",
        },
      ],
    }));
  }, []);

  const removeLine = useCallback((idx) => {
    setOrderDraft((d) => ({
      ...d,
      items: d.items.filter((_, i) => i !== idx),
    }));
  }, []);

  const updateLine = useCallback((idx, patch) => {
    setOrderDraft((d) => ({
      ...d,
      items: d.items.map((line, i) =>
        i === idx ? { ...line, ...patch } : line,
      ),
    }));
  }, []);

  const createPreviewRows = useMemo(() => {
    return orderDraft.items.map((line, idx) => {
      const computed = computeLine(line);
      return { idx, line, computed };
    });
  }, [orderDraft.items]);

  const buildPayload = useCallback(() => {
    const payloadItems = orderDraft.items
      .map((line) => ({
        beanId: Number(line.beanId),
        priceKgExclTax: toNumberOrNullFromInput(line.priceKgExclTax),
        bagSizeKg: toNumberOrNullFromInput(line.bagSizeKg),
        roastCostInclTax: toNumberOrNullFromInput(line.roastCostInclTax),
        extraCostPerKg: toNumberOrNullFromInput(line.extraCostPerKg),
        wastePercent: toNumberOrNullFromInput(line.wastePercent),
      }))
      .filter((x) => Number.isFinite(x.beanId) && x.beanId > 0);

    return {
      orderDate: orderDraft.orderDate,
      supplierName: orderDraft.supplierName,
      note: orderDraft.note,
      items: payloadItems,
    };
  }, [orderDraft]);

  const validateDraft = useCallback(() => {
    const payload = buildPayload();

    if (!orderDraft.orderDate) {
      return { valid: false, error: "اختر تاريخ الطلب" };
    }

    if (payload.items.length === 0) {
      return { valid: false, error: "أضف نوع بن واحد على الأقل" };
    }

    for (const it of payload.items) {
      if (it.priceKgExclTax === null || it.bagSizeKg === null) {
        return { valid: false, error: "تأكد من سعر الكيلو وحجم الخيشة" };
      }
    }

    return { valid: true, payload };
  }, [orderDraft, buildPayload]);

  return {
    orderDraft,
    setOrderDraft,
    resetDraft,
    addLine,
    removeLine,
    updateLine,
    createPreviewRows,
    validateDraft,
  };
}
