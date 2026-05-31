import { X } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function ModalShell({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        role="button"
        tabIndex={0}
      />
      <div
        className={`${ws.glassSoft} ${ws.card} relative w-full max-w-[1000px] max-h-[85svh] overflow-hidden border border-slate-200 dark:border-white/10`}
        dir="rtl"
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
          <div className="text-slate-900 dark:text-white font-bold tracking-tight">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className={`${ws.btnNeutral} px-3 py-2`}
          >
            <X className="w-4 h-4" />
            إغلاق
          </button>
        </div>
        <div className="p-5 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
