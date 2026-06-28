import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  Plus,
  Trash2,
  X,
  Send,
  AlertCircle,
  CheckCircle2,
  Package,
} from "lucide-react";
import { adminFetch } from "@/utils/apiAuth";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";
import { useCreateTransfer } from "@/hooks/useCreateTransfer";
import { formatRiyadhDateTimeForInput } from "@/utils/dateUtils";
import { queryKeys } from "../../utils/queryKeys.js";

function toNumberOrNull(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

// Per-item `units` array from the API. Each row carries its own
// `conversion_factor` against the item's base unit. Legacy items still
// without a multi-unit setup return an empty list → we fall back to
// factor=1 (i.e. typed qty == base qty).
function getItemUnits(item) {
  return Array.isArray(item?.units) ? item.units : [];
}

function pickDefaultUnit(item, defaultKey) {
  const units = getItemUnits(item);
  if (units.length === 0) return null;
  const defaultId = item?.[defaultKey];
  if (defaultId != null) {
    const hit = units.find((u) => String(u.id) === String(defaultId));
    if (hit) return hit;
  }
  return units.find((u) => u.is_base) || units[0] || null;
}

export default function TransferModal({ branches, onClose }) {
  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [operationDate, setOperationDate] = useState(
    formatRiyadhDateTimeForInput(),
  );
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fromIdNum = toNumberOrNull(fromBranchId);
  const toIdNum = toNumberOrNull(toBranchId);

  const queryClient = useQueryClient();

  // Force a refetch of `items` whenever the modal opens so the
  // available-qty numbers shown reflect the latest stock — without this,
  // two admins opening the modal at the same time both saw stale
  // branch_stock and could oversell. Empty dep array = runs once on mount.
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.items() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: allItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: queryKeys.items(),
    queryFn: async () => {
      const response = await adminFetch("/api/items");
      if (!response.ok) {
        throw new Error("Failed to fetch items");
      }
      return response.json();
    },
  });

  const activeItems = useMemo(() => {
    return (Array.isArray(allItems) ? allItems : []).filter(
      (i) => i.show_in_inventory !== false,
    );
  }, [allItems]);

  const branchOptions = useMemo(() => {
    const list = Array.isArray(branches) ? branches : [];
    const base = [{ value: "", label: "اختر فرع" }];
    const mapped = list.map((b) => ({ value: String(b.id), label: b.name }));
    return [...base, ...mapped];
  }, [branches]);

  const itemOptions = useMemo(() => {
    // Hide items the admin has disabled at EITHER the source or the
    // destination — the transfers API rejects such pairs anyway, so
    // the dropdown should not even offer them. We only filter once
    // both branches are picked so the list isn't empty before the
    // user has chosen.
    const isDisabledHere = (it) => {
      const disabled = Array.isArray(it?.disabled_branches)
        ? it.disabled_branches.map(Number)
        : [];
      if (fromIdNum && disabled.includes(fromIdNum)) return true;
      if (toIdNum && disabled.includes(toIdNum)) return true;
      return false;
    };

    const base = [
      { value: "", label: itemsLoading ? "جاري التحميل…" : "اختر صنف" },
    ];

    const mapped = activeItems
      .filter((it) => !isDisabledHere(it))
      .slice()
      .sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), "ar"),
      )
      .map((it) => ({ value: String(it.id), label: it.name }));

    return [...base, ...mapped];
  }, [activeItems, itemsLoading, fromIdNum, toIdNum]);

  const selectedItem = useMemo(() => {
    const idNum = toNumberOrNull(selectedItemId);
    if (!idNum) {
      return null;
    }
    return activeItems.find((i) => Number(i.id) === idNum) || null;
  }, [activeItems, selectedItemId]);

  // ── Unit (locked) ──────────────────────────────────────────────────
  //
  // Transfers move stock at the item's DEFAULT INVENTORY UNIT. The
  // operator does NOT pick a unit and the typed qty is stored as-is —
  // no conversion-factor multiplication (downstream stock-value math
  // applies the factor). We only show the unit name as a read-only
  // label. Matches the employee-inventory fix (commit 160292b).
  const lockedUnit = useMemo(
    () => pickDefaultUnit(selectedItem, "default_inventory_unit_id"),
    [selectedItem],
  );
  const lockedUnitLabel = lockedUnit?.name_ar || lockedUnit?.name_en || "";

  // ─── Point-in-time stock for the chosen operation date ─────────────
  //
  // Backend validation runs against the stock AT `operationDate`, not
  // against today's stock. To stay in sync, the modal fetches the
  // same point-in-time numbers via `/api/branch-stock-at` whenever
  // the date or selected item changes. Falls back to the inline
  // `selectedItem.branch_stock` (which is current/now) so the user
  // still sees something while the fetch is in flight.
  const fallbackStockAt = (branchIdNum) => {
    if (!selectedItem || !branchIdNum) return null;
    const branchStock = selectedItem.branch_stock;
    if (!Array.isArray(branchStock)) return null;
    const found = branchStock.find(
      (bs) => Number(bs.branch_id) === branchIdNum,
    );
    return found ? Number(found.quantity) || 0 : 0;
  };

  const stockAtQuery = useQuery({
    queryKey: queryKeys.branchStockAt(fromIdNum,toIdNum,selectedItem?.id,operationDate),
    enabled: !!(selectedItem?.id && (fromIdNum || toIdNum)),
    queryFn: async () => {
      const ids = [fromIdNum, toIdNum].filter(Boolean);
      const out = { from: null, to: null };
      // Two parallel requests (one per branch). Cheaper than a single
      // batched request because the result shapes diverge and the
      // cache key is per-branch.
      const fetchOne = async (branchId) => {
        if (!branchId) return null;
        const params = new URLSearchParams({
          branchId: String(branchId),
          itemIds: String(selectedItem.id),
        });
        if (operationDate) params.set("at", operationDate);
        const res = await adminFetch(`/api/branch-stock-at?${params}`);
        if (!res.ok) throw new Error("فشل في جلب الرصيد");
        const data = await res.json();
        const q = Number(data?.stock?.[String(selectedItem.id)]);
        return Number.isFinite(q) ? q : 0;
      };
      const [fromQty, toQty] = await Promise.all([
        fromIdNum ? fetchOne(fromIdNum) : Promise.resolve(null),
        toIdNum ? fetchOne(toIdNum) : Promise.resolve(null),
      ]);
      out.from = fromQty;
      out.to = toQty;
      return out;
    },
    staleTime: 5 * 1000,
  });

  const fromBranchStock =
    stockAtQuery.data?.from !== undefined && stockAtQuery.data?.from !== null
      ? stockAtQuery.data.from
      : fallbackStockAt(fromIdNum);

  const toBranchStock =
    stockAtQuery.data?.to !== undefined && stockAtQuery.data?.to !== null
      ? stockAtQuery.data.to
      : fallbackStockAt(toIdNum);

  const stockIsPointInTime = !!operationDate && stockAtQuery.isSuccess;

  const addItem = () => {
    setError(null);
    setSuccess(null);

    const itemIdNum = toNumberOrNull(selectedItemId);
    // Allow decimal quantities (e.g. 12.5 kg, 0.75 liters). Round to 3 decimals.
    const rawQty = Number(quantity);
    const displayQty = Number.isFinite(rawQty)
      ? Math.round(rawQty * 1000) / 1000
      : NaN;
    // Store the typed count as-is — NO conversion-factor multiplication.
    // The unit is locked to the item's default inventory unit (display
    // label only); downstream stock-value/dashboard math applies the
    // factor. Matches the employee-inventory fix (commit 160292b).
    const qtyNum = displayQty;
    const lockedUnit = pickDefaultUnit(selectedItem, "default_inventory_unit_id");
    const unitLabel = lockedUnit?.name_ar || lockedUnit?.name_en || "";

    if (!fromIdNum) {
      setError("اختر فرع المرسل");
      return;
    }
    if (!toIdNum) {
      setError("اختر فرع المستقبل");
      return;
    }
    if (fromIdNum === toIdNum) {
      setError("لا يمكن التحويل لنفس الفرع");
      return;
    }

    if (!itemIdNum || !selectedItem) {
      setError("اختر الصنف");
      return;
    }
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError("أدخل كمية صحيحة");
      return;
    }

    // Check stock availability in sender branch — both numbers in base units.
    const availableStock = fromBranchStock ?? 0;
    const existingEntry = items.find((x) => x.itemId === itemIdNum);
    const alreadyAdded = existingEntry ? existingEntry.quantity : 0;
    const totalAfterAdd = alreadyAdded + qtyNum;

    if (totalAfterAdd > availableStock) {
      const itemName = selectedItem.name || "الصنف";
      const remaining = availableStock - alreadyAdded;
      if (remaining <= 0) {
        setError(
          `لا يمكن إضافة "${itemName}" — الكمية المتاحة في فرع المرسل (${availableStock}) تم حجزها بالكامل في القائمة`,
        );
      } else {
        setError(
          `الكمية المطلوبة (${totalAfterAdd}) أكبر من المتوفر في فرع المرسل (${availableStock}) للصنف "${itemName}". الحد الأقصى المتبقي: ${remaining}`,
        );
      }
      return;
    }

    setItems((prev) => {
      const existsIdx = prev.findIndex((x) => x.itemId === itemIdNum);
      if (existsIdx >= 0) {
        const copy = prev.slice();
        const prevDisplay = Number(copy[existsIdx].displayQty) || 0;
        copy[existsIdx] = {
          ...copy[existsIdx],
          quantity: copy[existsIdx].quantity + qtyNum,
          // Only merge the display qty when the unit matches — otherwise
          // we'd be adding "5 كرتون" + "3 حبة" and showing nonsense. On
          // mismatch fall back to the base number.
          displayQty:
            copy[existsIdx].unitLabel === unitLabel
              ? prevDisplay + displayQty
              : copy[existsIdx].quantity + qtyNum,
          unitLabel:
            copy[existsIdx].unitLabel === unitLabel ? unitLabel : "",
        };
        return copy;
      }
      return [
        ...prev,
        {
          itemId: itemIdNum,
          itemName: selectedItem.name,
          quantity: qtyNum,
          displayQty,
          unitLabel,
          availableStock,
        },
      ];
    });

    setSelectedItemId("");
    setQuantity("");
  };

  const removeItem = (itemId) => {
    setItems((prev) => prev.filter((x) => x.itemId !== itemId));
  };

  const submitDisabled =
    !fromIdNum ||
    !toIdNum ||
    fromIdNum === toIdNum ||
    items.length === 0 ||
    items.length > 200;

  const submitMutation = useCreateTransfer({
    onSuccess: (data) => {
      setError(null);
      setSuccess(`تم التحويل بنجاح (${data?.transferNumber || ""})`);
      window.setTimeout(() => {
        onClose();
      }, 800);
    },
    onError: (e) => {
      setSuccess(null);
      setError(e?.message || "حدث خطأ أثناء التحويل");
    },
  });

  const handleSubmitTransfer = () => {
    // Confirm large transfers so an accidental click can't move 50+ rows
    // or a heavy total without a deliberate second action. Threshold
    // chosen as "more than a handful of items" — adjust if it nags.
    const CONFIRM_THRESHOLD_ITEMS = 5;
    if (items.length > CONFIRM_THRESHOLD_ITEMS) {
      const fromName =
        (branches || []).find((b) => Number(b.id) === fromIdNum)?.name || "";
      const toName =
        (branches || []).find((b) => Number(b.id) === toIdNum)?.name || "";
      const ok = window.confirm(
        `تأكيد التحويل: ${items.length} صنف من "${fromName}" إلى "${toName}"؟`,
      );
      if (!ok) return;
    }

    submitMutation.mutate({
      fromBranchId: fromIdNum,
      toBranchId: toIdNum,
      items: items.map((x) => ({ itemId: x.itemId, quantity: x.quantity })),
      note: note?.trim() ? note.trim() : null,
      operationDate: operationDate || null,
    });
  };

  const modalRef = useRef(null);

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-50"
      dir="rtl"
      onMouseDown={(e) => {
        if (e.target === modalRef.current) {
          onClose();
        }
      }}
      ref={modalRef}
    >
      <div
        className={`${ws.glass} ${ws.card} w-full sm:max-w-2xl max-h-[95dvh] sm:max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden`}
      >
        <div
          className={`p-4 sm:p-6 flex items-center justify-between flex-shrink-0 ${ws.topBar}`}
        >
          <div className="min-w-0">
            <h3 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span className={`${ws.iconBox} w-10 h-10 text-slate-800 dark:text-white/80`}>
                <ArrowLeftRight className="w-5 h-5" />
              </span>
              <span className="truncate">تحويل بين الفروع</span>
            </h3>
            <p className="text-slate-500 dark:text-slate-500 dark:text-white/50 text-sm mt-1">
              خصم من فرع المرسل + إضافة لفرع المستقبل
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={ws.iconButton}
            aria-label="إغلاق"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-600 dark:text-white/60" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 min-h-0">
          {error ? (
            <div className="p-4 rounded-2xl border border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-100 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="text-sm">{error}</div>
            </div>
          ) : null}

          {success ? (
            <div className="p-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-50 flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="text-sm">{success}</div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55 mb-2">
                فرع المرسل
              </label>
              <GlassSelect
                value={fromBranchId}
                onChange={(v) => {
                  setFromBranchId(v);
                  setError(null);
                  setSuccess(null);
                }}
                options={branchOptions}
                buttonClassName="px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55 mb-2">
                فرع المستقبل
              </label>
              <GlassSelect
                value={toBranchId}
                onChange={(v) => {
                  setToBranchId(v);
                  setError(null);
                  setSuccess(null);
                }}
                options={branchOptions}
                buttonClassName="px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55 mb-2">
                تاريخ العملية
              </label>
              <GlassDatePicker
                value={operationDate}
                onChange={setOperationDate}
                placeholder="اختر التاريخ"
                buttonClassName="px-4 py-3"
                showTime
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 items-end md:grid-cols-[1fr_140px_120px]">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55 mb-2">
                  الصنف
                </label>
                <GlassSelect
                  value={selectedItemId}
                  onChange={(v) => {
                    setSelectedItemId(v);
                    setError(null);
                    setSuccess(null);
                  }}
                  options={itemOptions}
                  buttonClassName="px-4 py-3"
                  searchable
                  searchPlaceholder="ابحث عن صنف..."
                  noResultsLabel="لا يوجد صنف مطابق"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55 mb-2">
                  الكمية
                  {lockedUnitLabel ? (
                    <span className="font-normal text-slate-500 dark:text-slate-500 dark:text-white/40">
                      {" "}
                      ({lockedUnitLabel})
                    </span>
                  ) : null}
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.001"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={`${ws.input} px-4 py-3`}
                  placeholder="0"
                />
              </div>

              <button
                type="button"
                onClick={addItem}
                className={`${ws.btnPrimary} px-4 py-3 justify-center`}
                disabled={itemsLoading}
                title={itemsLoading ? "جاري تحميل الأصناف" : "إضافة"}
              >
                <Plus className="w-4 h-4" />
                <span>إضافة</span>
              </button>
            </div>

            {/* Stock info for selected item. The label flips between
                "الحالي" and "بتاريخ T" so the user knows the number
                they're staring at matches what the backend will validate
                against. */}
            {selectedItem && (fromIdNum || toIdNum) ? (
              <div className="flex flex-wrap gap-2 items-center">
                {fromIdNum && fromBranchStock !== null ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-100 dark:bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-slate-200 dark:border-white/10">
                    <Package className="w-4 h-4 text-slate-500 dark:text-slate-500 dark:text-white/40" />
                    <span className="text-xs text-slate-600 dark:text-slate-600 dark:text-white/55">
                      مخزون المرسل{" "}
                      {stockIsPointInTime ? "بتاريخ التحويل" : "الحالي"}:
                    </span>
                    <span
                      className={`text-sm font-bold ${fromBranchStock > 0 ? "text-emerald-700 dark:text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-700 dark:text-red-300"}`}
                    >
                      {fromBranchStock}
                    </span>
                  </div>
                ) : null}
                {toIdNum && toBranchStock !== null ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-100 dark:bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-slate-200 dark:border-white/10">
                    <Package className="w-4 h-4 text-slate-500 dark:text-slate-500 dark:text-white/40" />
                    <span className="text-xs text-slate-600 dark:text-slate-600 dark:text-white/55">
                      مخزون المستقبل{" "}
                      {stockIsPointInTime ? "بتاريخ التحويل" : "الحالي"}:
                    </span>
                    <span
                      className={`text-sm font-bold ${toBranchStock > 0 ? "text-emerald-700 dark:text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-700 dark:text-amber-300"}`}
                    >
                      {toBranchStock}
                    </span>
                  </div>
                ) : null}
                {stockAtQuery.isFetching ? (
                  <span className="text-[11px] text-slate-500 dark:text-slate-500 dark:text-white/40">
                    تحديث الرصيد…
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55 mb-2">
              ملاحظة (اختياري)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className={`${ws.input} px-4 py-3 resize-none`}
              placeholder="مثال: تحويل مواد للفرع بسبب نفاد المخزون"
            />
          </div>

          <div className={`${ws.glassSoft} ${ws.card} p-4`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-slate-900 dark:text-slate-900 dark:text-white font-bold">الأصناف المحددة</h4>
              <span className={`${ws.chip}`}>{items.length} صنف</span>
            </div>

            {items.length === 0 ? (
              <div className="text-slate-500 dark:text-slate-500 dark:text-white/50 text-sm">
                ما تم اختيار أصناف بعد
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((it) => {
                  const stock = it.availableStock ?? 0;
                  const pct =
                    stock > 0 ? Math.round((it.quantity / stock) * 100) : 100;
                  const isHigh = pct >= 80;
                  const pctColor = isHigh ? "text-red-700 dark:text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-700 dark:text-emerald-300";
                  const barColor = isHigh
                    ? "bg-red-400/60"
                    : "bg-emerald-400/60";
                  const qtyLabel = it.unitLabel
                    ? `${it.displayQty} ${it.unitLabel}`
                    : String(it.quantity);

                  return (
                    <div
                      key={it.itemId}
                      className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-slate-200 dark:border-white/10 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-slate-900 dark:text-slate-900 dark:text-white font-semibold truncate">
                            {it.itemName}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`${ws.pill} bg-slate-100 dark:bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-slate-900 dark:text-white border-slate-200 dark:border-slate-200 dark:border-white/10`}
                          >
                            {qtyLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeItem(it.itemId)}
                            className={`${ws.btnDanger} px-3 py-2 text-sm justify-center`}
                            aria-label="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {/* Stock usage bar */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${barColor}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span
                          className={`text-[11px] font-semibold whitespace-nowrap ${pctColor}`}
                        >
                          {it.quantity} / {stock} ({pct}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div
          className={`p-4 sm:p-6 border-t ${ws.divider} flex flex-col sm:flex-row gap-2 sm:gap-3 flex-shrink-0`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`${ws.btnNeutral} flex-1 px-4 py-3 justify-center`}
            disabled={submitMutation.isPending}
          >
            <X className="w-5 h-5" />
            <span>إلغاء</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setSuccess(null);
              if (submitDisabled) {
                setError("تأكد من اختيار الفروع وإضافة الأصناف");
                return;
              }
              handleSubmitTransfer();
            }}
            className={`${ws.btnPrimary} flex-1 px-4 py-3 justify-center`}
            disabled={submitDisabled || submitMutation.isPending}
          >
            <Send className="w-5 h-5" />
            <span>
              {submitMutation.isPending ? "جاري التحويل…" : "تنفيذ التحويل"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
