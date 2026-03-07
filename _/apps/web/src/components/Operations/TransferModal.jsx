import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

function toNumberOrNull(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

function nowLocalDatetime() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export default function TransferModal({ branches, onClose }) {
  const queryClient = useQueryClient();

  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [operationDate, setOperationDate] = useState(nowLocalDatetime());
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fromIdNum = toNumberOrNull(fromBranchId);
  const toIdNum = toNumberOrNull(toBranchId);

  const { data: allItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["items"],
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
    const base = [
      { value: "", label: itemsLoading ? "جاري التحميل…" : "اختر صنف" },
    ];

    const mapped = activeItems
      .slice()
      .sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), "ar"),
      )
      .map((it) => ({ value: String(it.id), label: it.name }));

    return [...base, ...mapped];
  }, [activeItems, itemsLoading]);

  const selectedItem = useMemo(() => {
    const idNum = toNumberOrNull(selectedItemId);
    if (!idNum) {
      return null;
    }
    return activeItems.find((i) => Number(i.id) === idNum) || null;
  }, [activeItems, selectedItemId]);

  // Get current stock for selected item in from-branch
  const fromBranchStock = useMemo(() => {
    if (!selectedItem || !fromIdNum) return null;
    const branchStock = selectedItem.branch_stock;
    if (!Array.isArray(branchStock)) return null;
    const found = branchStock.find((bs) => Number(bs.branch_id) === fromIdNum);
    return found ? Number(found.quantity) || 0 : 0;
  }, [selectedItem, fromIdNum]);

  // Get current stock for selected item in to-branch
  const toBranchStock = useMemo(() => {
    if (!selectedItem || !toIdNum) return null;
    const branchStock = selectedItem.branch_stock;
    if (!Array.isArray(branchStock)) return null;
    const found = branchStock.find((bs) => Number(bs.branch_id) === toIdNum);
    return found ? Number(found.quantity) || 0 : 0;
  }, [selectedItem, toIdNum]);

  const addItem = () => {
    setError(null);
    setSuccess(null);

    const itemIdNum = toNumberOrNull(selectedItemId);
    const qtyNum = Math.floor(Number(quantity));

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

    // Check stock availability in sender branch
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
        copy[existsIdx] = {
          ...copy[existsIdx],
          quantity: copy[existsIdx].quantity + qtyNum,
        };
        return copy;
      }
      return [
        ...prev,
        {
          itemId: itemIdNum,
          itemName: selectedItem.name,
          quantity: qtyNum,
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

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        fromBranchId: fromIdNum,
        toBranchId: toIdNum,
        items: items.map((x) => ({ itemId: x.itemId, quantity: x.quantity })),
        note: note?.trim() ? note.trim() : null,
        operationDate: operationDate || null,
      };

      const response = await adminFetch("/api/inventory-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "فشل في تنفيذ التحويل");
      }

      return data;
    },
    onSuccess: (data) => {
      setError(null);
      setSuccess(`تم التحويل بنجاح (${data?.transferNumber || ""})`);
      queryClient.invalidateQueries({ queryKey: ["inventory-operations"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["items-summary"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });

      window.setTimeout(() => {
        onClose();
      }, 800);
    },
    onError: (e) => {
      console.error(e);
      setSuccess(null);
      setError(e?.message || "حدث خطأ أثناء التحويل");
    },
  });

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
            <h3 className="text-lg sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className={`${ws.iconBox} w-10 h-10 text-white/80`}>
                <ArrowLeftRight className="w-5 h-5" />
              </span>
              <span className="truncate">تحويل بين الفروع</span>
            </h3>
            <p className="text-white/50 text-sm mt-1">
              خصم من فرع المرسل + إضافة لفرع المستقبل
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={ws.iconButton}
            aria-label="إغلاق"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 min-h-0">
          {error ? (
            <div className="p-4 rounded-2xl border border-red-500/25 bg-red-500/10 text-red-100 flex items-start gap-2">
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
              <label className="block text-xs font-semibold text-white/55 mb-2">
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
              <label className="block text-xs font-semibold text-white/55 mb-2">
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
              <label className="block text-xs font-semibold text-white/55 mb-2">
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
            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_120px] gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-white/55 mb-2">
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
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/55 mb-2">
                  الكمية
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
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

            {/* Stock info for selected item */}
            {selectedItem && (fromIdNum || toIdNum) ? (
              <div className="flex flex-wrap gap-2">
                {fromIdNum && fromBranchStock !== null ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/[0.04] border border-white/10">
                    <Package className="w-4 h-4 text-white/40" />
                    <span className="text-xs text-white/55">مخزون المرسل:</span>
                    <span
                      className={`text-sm font-bold ${fromBranchStock > 0 ? "text-emerald-300" : "text-red-300"}`}
                    >
                      {fromBranchStock}
                    </span>
                  </div>
                ) : null}
                {toIdNum && toBranchStock !== null ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/[0.04] border border-white/10">
                    <Package className="w-4 h-4 text-white/40" />
                    <span className="text-xs text-white/55">
                      مخزون المستقبل:
                    </span>
                    <span
                      className={`text-sm font-bold ${toBranchStock > 0 ? "text-emerald-300" : "text-amber-300"}`}
                    >
                      {toBranchStock}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/55 mb-2">
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
              <h4 className="text-white font-bold">الأصناف المحددة</h4>
              <span className={`${ws.chip}`}>{items.length} صنف</span>
            </div>

            {items.length === 0 ? (
              <div className="text-white/50 text-sm">
                ما تم اختيار أصناف بعد
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((it) => {
                  const stock = it.availableStock ?? 0;
                  const pct =
                    stock > 0 ? Math.round((it.quantity / stock) * 100) : 100;
                  const isHigh = pct >= 80;
                  const pctColor = isHigh ? "text-red-300" : "text-emerald-300";
                  const barColor = isHigh
                    ? "bg-red-400/60"
                    : "bg-emerald-400/60";

                  return (
                    <div
                      key={it.itemId}
                      className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-white font-semibold truncate">
                            {it.itemName}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`${ws.pill} bg-white/[0.06] text-white border-white/10`}
                          >
                            {it.quantity}
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
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
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
              submitMutation.mutate();
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
