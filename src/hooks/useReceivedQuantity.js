import { useState, useCallback, useEffect } from "react";
import { useUpdateOrderItemReceived } from "@/hooks/useGreenBeanOrders";

export function useReceivedQuantity(orderItems, selectedOrderId) {
  const [rowError, setRowError] = useState(null);
  const [rowSuccess, setRowSuccess] = useState(null);
  const [receivedById, setReceivedById] = useState({});

  useEffect(() => {
    if (!Array.isArray(orderItems)) return;
    setReceivedById((prev) => {
      const next = { ...prev };
      for (const it of orderItems) {
        const id = String(it.id);
        if (next[id] === undefined) {
          next[id] =
            it.computed_received_after_waste_kg === null ||
            it.computed_received_after_waste_kg === undefined
              ? ""
              : String(it.computed_received_after_waste_kg);
        }
      }
      return next;
    });
  }, [orderItems]);

  const updateReceivedMutation = useUpdateOrderItemReceived(
    () => {
      setRowSuccess("تم تعديل الكمية الواصلة.");
      setRowError(null);
    },
    (e) => {
      console.error(e);
      setRowSuccess(null);
      setRowError(e?.message || "فشل تعديل الكمية الواصلة");
    },
  );

  const onChangeReceived = useCallback((itemId, value) => {
    setReceivedById((m) => ({ ...m, [String(itemId)]: value }));
  }, []);

  const onSaveReceived = useCallback(
    (itemId) => {
      if (!selectedOrderId) {
        setRowError("اختر طلب أولاً");
        setRowSuccess(null);
        return;
      }

      const raw = receivedById[String(itemId)];
      const n =
        raw === "" || raw === null || raw === undefined ? null : Number(raw);
      if (n === null || !Number.isFinite(n)) {
        setRowError("اكتب الكمية الواصلة بشكل صحيح");
        setRowSuccess(null);
        return;
      }

      updateReceivedMutation.mutate({
        itemId,
        receivedAfterWasteKg: n,
        orderId: selectedOrderId,
      });
    },
    [receivedById, selectedOrderId, updateReceivedMutation],
  );

  return {
    rowError,
    rowSuccess,
    receivedById,
    onChangeReceived,
    onSaveReceived,
    isRowSaving: updateReceivedMutation.isPending,
  };
}
