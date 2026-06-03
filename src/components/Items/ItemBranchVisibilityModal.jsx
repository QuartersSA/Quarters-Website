import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Building2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { adminFetch } from "@/utils/apiAuth";

// Per-branch enable/disable for a single item. The default state is
// "enabled at every branch" — disabling only INSERTs a sparse row into
// `item_branch_disabled`. Seeded from the item's `disabled_branches`
// array (delivered by /api/items) so there's no extra round-trip to
// open the modal.
export function ItemBranchVisibilityModal({
  item,
  branches,
  onClose,
}) {
  const queryClient = useQueryClient();
  const [disabled, setDisabled] = useState(
    () => new Set((item?.disabled_branches || []).map(Number)),
  );
  const [pendingBranchId, setPendingBranchId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Reset local state when caller swaps the item under us.
  useEffect(() => {
    setDisabled(new Set((item?.disabled_branches || []).map(Number)));
    setErrorMsg(null);
  }, [item?.id, item?.disabled_branches]);

  const branchList = useMemo(
    () => (Array.isArray(branches) ? branches : []),
    [branches],
  );

  const toggleMutation = useMutation({
    mutationFn: async ({ branchId, enabled }) => {
      const res = await adminFetch(
        `/api/items/${item.id}/branch-visibility`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branchId, enabled }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تحديث حالة الفرع");
      }
      return data;
    },
    onMutate: ({ branchId, enabled }) => {
      // Optimistic local update + flag pending row for spinner.
      setPendingBranchId(branchId);
      setErrorMsg(null);
      setDisabled((prev) => {
        const next = new Set(prev);
        if (enabled) next.delete(branchId);
        else next.add(branchId);
        return next;
      });
    },
    onError: (err, { branchId, enabled }) => {
      // Roll back the optimistic flip.
      setDisabled((prev) => {
        const next = new Set(prev);
        if (enabled) next.add(branchId);
        else next.delete(branchId);
        return next;
      });
      setErrorMsg(err?.message || "حدث خطأ");
    },
    onSettled: () => {
      setPendingBranchId(null);
      // Refresh dependent views so the new disabled state is reflected
      // immediately on items / summary / low-stock / dashboard.
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["items-summary"] });
      // `useLowStockData` keys its query as ["low-stock-items"]; the
      // bare ["low-stock"] key never matched its cache.
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock-items"] });
      queryClient.invalidateQueries({ queryKey: ["over-stock"] });
      queryClient.invalidateQueries({ queryKey: ["stock-value"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-analytics"] });
    },
  });

  if (!item) return null;

  // Helper: stock currently held at a given branch for this item, used
  // to warn the admin before disabling a branch that still has stock.
  // (The stock isn't deleted — disabling just hides it — but the
  // admin should consciously accept that the total goes down.)
  const stockAtBranch = (branchId) => {
    if (!Array.isArray(item?.branch_stock)) return 0;
    const row = item.branch_stock.find(
      (s) => Number(s.branch_id) === Number(branchId),
    );
    return Number(row?.quantity) || 0;
  };

  const handleToggle = (branchId) => {
    const wasDisabled = disabled.has(branchId);
    // About to DISABLE? Warn if branch has positive stock that would
    // disappear from totals.
    if (!wasDisabled) {
      const qty = stockAtBranch(branchId);
      if (qty > 0) {
        const branchName =
          branchList.find((b) => Number(b.id) === Number(branchId))?.name ||
          "هذا الفرع";
        const ok = window.confirm(
          `الكمية الحالية في "${branchName}" = ${qty} ${item.unit || "وحدة"}.\nإلغاء التفعيل يخفي هذه الكمية من المخزون والتقارير (الحركة التاريخية تبقى محفوظة، وتظهر مجدداً عند إعادة التفعيل).\n\nمتابعة الإلغاء؟`,
        );
        if (!ok) return;
      }
    }
    toggleMutation.mutate({
      branchId,
      enabled: wasDisabled, // flip
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className={`${ws.glass} ${ws.card} w-full max-w-xl shadow-2xl my-8 flex flex-col`}
        style={{ maxHeight: "calc(100vh - 64px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`p-5 sm:p-6 flex items-center justify-between shrink-0 ${ws.topBar}`}
        >
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
              <div className={`${ws.iconBox} w-10 h-10 text-sky-700 dark:text-sky-700 dark:text-sky-200`}>
                <Building2 className="w-5 h-5" />
              </div>
              <span className="truncate">
                إدارة الفروع لـ "{item.name}"
              </span>
            </h3>
            <p className="text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm mt-2 leading-relaxed">
              فعّل/ألغِ تفعيل هذا الصنف لكل فرع. الفروع المعطّلة لن تظهر
              في صفحات الجرد، التقارير، أو لوحة التحكم.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={ws.iconButton}
            aria-label="إغلاق"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/60" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {errorMsg ? (
            <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-700 dark:text-red-200 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {errorMsg}
            </div>
          ) : null}

          {branchList.length === 0 ? (
            <div className="text-center py-8 text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>لا توجد فروع</p>
            </div>
          ) : (
            <div className="space-y-2">
              {branchList.map((branch) => {
                const branchId = Number(branch.id);
                const isDisabled = disabled.has(branchId);
                const isPending = pendingBranchId === branchId;

                const cardClass = isDisabled
                  ? "bg-red-500/[0.04] border-red-500/15"
                  : "bg-emerald-500/[0.04] border-emerald-500/15";

                return (
                  <div
                    key={branch.id}
                    className={`flex items-center justify-between p-4 rounded-3xl border transition-colors ${cardClass}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-200 dark:border-slate-200 dark:border-white/10 ${
                          isDisabled ? "bg-red-500/10" : "bg-emerald-500/10"
                        }`}
                      >
                        {isDisabled ? (
                          <EyeOff className="w-5 h-5 text-red-700 dark:text-red-700 dark:text-red-200" />
                        ) : (
                          <Eye className="w-5 h-5 text-emerald-700 dark:text-emerald-700 dark:text-emerald-200" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white font-medium truncate">
                          {branch.name}
                        </p>
                        <p
                          className={`text-xs ${
                            isDisabled ? "text-red-700 dark:text-red-700 dark:text-red-200" : "text-emerald-700 dark:text-emerald-700 dark:text-emerald-200"
                          }`}
                        >
                          {isDisabled ? "معطّل في هذا الفرع" : "مفعّل"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggle(branchId)}
                      disabled={isPending}
                      className={`${
                        isDisabled ? ws.btnPrimary : ws.btnNeutral
                      } px-4 py-2 text-sm justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isPending
                        ? "جاري…"
                        : isDisabled
                          ? "تفعيل"
                          : "إلغاء التفعيل"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={`p-4 sm:p-6 border-t ${ws.divider} flex-shrink-0`}>
          <button
            type="button"
            onClick={onClose}
            className={`${ws.btnNeutral} w-full px-6 py-3 justify-center`}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
