import { useState, useCallback, useEffect, useMemo } from "react";
import { useUpdateOrderItemReceived } from "@/hooks/useGreenBeanOrders";

// Hook keyed by *group* (multiple bags of the same bean+params collapsed
// into one editable row). The input value represents the TOTAL received
// across the group; on save it's distributed equally across each bag's
// DB id via parallel mutations. For single-bag groups behaviour matches
// the previous per-id flow.
export function useReceivedQuantity(orderItems, selectedOrderId, groupedItems) {
  const [rowError, setRowError] = useState(null);
  const [rowSuccess, setRowSuccess] = useState(null);
  // Keyed by groupKey, not item id — matches the table's group rows.
  const [receivedById, setReceivedById] = useState({});

  // Stable group list for the effect below (avoids re-running on every
  // upstream array identity change when only the contents shifted).
  const groups = useMemo(
    () => (Array.isArray(groupedItems) ? groupedItems : []),
    [groupedItems],
  );

  useEffect(() => {
    if (groups.length === 0) return;
    setReceivedById((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (next[g.groupKey] === undefined) {
          // Initial display value = sum of received-after-waste across bags.
          // If nothing was received yet, show empty so the placeholder shows.
          next[g.groupKey] =
            g.totalReceived > 0 ? String(g.totalReceived) : "";
        }
      }
      return next;
    });
  }, [groups]);

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

  const onChangeReceived = useCallback((groupKey, value) => {
    setReceivedById((m) => ({ ...m, [String(groupKey)]: value }));
  }, []);

  const onSaveReceived = useCallback(
    async (groupKey) => {
      if (!selectedOrderId) {
        setRowError("اختر طلب أولاً");
        setRowSuccess(null);
        return;
      }

      const group = groups.find((g) => g.groupKey === groupKey);
      if (!group || !Array.isArray(group.itemIds) || group.itemIds.length === 0) {
        setRowError("تعذّر تحديد الصنف");
        setRowSuccess(null);
        return;
      }

      const raw = receivedById[String(groupKey)];
      const total =
        raw === "" || raw === null || raw === undefined ? null : Number(raw);
      if (total === null || !Number.isFinite(total)) {
        setRowError("اكتب الكمية الواصلة بشكل صحيح");
        setRowSuccess(null);
        return;
      }

      // Distribute the total equally across each bag in the group. For a
      // single-bag group this is exactly the legacy per-id behaviour. For
      // multi-bag groups, the user enters the total they actually received
      // and we split — the underlying DB rows stay one-per-bag.
      const perBag = total / group.itemIds.length;
      try {
        await Promise.all(
          group.itemIds.map((itemId) =>
            updateReceivedMutation.mutateAsync({
              itemId,
              receivedAfterWasteKg: perBag,
              orderId: selectedOrderId,
            }),
          ),
        );
      } catch {
        // onError callback already surfaced the message.
      }
    },
    [receivedById, selectedOrderId, updateReceivedMutation, groups],
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
