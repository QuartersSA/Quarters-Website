import { useState, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";

function nowLocalDatetime() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function usePurchaseReceipt(
  selectedBranchId,
  selectedItemId,
  varianceBranchId,
  varianceItemId,
) {
  const queryClient = useQueryClient();
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptBranchId, setReceiptBranchId] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [receiptNote, setReceiptNote] = useState("");
  const [receiptError, setReceiptError] = useState(null);

  // ── Multi-item state ──
  const [receiptItems, setReceiptItems] = useState([]);
  const [receiptItemId, setReceiptItemId] = useState("");
  const [receiptQty, setReceiptQty] = useState("");

  // ── Edit mode ──
  const [editingOperation, setEditingOperation] = useState(null);

  // Fetch all items for name lookup
  const { data: allItemsRaw = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const res = await adminFetch("/api/items");
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
  });

  // Fetch items-summary for stock quantities per branch
  const { data: itemsSummaryRaw = [] } = useQuery({
    queryKey: ["items-summary"],
    queryFn: async () => {
      const res = await adminFetch("/api/items/summary");
      if (!res.ok) throw new Error("Failed to fetch items summary");
      return res.json();
    },
    enabled: receiptModalOpen,
  });

  // Map: "branchId-itemId" → current_quantity
  const stockByBranchItem = useMemo(() => {
    const map = new Map();
    const list = Array.isArray(itemsSummaryRaw) ? itemsSummaryRaw : [];
    for (const row of list) {
      const key = `${row.branch_id}-${row.id}`;
      const qty = Number(row.current_quantity) || 0;
      map.set(key, qty);
    }
    return map;
  }, [itemsSummaryRaw]);

  const itemNameMap = useMemo(() => {
    const map = new Map();
    const list = Array.isArray(allItemsRaw) ? allItemsRaw : [];
    for (const it of list) {
      map.set(Number(it.id), it.name || "");
    }
    return map;
  }, [allItemsRaw]);

  const addReceiptItem = useCallback(() => {
    setReceiptError(null);

    const itemId = parseInt(receiptItemId);
    const qty = Number(receiptQty);

    if (!itemId || Number.isNaN(itemId)) {
      setReceiptError("اختر الصنف");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setReceiptError("الكمية يجب أن تكون رقم أكبر من صفر");
      return;
    }

    setReceiptItems((prev) => {
      const existsIdx = prev.findIndex((x) => x.itemId === itemId);
      if (existsIdx >= 0) {
        const copy = prev.slice();
        copy[existsIdx] = {
          ...copy[existsIdx],
          quantity: copy[existsIdx].quantity + qty,
        };
        return copy;
      }
      return [
        ...prev,
        {
          itemId,
          itemName: itemNameMap.get(itemId) || `صنف #${itemId}`,
          quantity: qty,
        },
      ];
    });

    setReceiptItemId("");
    setReceiptQty("");
  }, [receiptItemId, receiptQty, itemNameMap]);

  const removeReceiptItem = useCallback((itemId) => {
    setReceiptItems((prev) => prev.filter((x) => x.itemId !== itemId));
  }, []);

  // ── Multi-item mutation (create) ──
  const createReceiptMutation = useMutation({
    mutationFn: async ({ branchId, receivedAt, note, items }) => {
      const response = await adminFetch("/api/purchase-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, receivedAt, note, items }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "فشل حفظ الوارد");
      }
      return response.json();
    },
    onSuccess: () => {
      setReceiptError(null);
      setReceiptModalOpen(false);
      setReceiptItems([]);
      setReceiptQty("");
      setReceiptNote("");
      setReceiptItemId("");
      setEditingOperation(null);
      queryClient.invalidateQueries({ queryKey: ["variance"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-operations"] });
      queryClient.invalidateQueries({ queryKey: ["items-summary"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
    },
    onError: (err) => {
      console.error(err);
      setReceiptError(err.message || "فشل حفظ الوارد");
    },
  });

  // ── Update (edit) mutation ──
  const updateReceiptMutation = useMutation({
    mutationFn: async ({ operationId, branchId, receivedAt, note, items }) => {
      const response = await adminFetch("/api/purchase-receipts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId,
          branchId,
          receivedAt,
          note,
          items,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "فشل تعديل الوارد");
      }
      return response.json();
    },
    onSuccess: () => {
      setReceiptError(null);
      setReceiptModalOpen(false);
      setReceiptItems([]);
      setReceiptQty("");
      setReceiptNote("");
      setReceiptItemId("");
      setEditingOperation(null);
      queryClient.invalidateQueries({ queryKey: ["variance"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-operations"] });
      queryClient.invalidateQueries({ queryKey: ["items-summary"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["operation-details"] });
    },
    onError: (err) => {
      console.error(err);
      setReceiptError(err.message || "فشل تعديل الوارد");
    },
  });

  const openReceiptModal = useCallback(() => {
    setReceiptError(null);
    setEditingOperation(null);
    setReceiptModalOpen(true);

    const defaultBranch = varianceBranchId || selectedBranchId || "";
    setReceiptBranchId(defaultBranch);
    // Default to current date/time — user can change if needed
    setReceiptDate(nowLocalDatetime());
    setReceiptItemId(varianceItemId || selectedItemId || "");
    setReceiptQty("");
    setReceiptNote("");
    setReceiptItems([]);
  }, [selectedBranchId, selectedItemId, varianceBranchId, varianceItemId]);

  const openEditReceiptModal = useCallback(
    (operation, operationDetailsData) => {
      setReceiptError(null);
      setEditingOperation(operation);
      setReceiptModalOpen(true);
      setReceiptBranchId(String(operation.branch_id || ""));
      setReceiptNote(operation.note || "");

      // Set date+time from received_at or created_at
      const dateStr = operation.received_at || operation.created_at || "";
      if (dateStr) {
        const d = new Date(dateStr);
        if (!Number.isNaN(d.getTime())) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const hh = String(d.getHours()).padStart(2, "0");
          const min = String(d.getMinutes()).padStart(2, "0");
          setReceiptDate(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
        } else {
          setReceiptDate("");
        }
      } else {
        setReceiptDate("");
      }

      // Load existing items from operation details
      const detailItems = operationDetailsData?.items || [];
      const loadedItems = detailItems.map((it) => ({
        itemId: it.item_id,
        itemName: it.item_name || `صنف #${it.item_id}`,
        quantity: Number(it.quantity) || 0,
      }));
      setReceiptItems(loadedItems);
      setReceiptItemId("");
      setReceiptQty("");
    },
    [],
  );

  const submitReceipt = useCallback(() => {
    setReceiptError(null);

    if (!receiptBranchId) {
      setReceiptError("اختر الفرع أولاً");
      return;
    }

    if (!receiptDate) {
      setReceiptError("اختر تاريخ الوارد");
      return;
    }

    if (receiptItems.length === 0) {
      setReceiptError("أضف صنف واحد على الأقل");
      return;
    }

    createReceiptMutation.mutate({
      branchId: receiptBranchId,
      receivedAt: receiptDate,
      note: receiptNote,
      items: receiptItems.map((x) => ({
        itemId: x.itemId,
        quantity: x.quantity,
      })),
    });
  }, [
    createReceiptMutation,
    receiptBranchId,
    receiptDate,
    receiptNote,
    receiptItems,
  ]);

  const submitEditReceipt = useCallback(() => {
    setReceiptError(null);

    if (!receiptBranchId) {
      setReceiptError("اختر الفرع أولاً");
      return;
    }

    if (!receiptDate) {
      setReceiptError("اختر تاريخ الوارد");
      return;
    }

    if (receiptItems.length === 0) {
      setReceiptError("أضف صنف واحد على الأقل");
      return;
    }

    if (!editingOperation) {
      setReceiptError("لا توجد عملية للتعديل");
      return;
    }

    updateReceiptMutation.mutate({
      operationId: editingOperation.id,
      branchId: receiptBranchId,
      receivedAt: receiptDate,
      note: receiptNote,
      items: receiptItems.map((x) => ({
        itemId: x.itemId,
        quantity: x.quantity,
      })),
    });
  }, [
    updateReceiptMutation,
    receiptBranchId,
    receiptDate,
    receiptNote,
    receiptItems,
    editingOperation,
  ]);

  return {
    receiptModalOpen,
    setReceiptModalOpen,
    receiptBranchId,
    setReceiptBranchId,
    receiptDate,
    setReceiptDate,
    receiptItemId,
    setReceiptItemId,
    receiptQty,
    setReceiptQty,
    receiptNote,
    setReceiptNote,
    receiptError,
    receiptItems,
    addReceiptItem,
    removeReceiptItem,
    openReceiptModal,
    submitReceipt,
    createReceiptMutation,
    stockByBranchItem,
    // Edit mode
    editingOperation,
    setEditingOperation,
    openEditReceiptModal,
    submitEditReceipt,
    updateReceiptMutation,
  };
}
