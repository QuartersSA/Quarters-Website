import React from "react";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { formatQty } from "@/utils/greenBeanOrderUtils";

export function DepositSuccess({ depositResult, onCloseDepositModal }) {
  return (
    <div>
      <div
        className="flex items-center gap-3 p-4 rounded-xl mb-4"
        style={{
          background: "rgba(16, 185, 129, 0.1)",
          border: "1px solid rgba(16, 185, 129, 0.2)",
        }}
      >
        <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <div>
          <div className="text-emerald-700 dark:text-emerald-300 font-bold">تم الإيداع بنجاح</div>
          <div className="text-sm text-slate-700 dark:text-white/70 mt-1">
            تم إيداع {depositResult.deposited} نوع بن في فرع "
            {depositResult.branchName}"
          </div>
        </div>
      </div>

      {/* Deposited items */}
      {Array.isArray(depositResult.receipts) &&
      depositResult.receipts.length > 0 ? (
        <div className="mb-4">
          <div className="text-xs text-slate-600 dark:text-white/55 mb-2">
            الأصناف المودعة (مجمّعة حسب النوع):
          </div>
          <div className="space-y-1">
            {depositResult.receipts.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between text-sm p-2 rounded-lg"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-800 dark:text-white/80">
                    {r.inventoryItemName || r.beanName}
                  </span>
                  {r.bagCount > 1 ? (
                    <span className="text-slate-400 dark:text-white/40 text-xs">
                      ({r.bagCount} خيشة)
                    </span>
                  ) : null}
                </div>
                <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                  {formatQty(r.quantity)} كغ
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Unlinked items warning */}
      {Array.isArray(depositResult.unlinked) &&
      depositResult.unlinked.length > 0 ? (
        <div
          className="p-3 rounded-xl mb-4"
          style={{
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-amber-700 dark:text-amber-300 text-sm font-bold">
              أصناف لم تتم إيداعها
            </span>
          </div>
          <div className="text-xs text-slate-600 dark:text-white/60">
            {depositResult.unlinked.map((u) => (
              <div key={u.beanId || u.beanName} className="mt-1">
                • {u.beanName}
                {u.reason ? ` — ${u.reason}` : " — غير مربوط بصنف مخزون"}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onCloseDepositModal}
        className={`${ws.btnNeutral} px-5 py-2.5 w-full justify-center`}
      >
        إغلاق
      </button>
    </div>
  );
}
