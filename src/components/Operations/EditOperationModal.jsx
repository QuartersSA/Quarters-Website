import { useState, useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Send,
  AlertCircle,
  Search,
  ClipboardList,
  Calendar,
  ArrowLeftRight,
  FolderOpen,
  PackagePlus,
  Pencil,
} from "lucide-react";
import { adminFetch } from "@/utils/apiAuth";
import { ws } from "@/components/Workspace/ui";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";

const TYPE_LABELS = {
  Daily: "تعديل الجرد اليومي",
  Weekly: "تعديل الجرد الأسبوعي",
  Transfer: "تعديل التحويل",
  Opening: "تعديل المخزون الافتتاحي",
};

const TYPE_DESCRIPTIONS = {
  Daily: "عدّل كميات الأصناف المسجلة في هذا الجرد اليومي",
  Weekly: "عدّل كميات الأصناف المسجلة في هذا الجرد الأسبوعي",
  Transfer: "عدّل كميات الأصناف المحولة",
  Opening: "عدّل كميات المخزون الافتتاحي المسجلة",
};

const TYPE_ICONS = {
  Daily: Calendar,
  Weekly: Calendar,
  Transfer: ArrowLeftRight,
  Opening: FolderOpen,
};

function formatDateForInput(dateStr) {
  if (!dateStr) return "";
  // The DB stores "timestamp without time zone" but neon appends "Z".
  // We must strip that Z so we don't get a UTC→local shift each time.
  const cleaned = String(dateStr).replace(/Z$/i, "");
  const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return "";
  const [, yyyy, mm, dd, hh = "00", min = "00"] = match;
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export default function EditOperationModal({
  operation,
  operationDetails,
  onClose,
}) {
  const queryClient = useQueryClient();

  const invType = operation?.inventory_type || "Daily";
  const TitleIcon = TYPE_ICONS[invType] || ClipboardList;

  // Use operationDetails (fresh from API) for the date, fall back to operation (list cache)
  const initialDate =
    operationDetails?.operation_date ||
    operation?.operation_date ||
    operation?.created_at;

  // State
  const [note, setNote] = useState(
    operationDetails?.note ?? operation?.note ?? "",
  );
  const [opDate, setOpDate] = useState(formatDateForInput(initialDate));
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);

  // Build initial qty map from operation details
  const initialQtyMap = useMemo(() => {
    const map = {};
    const items = operationDetails?.items || [];
    for (const it of items) {
      map[it.item_id] = Number(it.quantity) || 0;
    }
    return map;
  }, [operationDetails]);

  const [qtyByItem, setQtyByItem] = useState(initialQtyMap);

  // Fetch all items for the full list
  const { data: allItemsRaw = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const res = await adminFetch("/api/items");
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
  });

  const activeItems = useMemo(() => {
    return (allItemsRaw || []).filter(
      (it) => it.is_active !== false && it.show_in_inventory !== false,
    );
  }, [allItemsRaw]);

  // Filter items by search
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeItems;
    return activeItems.filter((it) => {
      const name = (it.name || "").toLowerCase();
      const nameEn = (it.name_en || "").toLowerCase();
      return name.includes(q) || nameEn.includes(q);
    });
  }, [activeItems, search]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ operationId, note, operationDate, items }) => {
      const response = await adminFetch("/api/inventory-operations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId, note, operationDate, items }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "فشل تعديل العملية");
      }
      return response.json();
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["inventory-operations"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["items-summary"] });
      queryClient.invalidateQueries({ queryKey: ["variance"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["operation-details"] });
      queryClient.invalidateQueries({ queryKey: ["opening-sessions"] });
      onClose();
    },
    onError: (err) => {
      console.error(err);
      setError(err.message || "فشل تعديل العملية");
    },
  });

  const handleSubmit = useCallback(() => {
    setError(null);

    if (!opDate) {
      setError("اختر تاريخ العملية");
      return;
    }

    // Build items array from qtyByItem - include all items that have qty > 0, or were originally in the operation
    const itemsPayload = [];
    const allItemIds = new Set([
      ...Object.keys(qtyByItem).map(Number),
      ...activeItems.map((it) => it.id),
    ]);

    for (const itemId of allItemIds) {
      const qty = Number(qtyByItem[itemId]);
      if (!Number.isFinite(qty) || qty < 0) continue;
      if (qty === 0 && !(itemId in initialQtyMap)) continue; // skip items not originally in the op and with 0 qty
      itemsPayload.push({ itemId: Number(itemId), quantity: qty });
    }

    if (itemsPayload.length === 0) {
      setError("أضف صنف واحد على الأقل");
      return;
    }

    updateMutation.mutate({
      operationId: operation.id,
      note,
      operationDate: opDate,
      items: itemsPayload,
    });
  }, [
    operation,
    note,
    opDate,
    qtyByItem,
    initialQtyMap,
    activeItems,
    updateMutation,
  ]);

  if (!operation || !operationDetails) return null;

  const isPending = updateMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      dir="rtl"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={`relative w-full max-w-3xl max-h-[95dvh] sm:max-h-[90dvh] flex flex-col ${ws.glass} ${ws.card} rounded-t-3xl sm:rounded-3xl overflow-hidden`}
      >
        {/* Header */}
        <div
          className={`p-4 sm:p-6 flex items-center justify-between flex-shrink-0 ${ws.topBar}`}
        >
          <div className="min-w-0">
            <h3 className="text-lg sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className={`${ws.iconBox} w-10 h-10 text-white/80`}>
                <Pencil className="w-5 h-5" />
              </span>
              <span className="truncate">
                {TYPE_LABELS[invType] || "تعديل العملية"}
              </span>
            </h3>
            <p className="text-white/50 text-sm mt-1">
              {TYPE_DESCRIPTIONS[invType] || "عدّل بيانات العملية"}{" "}
              <span className="text-white/30 font-mono">
                ({operation.inventory_number})
              </span>
            </p>
          </div>
          <button
            type="button"
            className={ws.iconButton}
            onClick={onClose}
            aria-label="إغلاق"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 min-h-0">
          {/* Error */}
          {error ? (
            <div className="p-4 rounded-2xl border border-red-500/25 bg-red-500/10 text-red-100 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="text-sm">{error}</div>
            </div>
          ) : null}

          {/* Date + Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/55 mb-2">
                تاريخ العملية
              </label>
              <GlassDatePicker
                value={opDate}
                onChange={setOpDate}
                placeholder="اختر التاريخ"
                buttonClassName="px-4 py-3"
                showTime
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/55 mb-2">
                ملاحظة (اختياري)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={`${ws.input} px-4 py-3`}
                placeholder="ملاحظة..."
              />
            </div>
          </div>

          {/* Info banner */}
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-sky-500/5 border border-sky-400/15">
            <TitleIcon className="w-4 h-4 text-sky-200 flex-shrink-0" />
            <span className="text-xs text-white/60">
              الفرع:{" "}
              <span className="text-white font-semibold">
                {operation.branch_name || "غير محدد"}
              </span>
              {invType === "Transfer" && operation.transfer_branch_name ? (
                <>
                  {" ← "}
                  <span className="text-white font-semibold">
                    {operation.transfer_branch_name}
                  </span>
                </>
              ) : null}
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${ws.input} pr-10 pl-3 py-2.5`}
              placeholder="ابحث عن صنف..."
            />
          </div>

          {/* Items table */}
          <div
            className={`max-h-[40vh] overflow-auto rounded-3xl border ${ws.divider} bg-white/[0.02]`}
          >
            <table className="w-full">
              <thead>
                <tr className="bg-white/[0.04] sticky top-0">
                  <th className="text-right px-4 py-3 text-sm font-semibold text-white/70">
                    الصنف
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-white/70">
                    الوحدة
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-white/70 w-40">
                    الكمية
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((it) => {
                  const hasValue = it.id in qtyByItem;
                  const currentVal = qtyByItem[it.id] ?? "";
                  const wasInOriginal = it.id in initialQtyMap;

                  return (
                    <tr
                      key={it.id}
                      className={`border-t border-white/5 ${wasInOriginal ? "bg-white/[0.02]" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <div className="text-white font-medium text-sm">
                          {it.name}
                        </div>
                        {wasInOriginal ? (
                          <div className="text-white/30 text-xs mt-0.5">
                            الأصلي: {initialQtyMap[it.id]}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-white/65 text-sm">
                        {it.unit || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={currentVal}
                          onChange={(e) => {
                            const v = e.target.value;
                            setQtyByItem((prev) => ({
                              ...prev,
                              [it.id]: v,
                            }));
                          }}
                          className={`${ws.input} px-3 py-2.5 w-full`}
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  );
                })}

                {filteredItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-10 text-center text-white/55"
                    >
                      لا توجد نتائج
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`p-4 sm:p-6 border-t ${ws.divider} flex flex-col sm:flex-row gap-2 sm:gap-3 flex-shrink-0`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`${ws.btnNeutral} flex-1 px-4 py-3 justify-center`}
            disabled={isPending}
          >
            <X className="w-5 h-5" />
            <span>إلغاء</span>
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className={`${ws.btnPrimary} flex-1 px-4 py-3 justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Send className="w-5 h-5" />
            <span>{isPending ? "جاري الحفظ…" : "حفظ التعديلات"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
