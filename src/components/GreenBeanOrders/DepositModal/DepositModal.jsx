import React from "react";
import { Package, X } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { DepositSuccess } from "./DepositSuccess";
import { DepositForm } from "./DepositForm";

export function DepositModal({
  showDepositModal,
  orderDetails,
  depositResult,
  depositBranchId,
  setDepositBranchId,
  depositNote,
  setDepositNote,
  branchOptions,
  depositPreviewItems,
  onConfirmDeposit,
  onCloseDepositModal,
  depositMutation,
}) {
  if (!showDepositModal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        className="w-full max-w-[520px] rounded-2xl p-6"
        style={{
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(16, 185, 129, 0.15)" }}
            >
              <Package className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-slate-900 dark:text-white font-bold">الإيداع في المخزون</div>
              <div className="text-xs text-slate-500 dark:text-white/50">
                طلب #{orderDetails?.id} — {orderDetails?.supplier_name || ""}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseDepositModal}
            aria-label="إغلاق"
            title="إغلاق"
            className="text-slate-400 dark:text-white/40 hover:text-slate-800 dark:text-white/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {depositResult ? (
          <DepositSuccess
            depositResult={depositResult}
            onCloseDepositModal={onCloseDepositModal}
          />
        ) : (
          <DepositForm
            depositPreviewItems={depositPreviewItems}
            depositBranchId={depositBranchId}
            setDepositBranchId={setDepositBranchId}
            branchOptions={branchOptions}
            depositNote={depositNote}
            setDepositNote={setDepositNote}
            onConfirmDeposit={onConfirmDeposit}
            onCloseDepositModal={onCloseDepositModal}
            depositMutation={depositMutation}
          />
        )}
      </div>
    </div>
  );
}
