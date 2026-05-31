import React from "react";
import { Package } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { formatQty } from "@/utils/greenBeanOrderUtils";

export function DepositForm({
  depositPreviewItems,
  depositBranchId,
  setDepositBranchId,
  branchOptions,
  depositNote,
  setDepositNote,
  onConfirmDeposit,
  onCloseDepositModal,
  depositMutation,
}) {
  return (
    <div>
      {/* Items preview */}
      <div className="mb-4">
        <div className="text-xs text-slate-600 dark:text-white/55 mb-2">
          الأصناف التي سيتم إيداعها (الكمية الواصلة بعد الهدر — مجمّعة حسب
          النوع):
        </div>
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {depositPreviewItems.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-sm p-2 rounded-lg"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-slate-800 dark:text-white/80">{item.beanName}</span>
                {item.bagCount > 1 ? (
                  <span className="text-slate-400 dark:text-white/40 text-xs">
                    ({item.bagCount} خيشة)
                  </span>
                ) : null}
              </div>
              {item.hasReceived ? (
                <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                  {formatQty(item.receivedKg)} كغ
                </span>
              ) : (
                <span className="text-amber-700 dark:text-amber-300 text-xs">غير محدد</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Branch selector */}
      <div className="mb-4">
        <div className="text-xs text-slate-600 dark:text-white/55 mb-1">الفرع المستلم</div>
        <GlassSelect
          value={depositBranchId}
          onChange={setDepositBranchId}
          options={branchOptions}
        />
      </div>

      {/* Note */}
      <div className="mb-5">
        <div className="text-xs text-slate-600 dark:text-white/55 mb-1">ملاحظة (اختياري)</div>
        <input
          type="text"
          className={`${ws.input} px-3 py-2 w-full`}
          value={depositNote}
          onChange={(e) => setDepositNote(e.target.value)}
          placeholder="ملاحظة إضافية…"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onConfirmDeposit}
          className={`${ws.btnPrimary} px-5 py-2.5 flex-1 justify-center`}
          style={{
            background: "linear-gradient(135deg, #059669, #10b981)",
          }}
          disabled={depositMutation.isPending || !depositBranchId}
        >
          <Package className="w-4 h-4" />
          {depositMutation.isPending ? "جاري الإيداع…" : "تأكيد الإيداع"}
        </button>
        <button
          type="button"
          onClick={onCloseDepositModal}
          className={`${ws.btnNeutral} px-5 py-2.5`}
          disabled={depositMutation.isPending}
        >
          إلغاء
        </button>
      </div>

      {depositMutation.isError ? (
        <div className="mt-3 text-sm text-red-300">
          {depositMutation.error?.message || "فشل الإيداع"}
        </div>
      ) : null}
    </div>
  );
}
