import { useState, useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { formatRiyadhDateTimeForInput } from "@/utils/dateUtils";
import { invalidateInventoryQueries } from "@/utils/queryKeys";

export function useOpeningSession(
  activeItems,
  selectedBranchId,
  varianceBranchId,
) {
  const queryClient = useQueryClient();
  const [openingModalOpen, setOpeningModalOpen] = useState(false);
  const [openingBranchId, setOpeningBranchId] = useState("");
  const [openingOpenedAt, setOpeningOpenedAt] = useState("");
  const [openingNote, setOpeningNote] = useState("");
  const [openingSearch, setOpeningSearch] = useState("");
  const [openingQtyByItem, setOpeningQtyByItem] = useState({});
  const [openingError, setOpeningError] = useState(null);
  const [openingSuccess, setOpeningSuccess] = useState(null);

  const createOpeningMutation = useMutation({
    mutationFn: async ({ branchId, openedAt, note, items }) => {
      console.log("Opening session payload:", {
        branchId,
        openedAt,
        note,
        itemsCount: items.length,
      });
      const response = await adminFetch("/api/opening-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, openedAt, note, items }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const msg = data?.error || "فشل حفظ المخزون الافتتاحي";
        throw new Error(msg);
      }
      return response.json();
    },
    onSuccess: () => {
      console.log("Opening session saved successfully!");
      setOpeningError(null);
      setOpeningSuccess("تم حفظ المخزون الافتتاحي بنجاح ✅");
      invalidateInventoryQueries(queryClient);
      // Close modal after a brief success message
      setTimeout(() => {
        setOpeningModalOpen(false);
        setOpeningSuccess(null);
      }, 1500);
    },
    onError: (err) => {
      console.error("Opening session error:", err);
      setOpeningSuccess(null);
      setOpeningError(err.message || "فشل حفظ المخزون الافتتاحي");
    },
  });

  const filteredOpeningItems = useMemo(() => {
    const q = openingSearch.trim().toLowerCase();
    // Drop items disabled at the chosen opening branch — the API
    // rejects them now, so hiding the row keeps the form honest.
    const branchIdNum = Number(openingBranchId);
    const byBranch = (it) => {
      if (!Number.isFinite(branchIdNum) || branchIdNum <= 0) return true;
      const disabled = Array.isArray(it?.disabled_branches)
        ? it.disabled_branches.map(Number)
        : [];
      return !disabled.includes(branchIdNum);
    };

    const base = activeItems.filter(byBranch);
    if (!q) return base;
    return base.filter((it) => {
      const name = (it.name || "").toLowerCase();
      const nameEn = (it.name_en || "").toLowerCase();
      return name.includes(q) || nameEn.includes(q);
    });
  }, [activeItems, openingSearch, openingBranchId]);

  const openOpeningModal = useCallback(() => {
    setOpeningError(null);
    setOpeningSuccess(null);
    setOpeningModalOpen(true);
    // Default to current date/time — user can change if needed
    setOpeningOpenedAt(formatRiyadhDateTimeForInput());
    setOpeningNote("");
    setOpeningSearch("");

    const defaultBranch = varianceBranchId || selectedBranchId || "";
    setOpeningBranchId(defaultBranch);

    const initial = {};
    for (const it of activeItems) {
      initial[it.id] = 0;
    }
    setOpeningQtyByItem(initial);
  }, [activeItems, selectedBranchId, varianceBranchId]);

  const submitOpening = useCallback(() => {
    setOpeningError(null);

    if (!openingBranchId) {
      setOpeningError("اختر الفرع أولاً");
      return;
    }

    if (!openingOpenedAt) {
      setOpeningError("اختر تاريخ المخزون الافتتاحي");
      return;
    }

    // Skip items disabled at the chosen branch — server rejects them
    // anyway, no point sending them. Mirrors the filter in
    // `filteredOpeningItems` so payload and UI stay in sync.
    const branchIdNum = Number(openingBranchId);
    const payloadItems = activeItems
      .filter((it) => {
        const disabled = Array.isArray(it?.disabled_branches)
          ? it.disabled_branches.map(Number)
          : [];
        return !disabled.includes(branchIdNum);
      })
      .map((it) => {
        const raw = openingQtyByItem[it.id];
        const qty = Number(raw);
        const safeQty = Number.isFinite(qty) && qty >= 0 ? qty : 0;
        return { itemId: it.id, quantity: safeQty };
      });

    createOpeningMutation.mutate({
      branchId: openingBranchId,
      openedAt: openingOpenedAt,
      note: openingNote,
      items: payloadItems,
    });
  }, [
    activeItems,
    createOpeningMutation,
    openingBranchId,
    openingNote,
    openingOpenedAt,
    openingQtyByItem,
  ]);

  return {
    openingModalOpen,
    setOpeningModalOpen,
    openingBranchId,
    setOpeningBranchId,
    openingOpenedAt,
    setOpeningOpenedAt,
    openingNote,
    setOpeningNote,
    openingSearch,
    setOpeningSearch,
    openingQtyByItem,
    setOpeningQtyByItem,
    openingError,
    openingSuccess,
    filteredOpeningItems,
    openOpeningModal,
    submitOpening,
    createOpeningMutation,
  };
}
